import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/design/glass-card';
import { AboutFields, type AboutValues } from '@/components/profile/about-fields';
import { CountryPicker } from '@/components/profile/country-picker';
import { DateField } from '@/components/profile/date-field';
import { OptionCard } from '@/components/profile/option-card';
import { PhotoGrid } from '@/components/profile/photo-grid';
import { VoiceRecorder } from '@/components/profile/voice-recorder';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useOwnProfile, useProfileMutations } from '@/lib/use-profile';
import type { Gender, InterestedIn } from '@/lib/types';

const GENDERS: { value: Gender; title: string; icon: 'female' | 'male' | 'male-female' }[] = [
  { value: 'woman', title: 'Woman', icon: 'female' },
  { value: 'man', title: 'Man', icon: 'male' },
  { value: 'nonbinary', title: 'Non-binary', icon: 'male-female' },
];
const LOOKING: { value: InterestedIn; title: string; icon: 'female' | 'male' | 'people' }[] = [
  { value: 'women', title: 'Women', icon: 'female' },
  { value: 'men', title: 'Men', icon: 'male' },
  { value: 'everyone', title: 'Everyone', icon: 'people' },
];

function eighteenYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard style={styles.section}>
      <ThemedText type="heading">{title}</ThemedText>
      {children}
    </GlassCard>
  );
}

/** Edit everything on one screen. Photos and voice save instantly; the rest on "Save". */
export default function EditProfileScreen() {
  const { profile } = useOwnProfile();
  const { update } = useProfileMutations();
  const d = profile?.profile;

  const [name, setName] = useState(profile?.name ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(d?.birthDate ?? null);
  const [gender, setGender] = useState<Gender | undefined>(d?.gender);
  const [interestedIn, setInterestedIn] = useState<InterestedIn | undefined>(d?.interestedIn);
  const [countryCode, setCountryCode] = useState<string | null>(d?.countryCode ?? null);
  const [about, setAbout] = useState<AboutValues>({
    interestIds: profile?.interests.map((i) => i.id) ?? [],
    bio: d?.bio ?? '',
    jobTitle: d?.jobTitle ?? '',
    city: d?.city ?? '',
  });

  if (!profile) return null;

  const save = () =>
    update.mutate(
      {
        name: name.trim(),
        birthDate: birthDate ?? undefined,
        gender,
        interestedIn,
        countryCode,
        interestIds: about.interestIds,
        bio: about.bio,
        jobTitle: about.jobTitle,
        city: about.city,
      },
      { onSuccess: () => router.back() },
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          title: 'Edit profile',
          headerTitleStyle: { fontFamily: Fonts.bold, color: Colors.light.text },
          headerTintColor: Colors.light.text,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
        }}
      />
      <Screen footer={<Button title="Save changes" loading={update.isPending} onPress={save} />}>
        <FormMessage message={update.error?.message} />

        <Section title="Photos">
          <PhotoGrid photos={profile.photos} min={profile.completion.minPhotos} max={profile.completion.maxPhotos} />
        </Section>

        <Section title="Voice intro">
          <VoiceRecorder current={d?.voice ?? null} />
        </Section>

        <Section title="About you">
          <TextField label="First name" icon="person-outline" value={name} onChangeText={setName} />
          <DateField label="Birthday" value={birthDate} onChange={setBirthDate} maxDate={eighteenYearsAgo()} />
          <CountryPicker value={countryCode} onChange={setCountryCode} />
          <ThemedText type="smallBold">I am a</ThemedText>
          <View style={styles.options}>
            {GENDERS.map((g) => (
              <OptionCard key={g.value} icon={g.icon} title={g.title} selected={gender === g.value} onPress={() => setGender(g.value)} />
            ))}
          </View>
        </Section>

        <Section title="Looking for">
          <View style={styles.options}>
            {LOOKING.map((o) => (
              <OptionCard key={o.value} icon={o.icon} title={o.title} selected={interestedIn === o.value} onPress={() => setInterestedIn(o.value)} />
            ))}
          </View>
        </Section>

        <Section title="Interests & bio">
          <AboutFields value={about} onChange={setAbout} />
        </Section>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { padding: Spacing.three, gap: Spacing.three },
  options: { gap: Spacing.two },
});
