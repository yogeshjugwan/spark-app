import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Message notifications from the live socket ("notify" event). The server already skips muted
 * chats, so this works without FCM whenever the app (or web tab) is running. Real push (FCM)
 * covers the app when it's closed.
 */
export interface LiveNote {
  title: string;
  body: string;
  data: { kind: 'message'; messageId: number; matchId?: number; groupId?: number };
}

// The chat on screen right now ("m12" / "g3"): no banner for messages you're already reading.
let viewing: string | null = null;
export function useViewingChat(key: string | null) {
  useEffect(() => {
    if (!key) return;
    viewing = key;
    return () => {
      if (viewing === key) viewing = null;
    };
  }, [key]);
}

const chatPath = (d: LiveNote['data']) => (d.matchId ? `/chat/${d.matchId}` : `/group/${d.groupId}`);

export function showLiveNotification(n: LiveNote) {
  const key = n.data.matchId ? `m${n.data.matchId}` : `g${n.data.groupId}`;
  if (Platform.OS === 'web') {
    const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    if (visible && viewing === key) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const note = new Notification(n.title, { body: n.body, tag: `msg-${n.data.messageId}`, icon: '/favicon.ico' });
    note.onclick = () => {
      window.focus();
      router.push(chatPath(n.data) as never);
      note.close();
    };
    return;
  }
  if (AppState.currentState === 'active' && viewing === key) return;
  Notifications.scheduleNotificationAsync({
    content: { title: n.title, body: n.body, data: n.data, sound: true },
    trigger: Platform.OS === 'android' ? { channelId: 'messages' } : null,
  }).catch(() => {});
}

/** Web: ask once for browser notification permission. */
export function requestWebNotifications() {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}

export const openChatFromNote = (d: LiveNote['data']) => router.push(chatPath(d) as never);
