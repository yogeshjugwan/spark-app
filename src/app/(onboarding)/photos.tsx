import { router } from 'expo-router';

import { OnboardingStep } from '@/components/profile/onboarding-step';
import { PhotoGrid } from '@/components/profile/photo-grid';
import { Button } from '@/components/ui/button';
import { useOwnProfile } from '@/lib/use-profile';

export default function PhotosStep() {
  const { profile } = useOwnProfile();
  const photos = profile?.photos ?? [];
  const min = profile?.completion.minPhotos ?? 2;
  const max = profile?.completion.maxPhotos ?? 6;

  return (
    <OnboardingStep
      step={3}
      title="Add your best photos"
      subtitle="Your first photo is the one people see first."
      footer={<Button title="Continue" disabled={photos.length < min} onPress={() => router.push('/about')} />}>
      <PhotoGrid photos={photos} min={min} max={max} />
    </OnboardingStep>
  );
}
