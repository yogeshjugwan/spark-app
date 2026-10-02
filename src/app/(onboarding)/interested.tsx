import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingStep } from '@/components/profile/onboarding-step';
import { OptionCard } from '@/components/profile/option-card';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { useAuth } from '@/lib/auth-store';
import { useOnboardingDraft } from '@/lib/onboarding-draft';
import { useProfileMutations } from '@/lib/use-profile';
import type { InterestedIn } from '@/lib/types';

const OPTIONS: { value: InterestedIn; title: string; subtitle: string; icon: 'female' | 'male' | 'people' }[] = [
  { value: 'women', title: 'Women', subtitle: 'Show me women', icon: 'female' },
  { value: 'men', title: 'Men', subtitle: 'Show me men', icon: 'male' },
  { value: 'everyone', title: 'Everyone', subtitle: 'Show me everyone', icon: 'people' },
];

export default function InterestedStep() {
  const existing = useAuth((s) => s.profile?.profile);
  const draft = useOnboardingDraft();
  const { update } = useProfileMutations();
  const [value, setValue] = useState<InterestedIn | null>(existing?.interestedIn ?? null);
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    if (!value) return setError('Choose who you want to meet');
    setError(null);
    // Creates the profile on first run (step 1 answers + this one).
    const body = existing
      ? { interestedIn: value }
      : {
          name: draft.name,
          birthDate: draft.birthDate ?? undefined,
          gender: draft.gender ?? undefined,
          countryCode: draft.countryCode,
          interestedIn: value,
        };
    update.mutate(body, { onSuccess: () => router.push('/photos') });
  };

  return (
    <OnboardingStep
      step={2}
      title="Who do you want to meet?"
      subtitle="You can change this anytime in your profile."
      footer={<Button title="Continue" loading={update.isPending} onPress={next} />}>
      {OPTIONS.map((o) => (
        <OptionCard key={o.value} icon={o.icon} title={o.title} subtitle={o.subtitle} selected={value === o.value} onPress={() => setValue(o.value)} />
      ))}
      <FormMessage message={error ?? update.error?.message} />
    </OnboardingStep>
  );
}
