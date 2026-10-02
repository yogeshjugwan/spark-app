import { API_URL } from './config';

/** Turns an API media path (/uploads/…) into a full URL the app can load. */
export function mediaUrl(path: string | null | undefined) {
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}
