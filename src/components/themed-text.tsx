import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'heading' | 'small' | 'smallBold' | 'caption' | 'link' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: type === 'link' ? theme.primary : theme[themeColor ?? 'text'] },
        styles[type],
        style,
      ]}
      {...rest}
    />
  );
}

// Type scale measured from the Figma frames (Manrope throughout).
const styles = StyleSheet.create({
  title: { fontFamily: Fonts.extrabold, fontSize: 30, lineHeight: 38 },
  subtitle: { fontFamily: Fonts.bold, fontSize: 26, lineHeight: 34 },
  heading: { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 26 },
  default: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
  link: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 22 },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
});
