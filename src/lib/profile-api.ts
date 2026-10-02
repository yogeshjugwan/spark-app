
import { api } from './api';
import { uploadForm } from './upload-form';
import type { Interest, OwnProfile, ProfileUpdate } from './types';

type Ok<T> = { success: true; message?: string; data: T };

/** A local file picked from the library or recorded, ready to upload. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

const fileForm = (field: string, file: LocalFile, extra: Record<string, string> = {}) => uploadForm(field, file, extra);

export const profileApi = {
  interests: () => api<Ok<{ interests: Interest[] }>>('/api/interests', { authed: true }),

  me: () => api<Ok<OwnProfile>>('/api/profile/me', { authed: true }),

  update: (body: ProfileUpdate) => api<Ok<OwnProfile>>('/api/profile/me', { method: 'PUT', body, authed: true }),

  addPhoto: (file: LocalFile) =>
    api<Ok<OwnProfile>>('/api/profile/photos', { method: 'POST', body: fileForm('photo', file), authed: true }),

  deletePhoto: (id: number) => api<Ok<OwnProfile>>(`/api/profile/photos/${id}`, { method: 'DELETE', authed: true }),

  reorderPhotos: (photoIds: number[]) =>
    api<Ok<OwnProfile>>('/api/profile/photos/order', { method: 'PUT', body: { photoIds }, authed: true }),

  setVoice: (file: LocalFile, durationSec: number) =>
    api<Ok<OwnProfile>>('/api/profile/voice', {
      method: 'PUT',
      body: fileForm('voice', file, { durationSec: String(durationSec) }),
      authed: true,
    }),

  deleteVoice: () => api<Ok<OwnProfile>>('/api/profile/voice', { method: 'DELETE', authed: true }),
};
