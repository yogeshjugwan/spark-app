import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Colors, Gradients } from '@/constants/theme';

/**
 * The pink bubble from the Figma cards (next to "Sakura, 23" and on grid tiles).
 * In Spark it's the Like button; filled once you've liked someone.
 */
export function LikeButton({
  liked,
  loading,
  onPress,
  size = 36,
  label,
}: {
  liked: boolean;
  loading?: boolean;
  onPress: () => void;
  size?: number;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={liked || loading}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={liked ? `You liked ${label}` : `Like ${label}`}
      accessibilityState={{ selected: liked, busy: !!loading }}
      style={({ pressed }) => [styles.shadow, { borderRadius: size / 2, opacity: pressed ? 0.85 : 1 }]}>
      <LinearGradient
        colors={liked ? ['#FFFFFF', '#FFFFFF'] : Gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
        {loading ? (
          <ActivityIndicator size="small" color={liked ? Colors.light.primary : '#fff'} />
        ) : (
          <Ionicons name="heart" size={size * 0.5} color={liked ? Colors.light.primary : '#fff'} />
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#C24C99',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bubble: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
});
