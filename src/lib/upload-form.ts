import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Multipart body for one file upload (+ text fields).
 *
 * Phones: Expo SDK 57's fetch only uploads real Blobs, and expo-file-system's File is one, so it
 * streams the local file. Web: picked / recorded files are blob: or data: URLs, so we read the
 * bytes into a Blob first — hence a Promise there (api() awaits it).
 */
export function uploadForm(field: string, file: { uri: string; name: string; type: string }, extra: Record<string, string> = {}): FormData | Promise<FormData> {
  const make = (blob: Blob) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    f.append(field, blob, file.name);
    return f;
  };
  if (Platform.OS !== 'web') return make(new File(file.uri) as unknown as Blob);
  return fetch(file.uri)
    .then((r) => r.blob())
    .then((b) => make(b.type ? b : new Blob([b], { type: file.type })));
}
