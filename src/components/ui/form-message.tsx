import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const c = Colors.light;

/** A banner for form-level errors or info (e.g. "Invalid credentials"). */
export function FormMessage({ message, tone = 'error' }: { message?: string | null; tone?: 'error' | 'info' }) {
  if (!message) return null;
  const color = tone === 'error' ? c.danger : c.textSecondary;

  return (
    <View style={[styles.box, { borderColor: color }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name={tone === 'error' ? 'alert-circle' : 'information-circle'} size={20} color={color} />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  text: { flex: 1, fontFamily: Fonts.semibold, fontSize: 14, lineHeight: 20 },
});
