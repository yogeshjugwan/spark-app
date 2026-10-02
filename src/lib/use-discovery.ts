import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { ApiError } from './api';
import { useAuth } from './auth-store';
import { discoveryApi } from './discovery-api';
import type { DiscoverProfile } from './types';

export const discoveryKeys = {
  all: ['discover'] as const,
  feed: ['discover', 'feed'] as const,
  explore: ['discover', 'explore'] as const,
  recommendations: ['discover', 'recommendations'] as const,
  profile: (id: number) => ['discover', 'profile', id] as const,
  matches: ['matches'] as const,
};

/**
 * Out of free likes today? Remember it, so every further like tap opens the
 * Spark+ screen straight away instead of calling the API again.
 */
let outOfLikesOn: string | null = null;
const today = () => new Date().toDateString();
export const isOutOfLikes = () => outOfLikesOn === today();
export const clearOutOfLikes = () => {
  outOfLikesOn = null;
};
const openLikesPaywall = () => router.push({ pathname: '/premium', params: { feature: 'daily_likes' } });

type ExplorePages = InfiniteData<{ items: DiscoverProfile[]; nextCursor: number | null }, number | undefined>;

/**
 * Like or pass. Updates every cached list at once (the person leaves the
 * Featured deck and Recommendations; Explore shows the heart as filled), and
 * opens the "It's a match!" screen when it's mutual.
 */
export function useSwipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, action }: { userId: number; action: 'like' | 'pass' }) => {
      if (action === 'like' && isOutOfLikes()) {
        openLikesPaywall();
        throw new ApiError(402, 'Out of likes for today', { feature: 'daily_likes' });
      }
      try {
        return await discoveryApi.swipe(userId, action);
      } catch (e) {
        // The API client already opens the paywall on this first 402.
        if (e instanceof ApiError && e.status === 402) outOfLikesOn = today();
        throw e;
      }
    },
    onSuccess: (res, { userId, action }) => {
      const drop = (list?: DiscoverProfile[]) => list?.filter((p) => p.id !== userId);
      qc.setQueryData<DiscoverProfile[]>(discoveryKeys.feed, drop);
      qc.setQueryData<DiscoverProfile[]>(discoveryKeys.recommendations, drop);
      qc.setQueryData<ExplorePages>(discoveryKeys.explore, (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items:
              action === 'pass'
                ? page.items.filter((p) => p.id !== userId)
                : page.items.map((p) => (p.id === userId && !p.youLiked ? { ...p, youLiked: true, likeCount: p.likeCount + 1 } : p)),
          })),
        },
      );
      qc.invalidateQueries({ queryKey: discoveryKeys.profile(userId) });

      const { match } = res.data;
      if (match) {
        qc.invalidateQueries({ queryKey: discoveryKeys.matches });
        router.push({
          pathname: '/match',
          params: { matchId: String(match.id), name: match.user.name, photoUrl: match.user.photoUrl ?? '' },
        });
      }
    },
  });
}

/**
 * Shares an approximate location once per session so distances work. Uses the
 * lowest accuracy (~city block); the API rounds it to ~1 km before storing.
 * If permission is denied, discovery still works — just without distances.
 */
let syncedThisSession = false;
export function useSyncLocation() {
  const qc = useQueryClient();
  const setProfile = useAuth((s) => s.setProfile);

  useEffect(() => {
    if (syncedThisSession) return;
    syncedThisSession = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos =
          (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 })) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
        const res = await discoveryApi.setLocation(pos.coords.latitude, pos.coords.longitude);
        setProfile(res.data);
        qc.invalidateQueries({ queryKey: discoveryKeys.all });
      } catch {
        syncedThisSession = false; // try again next time the tabs mount
      }
    })();
  }, [qc, setProfile]);
}
