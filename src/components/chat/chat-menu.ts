import type { QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { showMenu, type MenuItem } from '@/components/ui/action-menu';
import { chatKeys, convApi, disappearLabel, type ConvRef, type ConvState } from '@/lib/chat-api';

import { WALLPAPERS } from './conversation-view';

const refresh = (qc: QueryClient, conv: ConvRef) => {
  qc.invalidateQueries({ queryKey: chatKeys.state(conv) });
  qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
};
const fail = (e: unknown) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));

export function muteMenu(qc: QueryClient, conv: ConvRef, mutedUntil: string | null) {
  const set = (ms: number | null) =>
    convApi
      .prefs(conv, { mutedUntil: ms === null ? null : new Date(Date.now() + ms).toISOString() })
      .then(() => refresh(qc, conv))
      .catch(fail);
  const muted = !!mutedUntil && new Date(mutedUntil) > new Date();
  showMenu(
    [
      ...(muted ? [{ label: 'Unmute', icon: 'notifications-outline' as const, onPress: () => set(null) }] : []),
      { label: '8 hours', onPress: () => set(8 * 3600e3) },
      { label: '1 week', onPress: () => set(7 * 86400e3) },
      { label: 'Always', onPress: () => set(100 * 365 * 86400e3) },
    ],
    'Mute notifications',
  );
}

export function disappearMenu(qc: QueryClient, conv: ConvRef, current: number | null) {
  const set = (s: number | null) => convApi.disappearing(conv, s).then(() => refresh(qc, conv)).catch(fail);
  showMenu(
    [
      { label: '24 hours', checked: current === 86400, onPress: () => set(86400) },
      { label: '7 days', checked: current === 604800, onPress: () => set(604800) },
      { label: '90 days', checked: current === 7776000, onPress: () => set(7776000) },
      { label: 'Off', checked: !current, onPress: () => set(null) },
    ],
    'Disappearing messages',
  );
}

export function wallpaperMenu(qc: QueryClient, conv: ConvRef, current: string | null) {
  const names: Record<string, string> = { default: 'Default', blush: 'Blush', lavender: 'Lavender', mint: 'Mint', sky: 'Sky', sand: 'Sand', night: 'Night' };
  showMenu(
    Object.keys(WALLPAPERS).map((k) => ({
      label: names[k],
      checked: (current ?? 'default') === k,
      onPress: () =>
        convApi
          .prefs(conv, { wallpaper: k === 'default' ? null : k })
          .then(() => refresh(qc, conv))
          .catch(fail),
    })),
    'Chat wallpaper',
  );
}

export function confirmClear(qc: QueryClient, conv: ConvRef) {
  Alert.alert('Clear this chat?', 'Messages are removed from this phone only. Starred messages stay in Starred.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Clear chat',
      style: 'destructive',
      onPress: () =>
        convApi
          .clear(conv)
          .then(() => {
            qc.invalidateQueries({ queryKey: conv.kind === 'match' ? chatKeys.thread(conv.id) : chatKeys.groupThread(conv.id) });
            refresh(qc, conv);
          })
          .catch(fail),
    },
  ]);
}

/** Menu items shared by the 1:1 and group chat headers. */
export function commonItems(qc: QueryClient, conv: ConvRef, state: ConvState | undefined, openSearch: () => void): MenuItem[] {
  const muted = !!state?.prefs.mutedUntil && new Date(state.prefs.mutedUntil) > new Date();
  return [
    { label: 'Search', icon: 'search-outline', onPress: openSearch },
    { label: 'Media, links and docs', icon: 'images-outline', onPress: () => router.push({ pathname: '/media/[kind]/[id]', params: { kind: conv.kind, id: String(conv.id) } }) },
    { label: 'Starred messages', icon: 'star-outline', onPress: () => router.push('/starred') },
    { label: muted ? 'Unmute notifications' : 'Mute notifications', icon: muted ? 'notifications-outline' : 'notifications-off-outline', onPress: () => muteMenu(qc, conv, state?.prefs.mutedUntil ?? null) },
    ...(state?.isAdmin ? [{ label: 'Disappearing messages', icon: 'timer-outline' as const, value: disappearLabel(state?.disappearSec ?? null), onPress: () => disappearMenu(qc, conv, state?.disappearSec ?? null) }] : []),
    { label: 'Wallpaper', icon: 'color-palette-outline', onPress: () => wallpaperMenu(qc, conv, state?.prefs.wallpaper ?? null) },
    { label: 'Clear chat', icon: 'trash-bin-outline', onPress: () => confirmClear(qc, conv) },
  ];
}
