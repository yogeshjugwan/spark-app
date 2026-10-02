import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

type Pos = number | `${number}%`;
type Glow = { rgb: string; alpha: number; size: number; top?: Pos; left?: Pos; right?: Pos; bottom?: Pos };

// The soft pink/peach glows behind every Figma frame. Drawn as radial gradients
// (fading to transparent) rather than blurred circles: identical on iOS and
// Android, and no runtime blur cost.
const GLOWS: Glow[] = [
  { rgb: '246,166,201', alpha: 0.85, size: 380, top: '4%', right: -170 }, // pink, upper right
  { rgb: '248,180,140', alpha: 0.7, size: 320, top: '48%', left: -170 }, // peach, left
  { rgb: '246,166,201', alpha: 0.55, size: 300, bottom: '6%', right: -120 }, // pink, lower right
  { rgb: '217,198,242', alpha: 0.7, size: 360, top: -160, left: -140 }, // lilac, top left
];

/** Lavender page with soft colour glows, as in the Figma "Liquid Glass" frames. */
export function AppBackground({ children, style }: { children?: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.root, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {GLOWS.map((g, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: g.size,
              height: g.size,
              top: g.top,
              left: g.left,
              right: g.right,
              bottom: g.bottom,
              experimental_backgroundImage: `radial-gradient(circle, rgba(${g.rgb},${g.alpha}) 0%, rgba(${g.rgb},${g.alpha * 0.45}) 35%, rgba(${g.rgb},0) 70%)`,
            }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background, overflow: 'hidden' },
});
