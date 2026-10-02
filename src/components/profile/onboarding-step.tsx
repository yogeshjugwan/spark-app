import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Colors, Spacing } from '@/constants/theme';

export const ONBOARDING_STEPS = 5;

/** Shared layout for each profile-setup step: progress, title, body, footer. */
export function OnboardingStep({
  step,
  title,
  subtitle,
  children,
  footer,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Screen footer={footer}>
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${ONBOARDING_STEPS}`}
        accessibilityValue={{ min: 0, max: ONBOARDING_STEPS, now: step }}>
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View key={i} style={[styles.seg, i < step && styles.segOn]} />
        ))}
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        Step {step} of {ONBOARDING_STEPS}
      </ThemedText>
      <ThemedText type="subtitle" accessibilityRole="header">
        {title}
      </ThemedText>
      {subtitle && <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>}
      <View style={styles.body}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(214,93,177,0.18)' },
  segOn: { backgroundColor: Colors.light.primary },
  body: { gap: Spacing.three, marginTop: Spacing.two },
});
