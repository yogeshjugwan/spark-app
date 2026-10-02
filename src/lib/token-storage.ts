import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Tokens } from './types';

// Tokens live in the iOS Keychain / Android Keystore — never AsyncStorage.
const KEY = 'auth.tokens';

// SecureStore doesn't exist on web. There we keep the session in localStorage so a page reload
// doesn't sign you out (the usual web-app trade-off: readable by scripts on this origin).
const web = {
  get: () => {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  set: (t: Tokens | null) => {
    try {
      if (t) globalThis.localStorage?.setItem(KEY, JSON.stringify(t));
      else globalThis.localStorage?.removeItem(KEY);
    } catch {
      // private mode / storage disabled: session lasts until reload
    }
  },
};

export async function loadTokens(): Promise<Tokens | null> {
  if (Platform.OS === 'web') return web.get();
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    await SecureStore.deleteItemAsync(KEY);
    return null;
  }
}

export async function saveTokens(tokens: Tokens) {
  if (Platform.OS === 'web') return web.set(tokens);
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function clearTokens() {
  if (Platform.OS === 'web') return web.set(null);
  await SecureStore.deleteItemAsync(KEY);
}
