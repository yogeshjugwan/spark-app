import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { EmptyState } from '@/components/design/empty-state';
import { GlassCard } from '@/components/design/glass-card';
import { VoicePlayer } from '@/components/profile/voice-player';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { countryName, flagEmoji } from '@/lib/countries';
import { discoveryApi } from '@/lib/discovery-api';
import { mediaUrl } from '@/lib/media';
import { possessive } from '@/lib/pronoun';
import { discoveryKeys, useSwipe } from '@/lib/use-discovery';
import { useFrameSize } from '@/components/ui/web-frame';

const c = Colors.light;

/** Someone's full profile: photo gallery, details, voice, interests, like/pass, block. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const { width } = useFrameSize();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const swipe = useSwipe();

  const q = useQuery({
    queryKey: discoveryKeys.profile(userId),
    queryFn: async () => (await discoveryApi.profile(userId)).data.profile,
  });

  const afterSafetyAction = () => {
    qc.invalidateQueries({ queryKey: discoveryKeys.all });
    qc.invalidateQueries({ queryKey: discoveryKeys.matches });
    router.back();
  };
  const block = useMutation({ mutationFn: () => discoveryApi.block(userId), onSuccess: afterSafetyAction });
  const unmatch = useMutation({ mutationFn: (matchId: number) => discoveryApi.unmatch(matchId), onSuccess: afterSafetyAction });

  const p = q.data;

  const openMenu = () => {
    if (!p) return;
    Alert.alert(p.name, undefined, [
      ...(p.matchId
        ? [{ text: 'Unmatch', style: 'destructive' as const, onPress: () => unmatch.mutate(p.matchId!) }]
        : []),
      {
        text: `Block ${p.name}`,
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Block ${p.name}?`, "You won't see each other anywhere on Spark, and any match ends.", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Block', style: 'destructive', onPress: () => block.mutate() },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const decide = (action: 'like' | 'pass') =>
    swipe.mutate({ userId, action }, { onSuccess: (res) => !res.data.matched && action === 'pass' && router.back() });

  const photoH = Math.min(width * 1.25, 560);

  return (
    <AppBackground>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          title: '',
          headerTintColor: '#fff',
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () =>
            p ? (
              <Pressable onPress={openMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options" style={styles.menuBtn}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
              </Pressable>
            ) : null,
        }}
      />
      {q.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : q.error || !p ? (
        <SafeAreaView style={styles.flex}>
          <EmptyState icon="person-remove-outline" title="Profile unavailable" body={q.error?.message ?? 'This profile is no longer available.'} />
        </SafeAreaView>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Swipeable photo gallery with page dots. */}
            <View style={{ height: photoH }}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
                {p.photos.map((ph, i) => (
                  <Image
                    key={ph.id}
                    source={mediaUrl(ph.url)}
                    style={{ width, height: photoH }}
                    contentFit="cover"
                    transition={150}
                    accessibilityLabel={`${p.name}'s photo ${i + 1} of ${p.photos.length}`}
                  />
                ))}
              </ScrollView>
              <LinearGradient colors={['rgba(20,12,30,0.45)', 'rgba(20,12,30,0)']} style={styles.topFade} pointerEvents="none" />
              <LinearGradient colors={['rgba(20,12,30,0)', 'rgba(20,12,30,0.75)']} style={styles.bottomFade} pointerEvents="none" />
              <View style={styles.dots} pointerEvents="none">
                {p.photos.map((ph, i) => (
                  <View key={ph.id} style={[styles.dot, i === page && styles.dotOn]} />
                ))}
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.name}>
                  {p.name}, {p.age}
                </Text>
                {p.countryCode && (
                  <View style={styles.natRow}>
                    <View style={styles.flagDot}>
                      <Text style={styles.flag}>{flagEmoji(p.countryCode)}</Text>
                    </View>
                    <Text style={styles.nat}>{countryName(p.countryCode)}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.content}>
              {p.matchId && (
                <View style={styles.matchBanner}>
                  <Ionicons name="heart" size={16} color="#fff" />
                  <Text style={styles.matchText}>You matched with {p.name}</Text>
                </View>
              )}

              <View style={styles.facts}>
                {p.jobTitle && <Fact icon="briefcase-outline" text={p.jobTitle} />}
                {p.city && <Fact icon="location-outline" text={p.city} />}
                {p.distanceKm !== null && <Fact icon="navigate-outline" text={`${p.distanceKm} km away`} />}
                <Fact icon="heart-outline" text={`${p.likeCount} likes`} />
              </View>

              {p.voice && <VoicePlayer uri={mediaUrl(p.voice.url)!} label={`Hear ${possessive(p.gender)} voice`} durationSec={p.voice.durationSec} />}

              {p.bio && (
                <GlassCard style={styles.card}>
                  <ThemedText type="smallBold">About {p.name}</ThemedText>
                  <ThemedText type="small">{p.bio}</ThemedText>
                </GlassCard>
              )}

              {p.interests.length > 0 && (
                <GlassCard style={styles.card}>
                  <ThemedText type="smallBold">
                    Interests{p.sharedInterests > 0 ? ` · ${p.sharedInterests} in common` : ''}
                  </ThemedText>
                  <View style={styles.chips}>
                    {p.interests.map((i) => (
                      <View key={i.id} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {i.emoji} {i.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              )}
              <FormMessage message={swipe.error?.message ?? block.error?.message ?? unmatch.error?.message} />
            </View>
          </ScrollView>

          {!p.matchId && (
            <SafeAreaView edges={['bottom']} style={styles.actions}>
              <Button title="Pass" variant="secondary" icon="close" style={styles.flex} disabled={swipe.isPending} onPress={() => decide('pass')} />
              <Button
                title={p.youLiked ? 'Liked' : 'Like'}
                icon="heart"
                style={styles.flex}
                disabled={p.youLiked}
                loading={swipe.isPending && swipe.variables?.action === 'like'}
                onPress={() => decide('like')}
              />
            </SafeAreaView>
          )}
        </>
      )}
    </AppBackground>
  );
}

function Fact({ icon, text }: { icon: 'briefcase-outline' | 'location-outline' | 'navigate-outline' | 'heart-outline'; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={c.primary} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: 160 },
  scroll: { paddingBottom: 120 },
  menuBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 },
  dots: { position: 'absolute', top: 100, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: '#fff' },
  heroInfo: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three, gap: 6 },
  name: { fontFamily: Fonts.extrabold, fontSize: 30, color: '#fff' },
  natRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flagDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  flag: { fontSize: 14 },
  nat: { fontFamily: Fonts.semibold, fontSize: 15, color: 'rgba(255,255,255,0.92)' },
  content: { padding: Spacing.three, gap: Spacing.three },
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: c.primary,
  },
  matchText: { fontFamily: Fonts.bold, fontSize: 13, color: '#fff' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  factText: { fontFamily: Fonts.semibold, fontSize: 13, color: c.text },
  card: { padding: Spacing.three, gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: c.borderStrong },
  chipText: { fontFamily: Fonts.semibold, fontSize: 13, color: c.text },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    backgroundColor: 'rgba(241,236,244,0.94)',
  },
});
