/**
 * Design tokens taken from the "Liquid Glass" Figma design: soft lavender
 * background with blurred pink/peach blobs, frosted-glass cards, navy-purple
 * text, and a pink→magenta accent gradient. The design is light-only.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  text: '#2A2046', // navy-purple headings and body
  textSecondary: '#7A7190', // muted captions ("Online", timestamps)
  textOnAccent: '#FFFFFF',
  background: '#F1ECF4', // lavender page
  backgroundElement: 'rgba(255,255,255,0.55)', // glass fill
  backgroundSelected: 'rgba(255,255,255,0.8)',
  border: 'rgba(255,255,255,0.75)', // glass edge
  borderStrong: '#DCD4E4', // inputs, chips
  primary: '#D65DB1', // magenta accent (send icon, active states)
  primaryText: '#FFFFFF',
  pinkSoft: '#F7A8D3',
  danger: '#D93A5E',
  success: '#3B9C6A',
  overlay: 'rgba(42,32,70,0.35)',
} as const;

// Same palette in both modes: the design has no dark variant, and app.json locks light mode.
export const Colors = { light: palette, dark: palette } as const;

export type ThemeColor = keyof typeof palette;

/** Accent gradients (top-left → bottom-right). */
export const Gradients = {
  primary: ['#F59AD0', '#E063B2'] as const, // pink pill buttons ("Login")
  hero: ['#F4C8E6', '#EC6FB9', '#E4549F'] as const, // welcome screen lower panel
  blobPink: '#F6A6C9',
  blobPeach: '#F8B48C',
  blobLilac: '#D9C6F2',
};

/** Manrope, loaded in the root layout. Use these instead of fontWeight. */
export const Fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 480;
