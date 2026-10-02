import Slider from '@react-native-community/slider';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/design/glass-card';
import { OptionCard } from '@/components/profile/option-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { discoveryKeys } from '@/lib/use-discovery';
import { useOwnProfile, useProfileMutations } from '@/lib/use-profile';
import type { InterestedIn } from '@/lib/types';

const c = Colors.light;
const MIN_AGE = 18;
const MAX_AGE = 80;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowHead}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

/** Discovery filters: age range, distance, who to show. Saved to your profile. */
export default function FiltersScreen() {
  const { profile } = useOwnProfile();
  const { update } = useProfileMutations();
  const qc = useQueryClient();
  const prefs = profile?.profile?.preferences;

  const [ageMin, setAgeMin] = useState(prefs?.ageMin ?? 18);
  const [ageMax, setAgeMax] = useState(Math.min(prefs?.ageMax ?? 60, MAX_AGE));
  const [distance, setDistance] = useState(prefs?.distanceKm ?? 50);
  const [interestedIn, setInterestedIn] = useState<InterestedIn | undefined>(profile?.profile?.interestedIn);

  const save = () =>
    update.mutate(
      { prefAgeMin: ageMin, prefAgeMax: ageMax, prefDistanceKm: distance, interestedIn },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: discoveryKeys.all });
          router.back();
        },
      },
    );

  const slider = { minimumTrackTintColor: c.primary, maximumTrackTintColor: '#E7D7E6', thumbTintColor: c.primary, style: styles.slider };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          title: 'Filters',
          headerTitleStyle: { fontFamily: Fonts.bold, color: c.text },
          headerTintColor: c.text,
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Screen footer={<Button title="Show people" icon="sparkles" loading={update.isPending} onPress={save} />}>
        <FormMessage message={update.error?.message} />

        <GlassCard style={styles.card}>
          <Row label="Age range" value={`${ageMin} – ${ageMax}${ageMax === MAX_AGE ? '+' : ''}`} />
          <Text style={styles.sub}>Youngest</Text>
          <Slider
            {...slider}
            minimumValue={MIN_AGE}
            maximumValue={MAX_AGE}
            step={1}
            value={ageMin}
            onValueChange={(v) => {
              setAgeMin(v);
              if (v > ageMax) setAgeMax(v);
            }}
            accessibilityLabel="Youngest age"
          />
          <Text style={styles.sub}>Oldest</Text>
          <Slider
            {...slider}
            minimumValue={MIN_AGE}
            maximumValue={MAX_AGE}
            step={1}
            value={ageMax}
            onValueChange={(v) => {
              setAgeMax(v);
              if (v < ageMin) setAgeMin(v);
            }}
            accessibilityLabel="Oldest age"
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Row label="Maximum distance" value={`${distance} km`} />
          <Slider {...slider} minimumValue={1} maximumValue={500} step={1} value={distance} onValueChange={setDistance} accessibilityLabel="Maximum distance in kilometres" />
          {!profile?.profile?.hasLocation && (
            <Text style={styles.sub}>Allow location access to filter by distance. Without it, everyone is shown.</Text>
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <ThemedText type="smallBold">Show me</ThemedText>
          <OptionCard icon="female" title="Women" selected={interestedIn === 'women'} onPress={() => setInterestedIn('women')} />
          <OptionCard icon="male" title="Men" selected={interestedIn === 'men'} onPress={() => setInterestedIn('men')} />
          <OptionCard icon="people" title="Everyone" selected={interestedIn === 'everyone'} onPress={() => setInterestedIn('everyone')} />
        </GlassCard>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.two },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontFamily: Fonts.bold, fontSize: 15, color: c.primary },
  sub: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  slider: { width: '100%', height: 36 },
});
