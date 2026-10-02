import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

/**
 * Where the API lives.
 * - Set EXPO_PUBLIC_API_URL to override (required for production builds).
 * - In development, uses the same computer that runs the Expo dev server, so it
 *   works on the iOS simulator, the Android emulator, and a phone on the same Wi-Fi.
 */
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:${API_PORT}`;

  // The Android emulator reaches the host computer at 10.0.2.2.
  return `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
