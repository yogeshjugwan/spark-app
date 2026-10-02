import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api } from './api';
import { onBeforeSignOut } from './auth-store';
import { joinGroupCall } from './group-calls';
import { openPendingCall } from './calls';
import { openChatFromNote, requestWebNotifications, type LiveNote } from './live-notify';

export const CALL_CATEGORY = 'incoming-call';
let registeredToken: string | null = null;

// While Spark is open the socket already shows the call screen, so don't also pop a
// notification for the ring. Everything else shows as a normal banner.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const kind = n.request.content.data?.kind;
      const show = kind !== 'call';
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
}

/** Channels and the Answer/Decline buttons. Safe to call repeatedly. */
async function setUpChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Incoming calls',
      importance: Notifications.AndroidImportance.MAX, // omit `sound`: it names a bundled file; unset = system default
      vibrationPattern: [0, 800, 400, 800, 400, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages & matches',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(CALL_CATEGORY, [
    { identifier: 'answer', buttonTitle: 'Answer', options: { opensAppToForeground: true } },
    { identifier: 'decline', buttonTitle: 'Decline', options: { opensAppToForeground: false, isDestructive: true } },
  ]);
}

/**
 * Ask for permission and register this device's Expo push token with the API.
 * Quietly does nothing on simulators or when the project isn't set up for push yet.
 */
export async function registerForPush() {
  try {
    await setUpChannels();
    if (!Device.isDevice && Platform.OS === 'ios') return; // iOS simulators can't receive push
    const perm = await Notifications.getPermissionsAsync();
    const status = perm.granted ? perm.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push notifications are off: set EAS_PROJECT_ID (run `eas init`) and add google-services.json.');
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/api/push-tokens', { method: 'POST', body: { token, platform: Platform.OS }, authed: true });
    registeredToken = token;
  } catch (e) {
    console.warn(`Push registration failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** On sign-out: stop pushes to this device for the old account. */
async function unregisterPush() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api('/api/push-tokens/remove', { method: 'POST', body: { token }, authed: true }).catch(() => {});
}

onBeforeSignOut(unregisterPush);

/** Register once signed in, and route notification taps (also the one that cold-started the app). */
function useNativePush() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    registerForPush();
  }, []);
  useEffect(() => {
    if (!last || handled.has(last.notification.request.identifier + last.actionIdentifier)) return;
    handled.add(last.notification.request.identifier + last.actionIdentifier);
    handleNotificationResponse(last);
  }, [last]);
}
/** Push notifications are phone-only; expo-notifications has no web implementation. */
function useWebPush() {
  useEffect(requestWebNotifications, []);
}
export const usePush: () => void = Platform.OS === 'web' ? useWebPush : useNativePush;

// useLastNotificationResponse keeps returning the same response across remounts.
const handled = new Set<string>();

/** React to a tapped notification (or one of its buttons). */
export async function handleNotificationResponse(r: Notifications.NotificationResponse) {
  const raw = r.notification.request.content.data as { kind?: string; realKind?: string; callId?: number; matchId?: number; groupId?: number; type?: 'audio' | 'video' } | undefined;
  const data = raw?.realKind ? { ...raw, kind: raw.realKind } : raw;
  await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});

  if (data?.kind === 'call') {
    if (r.actionIdentifier === 'decline') {
      if (data.callId) await api(`/api/calls/${data.callId}/decline`, { method: 'POST', authed: true }).catch(() => {});
      return;
    }
    const shown = data.callId ? await openPendingCall({ callId: data.callId, answer: r.actionIdentifier === 'answer' }) : false;
    // Missed it by the time the app opened: go to the chat instead.
    if (!shown && data.matchId) router.push(`/chat/${data.matchId}`);
  } else if (data?.kind === 'group-call' && data.groupId) {
    // Answer joins straight away; tapping the notification opens the group (with its Join banner).
    if (r.actionIdentifier === 'decline') return;
    if (r.actionIdentifier === 'answer' && data.callId) {
      await joinGroupCall(data.callId, data.type).catch(() => router.push(`/group/${data.groupId}`));
      return;
    }
    router.push(`/group/${data.groupId}`);
  } else if (data?.kind === 'message' && (data.matchId || data.groupId)) {
    openChatFromNote(data as LiveNote['data']);
  } else if (data?.kind === 'missed-call' && data.matchId) {
    router.push(`/chat/${data.matchId}`);
  }
}

// Development helper: show the same notification a call push would, without FCM.
// From the debugger: __simulateCallPush({ callId, matchId, name, type })
if (__DEV__) {
  (globalThis as { __simulateCallPush?: unknown }).__simulateCallPush = (p: { callId: number; matchId: number; name: string; type?: 'audio' | 'video' }) =>
    Notifications.scheduleNotificationAsync({
      content: {
        title: p.name,
        body: p.type === 'video' ? 'Incoming video call…' : 'Incoming voice call…',
        data: { kind: 'call-simulated', realKind: 'call', callId: p.callId, matchId: p.matchId, type: p.type ?? 'audio' },
        categoryIdentifier: CALL_CATEGORY,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: { channelId: 'calls', seconds: 2, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
    });
}
