import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/design/logo';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Logo row + large section title, as at the top of each Figma tab frame. */
export function TabHeader({ title, right, emoji }: { title?: string; right?: ReactNode; emoji?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Logo />
        {right}
      </View>
      {title && (
        <ThemedText type="heading" style={styles.title} accessibilityRole="header">
          {title}
          {emoji ? ` ${emoji}` : ''}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  title: { marginTop: Spacing.one },
});
