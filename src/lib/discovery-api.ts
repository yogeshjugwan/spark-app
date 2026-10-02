import { api } from './api';
import type { DiscoverProfile, GuestProfile, MatchInfo, OwnProfile, SwipeResult } from './types';

type Ok<T> = { success: true; message?: string; data: T };

export const discoveryApi = {
  feed: (limit = 10) => api<Ok<{ profiles: DiscoverProfile[] }>>(`/api/discover/feed?limit=${limit}`, { authed: true }),

  recommendations: () => api<Ok<{ profiles: DiscoverProfile[] }>>('/api/discover/recommendations', { authed: true }),

  explore: (cursor?: number, limit = 20) =>
    api<Ok<{ items: DiscoverProfile[]; nextCursor: number | null }>>(
      `/api/discover/explore?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`,
      { authed: true },
    ),

  profile: (id: number) => api<Ok<{ profile: DiscoverProfile }>>(`/api/users/${id}`, { authed: true }),

  swipe: (toUserId: number, action: 'like' | 'pass') =>
    api<Ok<SwipeResult>>('/api/swipes', { method: 'POST', body: { toUserId, action }, authed: true }),

  matches: () => api<Ok<{ matches: MatchInfo[] }>>('/api/matches', { authed: true }),

  unmatch: (matchId: number) => api<Ok<unknown>>(`/api/matches/${matchId}`, { method: 'DELETE', authed: true }),

  block: (userId: number) => api<Ok<unknown>>('/api/blocks', { method: 'POST', body: { userId }, authed: true }),

  setLocation: (latitude: number, longitude: number) =>
    api<Ok<OwnProfile>>('/api/profile/location', { method: 'PUT', body: { latitude, longitude }, authed: true }),

  /** No account needed: first names, ages, blurred photos. */
  guestExplore: () => api<Ok<{ profiles: GuestProfile[] }>>('/api/public/explore'),
};
