import { router } from 'expo-router';
import { useState } from 'react';

import { AboutFields, type AboutValues } from '@/components/profile/about-fields';
import { OnboardingStep } from '@/components/profile/onboarding-step';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { useOwnProfile, useProfileMutations } from '@/lib/use-profile';

export default function AboutStep() {
  const { profile } = useOwnProfile();
  const { update } = useProfileMutations();
  const [values, setValues] = useState<AboutValues>({
    interestIds: profile?.interests.map((i) => i.id) ?? [],
    bio: profile?.profile?.bio ?? '',
    jobTitle: profile?.profile?.jobTitle ?? '',
    city: profile?.profile?.city ?? '',
  });

  const next = () =>
    update.mutate(
      { interestIds: values.interestIds, bio: values.bio, jobTitle: values.jobTitle, city: values.city },
      { onSuccess: () => router.push('/voice') },
    );

  return (
    <OnboardingStep
      step={4}
      title="What are you into?"
      subtitle="Pick a few interests and write a line or two — it helps start conversations."
      footer={<Button title="Continue" loading={update.isPending} onPress={next} />}>
      <FormMessage message={update.error?.message} />
      <AboutFields value={values} onChange={setValues} />
    </OnboardingStep>
  );
}
