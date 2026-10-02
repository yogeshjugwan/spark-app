import { router } from 'expo-router';
import { useState } from 'react';

import { CountryPicker } from '@/components/profile/country-picker';
import { DateField } from '@/components/profile/date-field';
import { OnboardingStep } from '@/components/profile/onboarding-step';
import { OptionCard } from '@/components/profile/option-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/lib/auth-store';
import { useOnboardingDraft } from '@/lib/onboarding-draft';
import { useProfileMutations } from '@/lib/use-profile';
import type { Gender } from '@/lib/types';

const GENDERS: { value: Gender; title: string; icon: 'female' | 'male' | 'male-female' }[] = [
  { value: 'woman', title: 'Woman', icon: 'female' },
  { value: 'man', title: 'Man', icon: 'male' },
  { value: 'nonbinary', title: 'Non-binary', icon: 'male-female' },
];

/** Latest birthday that makes someone 18 today. */
function eighteenYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

export default function BasicsStep() {
  const user = useAuth((s) => s.user);
  const existing = useAuth((s) => s.profile?.profile);
  const draft = useOnboardingDraft();
  const { update } = useProfileMutations();

  const [name, setName] = useState(draft.name || user?.name || '');
  const [birthDate, setBirthDate] = useState(draft.birthDate ?? existing?.birthDate ?? null);
  const [gender, setGender] = useState<Gender | null>(draft.gender ?? existing?.gender ?? null);
  const [countryCode, setCountryCode] = useState(draft.countryCode ?? existing?.countryCode ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const next = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your first name';
    if (!birthDate) e.birthDate = 'Add your birthday';
    if (!gender) e.gender = 'Choose one';
    setErrors(e);
    if (Object.keys(e).length) return;

    const values = { name: name.trim(), birthDate, gender, countryCode };
    if (existing) {
      // Profile already exists (resuming): save now.
      update.mutate({ ...values, birthDate: birthDate!, gender: gender! }, { onSuccess: () => router.push('/interested') });
    } else {
      draft.set(values);
      router.push('/interested');
    }
  };

  return (
    <OnboardingStep
      step={1}
      title="Let's start with you"
      subtitle="This is how you'll appear to people."
      footer={<Button title="Continue" loading={update.isPending} onPress={next} />}>
      <FormMessage message={update.error?.message} />
      <TextField label="First name" icon="person-outline" value={name} onChangeText={setName} autoComplete="given-name" error={errors.name} />
      <DateField
        label="Birthday"
        value={birthDate}
        onChange={setBirthDate}
        maxDate={eighteenYearsAgo()}
        error={errors.birthDate}
      />
      <ThemedText type="smallBold">I am a</ThemedText>
      {GENDERS.map((g) => (
        <OptionCard key={g.value} icon={g.icon} title={g.title} selected={gender === g.value} onPress={() => setGender(g.value)} />
      ))}
      {errors.gender && <FormMessage message={errors.gender} />}
      <CountryPicker value={countryCode} onChange={setCountryCode} />
      <ThemedText type="caption" themeColor="textSecondary">
        You must be 18 or older. Your age is shown on your profile; your birthday isn&apos;t.
      </ThemedText>
    </OnboardingStep>
  );
}
