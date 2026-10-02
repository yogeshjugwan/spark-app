import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { buyPlay, loadPlayOffers, playBillingAvailable, restorePlay } from '@/lib/play-billing';
import { clearOutOfLikes } from '@/lib/use-discovery';
import { featureValue, subscriptionApi, subscriptionKeys } from '@/lib/subscription-api';

const c = Colors.light;
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const HIGHLIGHT: Record<string, string> = {
  daily_likes: 'You’re out of likes for today',
  see_likes: 'See everyone who liked you',
  rewind: 'Undo your last pass',
  story_viewers: 'See who viewed your status',
};

/** Spark+ paywall / membership screen. Plans, prices and features all come from the DB. */
export default function PremiumScreen() {
  const feature = useLocalSearchParams<{ feature?: string }>().feature;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: subscriptionKeys.overview, queryFn: async () => (await subscriptionApi.overview()).data });
  const d = q.data;
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Real billing (not test mode): prices and purchase go through Google Play.
  const store = !!d && !d.testPurchases;
  const offers = useQuery({
    queryKey: ['play-offers', d?.billing.playProductId],
    queryFn: () => loadPlayOffers(d!.billing.playProductId),
    enabled: store && playBillingAvailable,
    retry: false,
  });
  const plans = (d?.plans ?? []).filter((p) => !store || offers.data?.[p.code]);
  const chosen = plan ?? plans.find((p) => p.badge)?.code ?? plans[0]?.code ?? null;

  const refresh = (next: typeof d) => {
    if (next?.premium) clearOutOfLikes();
    qc.setQueryData(subscriptionKeys.overview, next);
    qc.invalidateQueries({ queryKey: subscriptionKeys.likesYou });
    qc.invalidateQueries({ queryKey: ['discover'] });
  };
  const buy = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      if (store) {
        const offer = offers.data?.[chosen];
        if (!offer) throw new Error('This plan isn’t available in Google Play yet');
        refresh(await buyPlay(d!.billing.playProductId, offer, d!.billing.accountId));
      } else refresh((await subscriptionApi.subscribe(chosen)).data);
      Alert.alert('Welcome to Spark+ 💖', 'Your new features are unlocked.');
    } catch (e) {
      Alert.alert('Couldn’t subscribe', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    try {
      const r = await restorePlay(d!.billing.playProductId);
      if (r) refresh(r);
      Alert.alert(r?.premium ? 'Spark+ restored' : 'Nothing to restore', r?.premium ? undefined : 'No Spark+ purchase was found on this Google account.');
    } catch (e) {
      Alert.alert('Couldn’t restore', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  // Play subscriptions are managed (cancelled / changed) in Google Play, like every Android app.
  const manage = () => Linking.openURL(`https://play.google.com/store/account/subscriptions?sku=${d!.billing.playProductId}&package=app.spark.dating`);
  const cancel = () =>
    Alert.alert('Cancel Spark+?', 'You keep your features until the end of the period you’ve paid for.', [
      { text: 'Keep Spark+', style: 'cancel' },
      { text: 'Cancel renewal', style: 'destructive', onPress: async () => refresh((await subscriptionApi.cancel()).data) },
    ]);

  const selected = plans.find((p) => p.code === chosen);
  const priceOf = (p: (typeof plans)[number]) => (store ? offers.data?.[p.code]?.displayPrice : inr(p.priceInr));

  return (
    <View style={styles.flex}>
      <LinearGradient colors={['#2A0F3D', '#6B1F6E', '#D65DB1']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
        {!d ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 60 }} />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.hero}>
                <View style={styles.crown}>
                  <Ionicons name="diamond" size={34} color="#fff" />
                </View>
                <Text style={styles.heroTitle}>
                  Spark<Text style={{ color: '#FFB6E1' }}>+</Text>
                </Text>
                <Text style={styles.heroSub}>{feature && HIGHLIGHT[feature] ? HIGHLIGHT[feature] : 'Meet more people, faster'}</Text>
                <Text style={styles.heroHint}>Members get up to 3× more matches</Text>
              </View>

              {!d.enabled && (
                <View style={styles.note}>
                  <Ionicons name="gift-outline" size={18} color="#fff" />
                  <Text style={styles.noteText}>All Spark+ features are free for everyone right now.</Text>
                </View>
              )}

              {d.subscription && (
                <View style={styles.current}>
                  <Ionicons name="checkmark-circle" size={22} color="#7CF2B0" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentTitle}>You’re on Spark+ · {d.subscription.plan}</Text>
                    <Text style={styles.currentSub}>
                      {d.subscription.status === 'cancelled' ? 'Ends' : 'Renews'} {new Date(d.subscription.expiresAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.perks}>
                {d.features.map((f) => (
                  <View key={f.key} style={[styles.perk, feature === f.key && styles.perkOn]}>
                    <View style={styles.perkIcon}>
                      <Ionicons name={PERK_ICON[f.key] ?? 'sparkles'} size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.perkTitle}>{f.label}</Text>
                      <Text style={styles.perkFree}>{f.free === 0 ? "Spark+ only" : `Free: ${featureValue(f.free, f.key === "daily_likes")}`}</Text>
                    </View>
                    <Text style={styles.perkPlus}>{featureValue(f.premium, f.key === 'daily_likes')}</Text>
                  </View>
                ))}
              </View>

              {!d.premium && (
                <>
                  {store && !playBillingAvailable && <Text style={styles.fine}>Get Spark+ in the Spark Android app.</Text>}
                  {store && offers.isLoading && <ActivityIndicator color="#fff" />}
                  {store && offers.error && <Text style={styles.fine}>Couldn’t reach Google Play: {offers.error.message}</Text>}
                  <View style={styles.plans}>
                    {plans.map((p) => {
                      const on = chosen === p.code;
                      return (
                        <Pressable key={p.code} onPress={() => setPlan(p.code)} style={[styles.plan, on && styles.planOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                          {!!p.badge && (
                            <LinearGradient colors={['#FFB020', '#FF7EB3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
                              <Text style={styles.badgeText}>{p.badge}</Text>
                            </LinearGradient>
                          )}
                          <Text style={[styles.planName, on && styles.planInk]}>{p.name}</Text>
                          <Text style={[styles.price, on && styles.planInk]}>{priceOf(p)}</Text>
                          {!store && <Text style={[styles.planPer, on && { color: c.textSecondary }]}>{inr(Math.round(p.priceInr / Math.max(1, p.periodDays / 7)))}/wk</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              {d.subscription?.source === 'play' ? (
                <Pressable onPress={manage} style={styles.link} accessibilityRole="button">
                  <Text style={styles.linkText}>Manage in Google Play</Text>
                </Pressable>
              ) : (
                d.subscription?.status === 'active' && (
                  <Pressable onPress={cancel} style={styles.link} accessibilityRole="button">
                    <Text style={styles.linkText}>Cancel subscription</Text>
                  </Pressable>
                )
              )}
            </ScrollView>

            {!d.premium && (
              <View style={styles.footer}>
                <Pressable onPress={buy} disabled={busy || !chosen} style={styles.cta} accessibilityRole="button">
                  <LinearGradient colors={['#FFFFFF', '#FFE3F3']} style={styles.ctaInner}>
                    {busy ? (
                      <ActivityIndicator color={c.primary} />
                    ) : (
                      <Text style={styles.ctaText}>
                        Continue{selected && priceOf(selected) ? ` · ${priceOf(selected)}` : ''}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
                <Text style={styles.fine}>{d.testPurchases ? 'Test mode: no payment is taken.' : 'Billed through Google Play · Cancel anytime'}</Text>
                {!d.testPurchases && playBillingAvailable && (
                  <Pressable onPress={restore} disabled={busy} accessibilityRole="button">
                    <Text style={styles.linkText}>Restore purchase</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const PERK_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  daily_likes: 'infinite',
  see_likes: 'eye',
  rewind: 'arrow-undo',
  story_viewers: 'people',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, alignItems: 'flex-end' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.four },
  hero: { alignItems: 'center', gap: 4 },
  crown: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', marginBottom: 6 },
  heroTitle: { fontFamily: Fonts.extrabold, fontSize: 40, color: '#fff', letterSpacing: 0.5 },
  heroSub: { fontFamily: Fonts.bold, fontSize: 17, color: '#fff', textAlign: 'center' },
  heroHint: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  noteText: { flex: 1, fontFamily: Fonts.semibold, fontSize: 14, color: '#fff' },
  current: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)' },
  currentTitle: { fontFamily: Fonts.bold, fontSize: 16, color: '#fff' },
  currentSub: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  perks: { borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16 },
  perkOn: { backgroundColor: 'rgba(255,255,255,0.16)' },
  perkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
  perkFree: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  perkPlus: { fontFamily: Fonts.extrabold, fontSize: 14, color: '#FFB6E1' },
  plans: { flexDirection: 'row', gap: 10, paddingTop: 10 },
  plan: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 18, paddingHorizontal: 6, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.08)' },
  planOn: { backgroundColor: '#fff', borderColor: '#FFB6E1', transform: [{ scale: 1.04 }] },
  planName: { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
  planInk: { color: c.text },
  price: { fontFamily: Fonts.extrabold, fontSize: 20, color: '#fff' },
  planPer: { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  badge: { position: 'absolute', top: -11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontFamily: Fonts.extrabold, fontSize: 10, color: '#fff' },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two, gap: 8, alignItems: 'center' },
  cta: { alignSelf: 'stretch', borderRadius: 30, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  ctaInner: { paddingVertical: 17, alignItems: 'center' },
  ctaText: { fontFamily: Fonts.extrabold, fontSize: 17, color: c.primary },
  fine: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  link: { alignItems: 'center', padding: 10 },
  linkText: { fontFamily: Fonts.semibold, fontSize: 14, color: '#fff', textDecorationLine: 'underline' },
});
