import * as Location from 'expo-location';
import { create } from 'zustand';

import { convApi } from './chat-api';

type Sub = { remove: () => void };
const subs = new Map<number, { sub: Sub; timer: ReturnType<typeof setTimeout> }>();

/** Live locations this phone is sharing right now (message ids), for "Stop sharing" buttons. */
export const useLiveSharing = create<{ ids: number[] }>(() => ({ ids: [] }));
const sync = () => useLiveSharing.setState({ ids: [...subs.keys()] });

/** One-off position (asks permission first). */
export async function currentPosition() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Allow location access to share where you are.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/**
 * Keep a live-location message updated while the app is open (foreground only — we don't ask
 * for background location, which is a big privacy ask for a dating app).
 */
export async function startLiveSharing(messageId: number, until: Date) {
  stopLiveSharing(messageId, false);
  const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 20 }, (p) => {
    convApi.live(messageId, p.coords.latitude, p.coords.longitude).catch(() => stopLiveSharing(messageId, false));
  });
  const timer = setTimeout(() => stopLiveSharing(messageId, false), Math.max(0, until.getTime() - Date.now()));
  subs.set(messageId, { sub, timer });
  sync();
}

export function stopLiveSharing(messageId: number, tellServer = true) {
  const s = subs.get(messageId);
  if (s) {
    s.sub.remove();
    clearTimeout(s.timer);
    subs.delete(messageId);
    sync();
  }
  if (tellServer) void currentPosition().then((p) => convApi.live(messageId, p.lat, p.lng, true)).catch(() => {});
}
