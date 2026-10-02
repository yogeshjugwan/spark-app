import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ChoiceChip } from '@/components/profile/choice-chip';
import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui/text-field';
import { Colors, Spacing } from '@/constants/theme';
import { useInterests } from '@/lib/use-profile';

export const MAX_INTERESTS = 10;
export const BIO_MAX = 500;

export interface AboutValues {
  interestIds: number[];
  bio: string;
  jobTitle: string;
  city: string;
}

/** Interests chips + bio/job/city, shared by onboarding and Edit profile. */
export function AboutFields({ value, onChange }: { value: AboutValues; onChange: (v: AboutValues) => void }) {
  const interests = useInterests();
  const selected = new Set(value.interestIds);
  const full = selected.size >= MAX_INTERESTS;

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (!full) next.add(id);
    onChange({ ...value, interestIds: [...next] });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText type="smallBold">Interests</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {selected.size}/{MAX_INTERESTS}
        </ThemedText>
      </View>
      {interests.isLoading ? (
        <ActivityIndicator color={Colors.light.primary} />
      ) : (
        <View style={styles.chips}>
          {interests.data?.map((i) => (
            <ChoiceChip
              key={i.id}
              label={i.label}
              emoji={i.emoji}
              selected={selected.has(i.id)}
              disabled={full && !selected.has(i.id)}
              onPress={() => toggle(i.id)}
            />
          ))}
        </View>
      )}

      <TextField
        label="Bio"
        icon="chatbubble-ellipses-outline"
        placeholder="Coffee first, then adventures…"
        multiline
        maxLength={BIO_MAX}
        value={value.bio}
        onChangeText={(bio) => onChange({ ...value, bio })}
        hint={`${value.bio.length}/${BIO_MAX}`}
        style={styles.bio}
      />
      <TextField
        label="Job title (optional)"
        icon="briefcase-outline"
        placeholder="Designer"
        maxLength={80}
        value={value.jobTitle}
        onChangeText={(jobTitle) => onChange({ ...value, jobTitle })}
      />
      <TextField
        label="City (optional)"
        icon="location-outline"
        placeholder="Bengaluru"
        maxLength={80}
        value={value.city}
        onChangeText={(city) => onChange({ ...value, city })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  bio: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },
});
