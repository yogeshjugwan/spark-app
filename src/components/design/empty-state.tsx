import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/design/glass-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

/** Centered glass card with an icon, for empty lists and not-yet-built sections. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <GlassCard style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={30} color={Colors.light.primary} />
        </View>
        <ThemedText type="heading" style={styles.text}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {body}
        </ThemedText>
        {action}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.three },
  card: { padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  text: { textAlign: 'center' },
});
