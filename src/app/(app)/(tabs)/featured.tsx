import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/design/empty-state';
import { TabHeader } from '@/components/design/tab-header';
import { TabScreen } from '@/components/design/tab-screen';
import { LikeButton } from '@/components/discovery/like-button';
import { ProfileCard } from '@/components/profile/profile-card';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { isPaywallError, UpsellCard } from '@/components/premium/upsell-card';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { discoveryApi } from '@/lib/discovery-api';
import { discoveryKeys, useSwipe, useSyncLocation } from '@/lib/use-discovery';
import { possessive } from '@/lib/pronoun';
import type { DiscoverProfile } from '@/lib/types';
import { useFrameSize } from '@/components/ui/web-frame';
import { ApiError } from '@/lib/api';
import { subscriptionApi, subscriptionKeys } from '@/lib/subscription-api';

const c = Colors.light;
const GAP = 12;

/** Featured (Figma frame 3): big swipeable cards with the neighbours peeking in. */
export default function FeaturedScreen() {
  useSyncLocation();
  const { width, height } = useFrameSize();
  const cardW = Math.min(width - 64, 420);
  const cardH = Math.min(cardW * 1.38, height * 0.62);
  const sidePad = (width - cardW) / 2;
  const swipe = useSwipe();

  const feed = useQuery({
    queryKey: discoveryKeys.feed,
    queryFn: async () => (await discoveryApi.feed(10)).data.profiles,
  });

  // Top up the deck when it runs low (the API never returns people you've swiped).
  const remaining = feed.data?.length ?? 0;
  useEffect(() => {
    if (feed.isSuccess && remaining < 3 && !feed.isFetching) feed.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, feed.isSuccess]);

  // When liked/passed cards leave the list, the scroll offset can end up past
  // the last card (a blank screen). Snap back onto a real card.
  const listRef = useRef<FlatList<DiscoverProfile>>(null);
  const index = useRef(0);
  useEffect(() => {
    if (remaining > 0 && index.current > remaining - 1) {
      index.current = remaining - 1;
      listRef.current?.scrollToOffset({ offset: index.current * (cardW + GAP), animated: true });
    }
  }, [remaining, cardW]);

  const act = (p: DiscoverProfile, action: 'like' | 'pass') => swipe.mutate({ userId: p.id, action });
  const pending = (id: number) => swipe.isPending && swipe.variables?.userId === id;

  const renderCard = ({ item }: { item: DiscoverProfile }) => (
    <Pressable
      onPress={() => router.push(`/user/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.age}. Open profile`}
      style={{ width: cardW }}>
      <ProfileCard
        style={{ height: cardH, aspectRatio: undefined }}
        maxChips={3}
        voiceLabel={`Hear ${possessive(item.gender)} voice`}
        data={{
          name: item.name,
          age: item.age,
          countryCode: item.countryCode,
          photoUrl: item.photos[0]?.url ?? null,
          interests: item.interests,
          voice: item.voice,
        }}
        nameAccessory={<LikeButton liked={item.youLiked} loading={pending(item.id) && swipe.variables?.action === 'like'} onPress={() => act(item, 'like')} size={34} label={item.name} />}
        corner={
          <Pressable
            onPress={() => act(item, 'pass')}
            disabled={pending(item.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Pass on ${item.name}`}
            style={styles.pass}>
            <Ionicons name="close" size={20} color={c.text} />
          </Pressable>
        }
      />
      {(item.distanceKm !== null || item.sharedInterests > 0) && (
        <Text style={styles.meta}>
          {[item.distanceKm !== null && `${item.distanceKm} km away`, item.sharedInterests > 0 && `${item.sharedInterests} shared interest${item.sharedInterests > 1 ? 's' : ''}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}
    </Pressable>
  );

  const qc = useQueryClient();
  const likes = useQuery({ queryKey: subscriptionKeys.likesYou, queryFn: async () => (await subscriptionApi.likesYou()).data });
  // Spark+: bring back the last person you passed on (402 opens the paywall).
  const rewind = async () => {
    try {
      await subscriptionApi.rewind();
      await qc.invalidateQueries({ queryKey: ['discover'] });
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 402)) Alert.alert('Rewind', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <TabScreen>
      <TabHeader
        title="Featured"
        emoji="🔥"
        right={
          <View style={styles.headRow}>
            <Pressable onPress={rewind} style={styles.headBtn} accessibilityRole="button" accessibilityLabel="Rewind your last pass (Spark+)">
              <Ionicons name="arrow-undo" size={18} color={c.primary} />
            </Pressable>
            <Pressable onPress={() => router.push('/likes')} style={styles.likesBtn} accessibilityRole="button" accessibilityLabel={`Likes you${likes.data?.count ? `, ${likes.data.count}` : ''}`}>
              <Ionicons name="heart" size={16} color="#fff" />
              <Text style={styles.likesText}>{likes.data?.count ?? ''}</Text>
            </Pressable>
          </View>
        }
      />
      {isPaywallError(swipe.error) ? <UpsellCard /> : <FormMessage message={swipe.error?.message} />}
      {feed.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : feed.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load people"
          body={feed.error.message}
          action={<Button title="Try again" size="sm" onPress={() => feed.refetch()} />}
        />
      ) : remaining === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title="You're all caught up"
          body="You've seen everyone who fits your filters. Check back later, or widen your age range or distance."
          action={<Button title="Adjust filters" size="sm" variant="secondary" onPress={() => router.push('/filters')} />}
        />
      ) : (
        <View style={styles.deck}>
          <FlatList
            ref={listRef}
            onMomentumScrollEnd={(e) => (index.current = Math.round(e.nativeEvent.contentOffset.x / (cardW + GAP)))}
            data={feed.data}
            keyExtractor={(p) => String(p.id)}
            renderItem={renderCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePad, gap: GAP }}
          />
        </View>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.six },
  deck: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.five },
  pass: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 52 },
  headBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  likesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.primary },
  likesText: { fontFamily: Fonts.bold, fontSize: 13, color: '#fff' },
  meta: { fontFamily: Fonts.semibold, fontSize: 13, color: c.textSecondary, textAlign: 'center', marginTop: Spacing.two },
});
