import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
}

const c = Colors.light;

/**
 * One hidden TextInput drawn as glass boxes. Using a single input keeps paste and
 * iOS/Android SMS code autofill working.
 */
export function OtpInput({ value, onChange, length = 6, error, autoFocus }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Verification code">
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const active = focused && i === Math.min(value.length, length - 1);
          const filled = i < value.length;
          const borderColor = error ? c.danger : active ? c.primary : filled ? c.pinkSoft : c.borderStrong;
          return (
            <View key={i} style={[styles.box, { borderColor, borderWidth: active ? 2 : 1 }]}>
              <Text style={styles.digit}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  digit: { fontFamily: Fonts.bold, fontSize: 24, color: c.text },
  // Kept in the layout (not display:none) so it can receive focus and autofill.
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
