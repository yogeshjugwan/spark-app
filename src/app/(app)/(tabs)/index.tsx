import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { EmptyState } from '@/components/design/empty-state';
import { TabHeader } from '@/components/design/tab-header';
import { TabScreen } from '@/components/design/tab-screen';
import { ExploreTile } from '@/components/discovery/explore-tile';
import { RecommendationBubble } from '@/components/discovery/recommendation-bubble';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { isPaywallError, UpsellCard } from '@/components/premium/upsell-card';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { discoveryApi } from '@/lib/discovery-api';
import { discoveryKeys, useSwipe, useSyncLocation } from '@/lib/use-discovery';
import type { DiscoverProfile } from '@/lib/types';
import { useFrameSize } from '@/components/ui/web-frame';

const c = Colors.light;
const GAP = 12;

function IconButton({ icon, label, onPress, active }: { icon: 'search' | 'options-outline' | 'close'; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={[styles.iconBtn, active && styles.iconBtnOn]}>
      <Ionicons name={icon} size={19} color={active ? '#fff' : c.text} />
    </Pressable>
  );
}

/** Explore (Figma frame 2): Recommendations row + masonry photo grid. */
export default function ExploreScreen() {
  useSyncLocation();
  const { width } = useFrameSize();
  const colW = (Math.min(width, 520) - Spacing.three * 2 - GAP) / 2;
  const swipe = useSwipe();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const recs = useQuery({
    queryKey: discoveryKeys.recommendations,
    queryFn: async () => (await discoveryApi.recommendations()).data.profiles,
  });

  const explore = useInfiniteQuery({
    queryKey: discoveryKeys.explore,
    queryFn: async ({ pageParam }) => (await discoveryApi.explore(pageParam)).data,
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const people = useMemo(() => {
    const all = explore.data?.pages.flatMap((p) => p.items) ?? [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q) || p.interests.some((i) => i.label.toLowerCase().includes(q))) : all;
  }, [explore.data, query]);

  // Two columns with alternating tall/short tiles, like the Figma grid.
  const [left, right] = useMemo(() => {
    const cols: [DiscoverProfile[], DiscoverProfile[]] = [[], []];
    people.forEach((p, i) => cols[i % 2].push(p));
    return cols;
  }, [people]);
  const tileHeight = (col: 0 | 1, i: number) => colW * ((i + col) % 2 === 0 ? 1.45 : 1.15);

  const like = (id: number) => swipe.mutate({ userId: id, action: 'like' });
  const liking = (id: number) => swipe.isPending && swipe.variables?.userId === id;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y > contentSize.height - 600 && explore.hasNextPage && !explore.isFetchingNextPage) {
      explore.fetchNextPage();
    }
  };

  const refreshing = (recs.isRefetching || explore.isRefetching) && !explore.isFetchingNextPage;
  const needsProfile = (explore.error as { status?: number } | null)?.status === 403;

  return (
    <TabScreen>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={200}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              recs.refetch();
              explore.refetch();
            }}
            tintColor={c.primary}
          />
        }>
        <TabHeader />

        {!!recs.data?.length && (
          <>
            <ThemedText type="heading" style={styles.section} accessibilityRole="header">
              Recommendations 🌟
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recs}>
              {recs.data.map((p) => (
                <RecommendationBubble key={p.id} person={p} onLike={() => like(p.id)} liking={liking(p.id)} />
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.exploreHeader}>
          <ThemedText type="heading" accessibilityRole="header">
            Explore 🔎
          </ThemedText>
          <View style={styles.row}>
            <IconButton
              icon={searching ? 'close' : 'search'}
              label={searching ? 'Close search' : 'Search'}
              active={searching}
              onPress={() => {
                setSearching((s) => !s);
                setQuery('');
              }}
            />
            <IconButton icon="options-outline" label="Filters" onPress={() => router.push('/filters')} />
          </View>
        </View>

        {searching && (
          <View style={styles.search}>
            <Ionicons name="search" size={17} color={c.textSecondary} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search names or interests"
              placeholderTextColor={c.textSecondary}
              style={styles.searchInput}
              accessibilityLabel="Search names or interests"
            />
          </View>
        )}

        {isPaywallError(swipe.error) ? <UpsellCard /> : <FormMessage message={swipe.error?.message} />}

        {explore.isLoading ? (
          <ActivityIndicator color={c.primary} style={styles.loading} />
        ) : needsProfile ? (
          <EmptyState icon="person-circle-outline" title="Finish your profile" body="Add your details and photos to start exploring." />
        ) : explore.error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load people"
            body={explore.error.message}
            action={<Button title="Try again" size="sm" onPress={() => explore.refetch()} />}
          />
        ) : people.length === 0 ? (
          <EmptyState
            icon="compass-outline"
            title={query ? 'No one matches that search' : 'No one nearby yet'}
            body={query ? 'Try another name or interest.' : 'Widen your age range or distance to see more people.'}
            action={!query ? <Button title="Adjust filters" size="sm" variant="secondary" onPress={() => router.push('/filters')} /> : undefined}
          />
        ) : (
          <View style={styles.grid}>
            {([left, right] as const).map((col, ci) => (
              <View key={ci} style={[styles.col, { width: colW }]}>
                {col.map((p, i) => (
                  <ExploreTile key={p.id} person={p} height={tileHeight(ci as 0 | 1, i)} onLike={() => like(p.id)} liking={liking(p.id)} />
                ))}
              </View>
            ))}
          </View>
        )}
        {explore.isFetchingNextPage && <ActivityIndicator color={c.primary} style={styles.loading} />}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.five },
  section: { paddingHorizontal: Spacing.three, marginTop: Spacing.three, marginBottom: Spacing.two },
  recs: { paddingHorizontal: Spacing.three, gap: 4, paddingTop: 4, paddingBottom: Spacing.two },
  exploreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
  iconBtnOn: { backgroundColor: c.primary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  grid: { flexDirection: 'row', justifyContent: 'center', gap: GAP, paddingHorizontal: Spacing.three },
  col: { gap: GAP },
  loading: { marginVertical: Spacing.four },
});
