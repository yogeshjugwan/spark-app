import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const c = Colors.light;

/** Large single-choice row (gender, who you want to meet). */
export function OptionCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      style={({ pressed }) => [styles.card, selected && styles.cardOn, pressed && { opacity: 0.85 }]}>
      <View style={[styles.icon, selected && styles.iconOn]}>
        <Ionicons name={icon} size={22} color={selected ? '#fff' : c.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? c.primary : c.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  cardOn: { borderColor: c.primary, backgroundColor: '#fff' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FBE6F3', alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: c.primary },
  title: { fontFamily: Fonts.bold, fontSize: 16, color: c.text },
  subtitle: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary, marginTop: 2 },
});
