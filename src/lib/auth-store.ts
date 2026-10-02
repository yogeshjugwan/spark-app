import { create } from 'zustand';
import { api, configureApiAuth } from './api';
import { profileApi } from './profile-api';
import { clearTokens, loadTokens, saveTokens } from './token-storage';
import type { OwnProfile, Session, Tokens, User } from './types';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: User | null;
  tokens: Tokens | null;
  profile: OwnProfile | null;
  /**
   * True while the user is going through profile setup. Set at sign-in when the
   * profile is incomplete, and cleared only by finishOnboarding() — so reaching
   * "complete" halfway through (e.g. after the 2nd photo) doesn't jump screens.
   */
  onboarding: boolean;
  /** Restores a saved session on app start. */
  hydrate: () => Promise<void>;
  signIn: (session: Session) => Promise<void>;
  setUser: (user: User) => void;
  setProfile: (profile: OwnProfile) => void;
  finishOnboarding: () => void;
  signOut: (options?: { everywhere?: boolean }) => Promise<void>;
  /** Permanently delete the account on the server, then sign out here. */
  deleteAccount: () => Promise<void>;
}

const signedOut = { status: 'signedOut' as const, user: null, tokens: null, profile: null, onboarding: false };

/** Loads the profile; on failure returns null so the app can retry from the setup screens. */
async function fetchProfile() {
  try {
    return (await profileApi.me()).data;
  } catch {
    return null;
  }
}

// Work that must happen before the session ends. Registered by other modules so this
// store doesn't import them (push → calls → socket → auth would be a cycle).
const beforeSignOut = new Set<() => Promise<void>>();
export function onBeforeSignOut(fn: () => Promise<void>) {
  beforeSignOut.add(fn);
  return () => void beforeSignOut.delete(fn);
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  tokens: null,
  profile: null,
  onboarding: false,

  hydrate: async () => {
    const tokens = await loadTokens();
    if (!tokens) return set(signedOut);

    set({ tokens });
    try {
      const res = await api<{ data: { user: User } }>('/api/auth/me', { authed: true });
      const profile = await fetchProfile();
      set({ status: 'signedIn', user: res.data.user, profile, onboarding: !profile?.completion.isComplete });
    } catch {
      // Offline or the session is gone — ask them to log in again.
      await clearTokens();
      set(signedOut);
    }
  },

  signIn: async ({ user, tokens }) => {
    await saveTokens(tokens);
    set({ tokens });
    const profile = await fetchProfile();
    set({ status: 'signedIn', user, profile, onboarding: !profile?.completion.isComplete });
  },

  setUser: (user) => set({ user }),

  setProfile: (profile) =>
    set((s) => ({ profile, user: s.user && s.user.name !== profile.name ? { ...s.user, name: profile.name } : s.user })),

  finishOnboarding: () => {
    if (get().profile?.completion.isComplete) set({ onboarding: false });
  },

  signOut: async ({ everywhere = false } = {}) => {
    const { tokens } = get();
    // e.g. unregister this device's push token while we're still authenticated.
    await Promise.all([...beforeSignOut].map((fn) => fn().catch(() => {})));
    try {
      if (everywhere) await api('/api/auth/logout-all', { method: 'POST', authed: true });
      else if (tokens) await api('/api/auth/logout', { method: 'POST', body: { refreshToken: tokens.refreshToken } });
    } catch {
      // Log out locally even if the server can't be reached.
    }
    await clearTokens();
    set(signedOut);
  },
  deleteAccount: async () => {
    await Promise.all([...beforeSignOut].map((fn) => fn().catch(() => {})));
    await api('/api/account', { method: 'DELETE', authed: true }); // throws → stay signed in and show why
    await clearTokens();
    set(signedOut);
  },
}));

configureApiAuth({
  getTokens: () => useAuth.getState().tokens,
  onTokens: async (tokens) => {
    await saveTokens(tokens);
    useAuth.setState({ tokens });
  },
  onSessionExpired: async () => {
    await clearTokens();
    useAuth.setState(signedOut);
  },
});
