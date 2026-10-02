import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { useFrameSize } from '@/components/ui/web-frame';
import { Colors, Fonts, Gradients, Spacing } from '@/constants/theme';
import { mediaUrl } from '@/lib/media';
import { subscriptionApi, subscriptionKeys } from '@/lib/subscription-api';

const c = Colors.light;

/** "Likes you": free members see blurred, anonymous cards and an upgrade button; Spark+ sees who. */
export default function LikesScreen() {
  const q = useQuery({ queryKey: subscriptionKeys.likesYou, queryFn: async () => (await subscriptionApi.likesYou()).data });
  const cell = (useFrameSize().width - Spacing.three * 2 - 12) / 2;
  const d = q.data;

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Text style={styles.title}>Likes you{d ? ` · ${d.count}` : ''}</Text>
        </View>
        {q.isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 50 }} />
        ) : !d || d.count === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color={c.textSecondary} />
            <Text style={styles.emptyText}>No new likes yet. Complete your profile and add a voice intro to stand out.</Text>
          </View>
        ) : (
          <FlatList
            data={d.people}
            numColumns={2}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: Spacing.three, gap: 12, paddingBottom: 140 }}
            columnWrapperStyle={{ gap: 12 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => (item.id ? router.push(`/user/${item.id}`) : router.push({ pathname: '/premium', params: { feature: 'see_likes' } }))}
                style={[styles.card, { width: cell, height: cell * 1.3 }]}
                accessibilityRole="button"
                accessibilityLabel={item.name ? `${item.name}, ${item.age}` : 'Someone liked you. Upgrade to see who'}>
                <Image source={mediaUrl(item.photoUrl)} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={item.id ? 0 : 18} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.shade} />
                {item.id ? (
                  <Text style={styles.name}>
                    {item.name}, {item.age}
                  </Text>
                ) : (
                  <Ionicons name="lock-closed" size={26} color="#fff" style={styles.lock} />
                )}
              </Pressable>
            )}
          />
        )}
        {d && !d.unlocked && d.count > 0 && (
          <SafeAreaView edges={['bottom']} style={styles.bottom}>
            <Pressable onPress={() => router.push({ pathname: '/premium', params: { feature: 'see_likes' } })} style={styles.cta} accessibilityRole="button">
              <LinearGradient colors={Gradients.primary} style={styles.ctaInner}>
                <Text style={styles.ctaText}>See who likes you · Spark+</Text>
              </LinearGradient>
            </Pressable>
          </SafeAreaView>
        )}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  title: { fontFamily: Fonts.bold, fontSize: 20, color: c.text },
  empty: { alignItems: 'center', gap: 12, marginTop: 80, paddingHorizontal: 30 },
  emptyText: { fontFamily: Fonts.medium, fontSize: 15, color: c.textSecondary, textAlign: 'center' },
  card: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#F6E6F1', justifyContent: 'flex-end' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  name: { fontFamily: Fonts.bold, fontSize: 16, color: '#fff', padding: 12 },
  lock: { position: 'absolute', alignSelf: 'center', top: '42%' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.three },
  cta: { borderRadius: 28, overflow: 'hidden' },
  ctaInner: { paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontFamily: Fonts.extrabold, fontSize: 16, color: '#fff' },
});
