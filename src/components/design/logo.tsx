import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Gradients } from '@/constants/theme';
import { APP_NAME } from '@/constants/app';

/** App mark + wordmark (the Figma file's own brand is not reused). */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const mark = size === 'lg' ? 44 : 30;
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={APP_NAME}>
      <LinearGradient
        colors={Gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mark, { width: mark, height: mark, borderRadius: mark * 0.32 }]}>
        <Ionicons name="heart" size={mark * 0.58} color="#fff" />
      </LinearGradient>
      <Text style={[styles.word, size === 'lg' && styles.wordLg]}>{APP_NAME.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { alignItems: 'center', justifyContent: 'center' },
  word: { fontFamily: Fonts.bold, fontSize: 15, letterSpacing: 2.5, color: Colors.light.text },
  wordLg: { fontSize: 20, letterSpacing: 3 },
});
