import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';

/**
 * - primary: pink→magenta gradient pill (Figma "Login")
 * - light: solid white pill with dark text (Figma "Explore now")
 * - secondary: frosted-glass pill
 * - ghost: text only, accent colour
 * - onAccent: text only, white — for use on the pink panels (Figma "Log in" link)
 */
type Variant = 'primary' | 'light' | 'secondary' | 'ghost' | 'onAccent';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  size?: 'md' | 'sm';
};

const c = Colors.light;

export function Button({ title, variant = 'primary', loading, disabled, style, icon, size = 'md', ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const color =
    variant === 'primary' || variant === 'onAccent' ? c.textOnAccent : variant === 'ghost' ? c.primary : c.text;
  const height = size === 'sm' ? 40 : 54;

  const content = loading ? (
    <ActivityIndicator color={color} />
  ) : (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={color} />}
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color }]}>{title}</Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        { minHeight: height, opacity: isDisabled ? 0.55 : state.pressed ? 0.85 : 1 },
        variant === 'light' && styles.light,
        variant === 'secondary' && styles.secondary,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {variant === 'primary' && (
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.pill }]}
        />
      )}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  light: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#6B4E8C',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  secondary: {
    backgroundColor: c.backgroundSelected,
    borderWidth: 1,
    borderColor: c.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontFamily: Fonts.bold, fontSize: 16 },
  labelSm: { fontSize: 14 },
});
