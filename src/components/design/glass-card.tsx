import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

interface GlassCardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blur strength behind the card (0–100). */
  intensity?: number;
  radius?: number;
}

// Android's BlurView needs an explicit BlurTargetView and otherwise draws an
// unclipped box, so real blur is iOS-only; Android gets a denser white fill.
const USE_BLUR = Platform.OS === 'ios';

/** Frosted-glass panel: blur (iOS) + translucent white + bright hairline edge. */
export function GlassCard({ children, style, intensity = 40, radius = Radius.lg }: GlassCardProps) {
  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
        {USE_BLUR && <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, USE_BLUR ? styles.fill : styles.fillSolid]} />
      </View>
      <View style={[styles.edge, { borderRadius: radius }]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#6B4E8C',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    // No `elevation`: Android draws elevation shadows *through* translucent views,
    // which shows up as a grey box inside the glass.
  },
  fill: { backgroundColor: Colors.light.backgroundElement },
  fillSolid: { backgroundColor: 'rgba(255,255,255,0.72)' },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: Colors.light.border },
});
