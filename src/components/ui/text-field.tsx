import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  ref?: Ref<TextInput>;
};

const c = Colors.light;

/** White pill input with a leading icon, like the Figma message and search fields. */
export function TextField({ label, error, hint, icon, style, onFocus, onBlur, secureTextEntry, ref, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = error ? c.danger : focused ? c.primary : c.borderStrong;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, { borderColor }]}>
        {icon && <Ionicons name={icon} size={19} color={focused ? c.primary : c.textSecondary} />}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={c.textSecondary}
          style={[styles.input, style]}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}>
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={[styles.help, { color: c.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.help, { color: c.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: Fonts.semibold, fontSize: 14, color: c.text, marginLeft: 4 },
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  input: { flex: 1, fontFamily: Fonts.medium, fontSize: 16, color: c.text, paddingVertical: 12 },
  help: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18, marginLeft: 4 },
});
