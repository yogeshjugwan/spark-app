import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from './auth-store';
import { profileApi, type LocalFile } from './profile-api';
import type { OwnProfile, ProfileUpdate } from './types';

/** Your own profile, kept in the auth store so every screen sees the same copy. */
export function useOwnProfile() {
  const setProfile = useAuth((s) => s.setProfile);
  const cached = useAuth((s) => s.profile);
  const query = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => {
      const data = (await profileApi.me()).data;
      setProfile(data);
      return data;
    },
    initialData: cached ?? undefined,
  });
  // The store is the source of truth: mutations (photo upload, save…) write
  // there, and the query only refreshes it. Reading query.data first would
  // show stale data after a mutation.
  return { ...query, profile: cached ?? query.data };
}

export function useInterests() {
  return useQuery({
    queryKey: ['interests'],
    queryFn: async () => (await profileApi.interests()).data.interests,
    staleTime: Infinity, // preset list, changes only with a deploy
  });
}

/** Each mutation returns the updated profile; store it everywhere. */
function useProfileMutation<T>(fn: (arg: T) => Promise<{ data: OwnProfile }>) {
  const setProfile = useAuth((s) => s.setProfile);
  return useMutation({ mutationFn: fn, onSuccess: (res) => setProfile(res.data) });
}

export function useProfileMutations() {
  return {
    update: useProfileMutation((body: ProfileUpdate) => profileApi.update(body)),
    addPhoto: useProfileMutation((file: LocalFile) => profileApi.addPhoto(file)),
    deletePhoto: useProfileMutation((id: number) => profileApi.deletePhoto(id)),
    reorderPhotos: useProfileMutation((ids: number[]) => profileApi.reorderPhotos(ids)),
    setVoice: useProfileMutation(({ file, durationSec }: { file: LocalFile; durationSec: number }) => profileApi.setVoice(file, durationSec)),
    deleteVoice: useProfileMutation((_: void) => profileApi.deleteVoice()),
  };
}
