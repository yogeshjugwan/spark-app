import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { EmptyState } from '@/components/design/empty-state';
import { GlassCard } from '@/components/design/glass-card';
import { Logo } from '@/components/design/logo';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';
import { discoveryApi } from '@/lib/discovery-api';
import { mediaUrl } from '@/lib/media';
import { useFrameSize } from '@/components/ui/web-frame';

const c = Colors.light;
const GAP = 12;

/**
 * Guest browsing from the Figma welcome screen's "Explore now". Photos are
 * blurred on the server — the real ones never reach a device without an account.
 */
export default function GuestExploreScreen() {
  const { width } = useFrameSize();
  const colW = (Math.min(width, 520) - Spacing.three * 2 - GAP) / 2;

  const q = useQuery({
    queryKey: ['public', 'explore'],
    queryFn: async () => (await discoveryApi.guestExplore()).data.profiles,
  });

  return (
    <AppBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </Pressable>
          <Logo />
          {/* The Figma "Login" pill. */}
          <Pressable onPress={() => router.push('/login')} accessibilityRole="button" accessibilityLabel="Log in">
            <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loginPill}>
              <Text style={styles.loginText}>Login</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="heading" style={styles.title} accessibilityRole="header">
            Explore 🔎
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            A peek at who&apos;s on Spark. Create an account to see full profiles, like people and chat.
          </ThemedText>

          {q.isLoading ? (
            <ActivityIndicator color={c.primary} style={styles.loading} />
          ) : q.error ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load" body={q.error.message} action={<Button title="Try again" size="sm" onPress={() => q.refetch()} />} />
          ) : (
            <View style={styles.grid}>
              {q.data?.map((p, i) => (
                <View
                  key={`${p.firstName}-${i}`}
                  style={[styles.tile, { width: colW, height: colW * (i % 4 === 0 || i % 4 === 3 ? 1.4 : 1.15) }]}
                  accessibilityLabel={`${p.firstName}, ${p.age}. Sign up to see their profile`}>
                  <Image source={mediaUrl(p.blurUrl)} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={8} />
                  <LinearGradient colors={['rgba(20,12,30,0)', 'rgba(20,12,30,0.65)']} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
                  <View style={styles.lock}>
                    <Ionicons name="lock-closed" size={14} color={c.primary} />
                  </View>
                  <Text style={styles.name}>
                    {p.firstName}, {p.age}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
          <GlassCard style={styles.cta}>
            <ThemedText type="smallBold">Like what you see?</ThemedText>
            <Button title="Create account" icon="sparkles" onPress={() => router.push('/signup')} />
          </GlassCard>
        </SafeAreaView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  loginPill: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: Radius.pill },
  loginText: { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
  scroll: { paddingBottom: 170 },
  title: { paddingHorizontal: Spacing.three, marginTop: Spacing.two },
  subtitle: { paddingHorizontal: Spacing.three, marginTop: 4, marginBottom: Spacing.three },
  loading: { marginTop: Spacing.six },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: Spacing.three },
  tile: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#EADCF0' },
  lock: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { position: 'absolute', left: 12, bottom: 10, fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
  ctaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  cta: { padding: Spacing.three, gap: Spacing.two },
});
