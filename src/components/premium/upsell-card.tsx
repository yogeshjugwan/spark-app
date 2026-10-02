import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { ApiError } from '@/lib/api';

/** True when an API error is a Spark+ limit (402) rather than a real failure. */
export const isPaywallError = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 402;

/** Friendly "you're out of likes" upgrade card shown in place of an error banner. */
export function UpsellCard({ feature = 'daily_likes' }: { feature?: string }) {
  const open = () => router.push({ pathname: '/premium', params: { feature } });
  return (
    <Pressable onPress={open} style={{margin:16}} accessibilityRole="button" accessibilityLabel="Out of likes. Get Spark+ for unlimited likes">
      <LinearGradient colors={['#FF7EB3', '#D65DB1', '#8E5CF7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="heart" size={26} color="#D65DB1" />
          <View style={styles.bolt}>
            <Ionicons name="flash" size={12} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>You’re on fire today 🔥</Text>
          <Text style={styles.sub}>Out of free likes. Go unlimited and see who already likes you.</Text>
        </View>
        <View style={styles.btn}>
          <Text style={styles.btnText}>Get Spark+</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, shadowColor: '#D65DB1', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bolt: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFB020', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  title: { fontFamily: Fonts.extrabold, fontSize: 15, color: '#fff' },
  sub: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  btn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  btnText: { fontFamily: Fonts.extrabold, fontSize: 12, color: '#D65DB1' },
});
