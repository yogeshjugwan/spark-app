import { StyleSheet, Pressable, Text } from 'react-native';

import { Colors, Fonts, Radius } from '@/constants/theme';

const c = Colors.light;

/** Selectable pill (Figma card chips like "Running" / "Photography"). */
export function ChoiceChip({
  label,
  emoji,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.on : styles.off,
        { opacity: disabled && !selected ? 0.45 : pressed ? 0.8 : 1 },
      ]}>
      <Text style={[styles.text, selected && styles.textOn]}>
        {emoji ? `${emoji}  ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
  off: { backgroundColor: 'rgba(255,255,255,0.85)', borderColor: c.borderStrong },
  on: { backgroundColor: c.primary, borderColor: c.primary },
  text: { fontFamily: Fonts.semibold, fontSize: 14, color: c.text },
  textOn: { color: '#fff' },
});
