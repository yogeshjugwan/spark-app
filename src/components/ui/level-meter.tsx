import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

const c = Colors.light;

/** Live mic level so a silent mic is obvious while recording. */
export function LevelMeter({ level, color = c.primary }: { level: number; color?: string }) {
  const bars = 24;
  return (
    <View style={styles.meter} accessibilityLabel="Microphone level">
      {Array.from({ length: bars }, (_, i) => {
        const shape = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7));
        return <View key={i} style={[styles.meterBar, { backgroundColor: color, height: 4 + 24 * level * shape }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 30 },
  meterBar: { width: 4, borderRadius: 2 },
});
