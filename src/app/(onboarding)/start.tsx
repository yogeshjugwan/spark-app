import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth-store';

/** Resume setup at the first unfinished step. */
export default function OnboardingStart() {
  const profile = useAuth((s) => s.profile);
  if (profile?.profile && profile.completion.missing.includes('photos')) return <Redirect href="/photos" />;
  if (profile?.profile) return <Redirect href="/about" />;
  return <Redirect href="/basics" />;
}
