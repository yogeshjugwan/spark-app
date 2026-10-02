import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/design/glass-card';
import { TabHeader } from '@/components/design/tab-header';
import { subscriptionApi, subscriptionKeys } from '@/lib/subscription-api';
import { TabScreen } from '@/components/design/tab-screen';
import { ProfileCard } from '@/components/profile/profile-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';
import { authApi } from '@/lib/auth-api';
import { useAuth } from '@/lib/auth-store';
import { mediaUrl } from '@/lib/media';
import { useOwnProfile } from '@/lib/use-profile';

const c = Colors.light;

const LOOKING_FOR = { women: 'Women', men: 'Men', everyone: 'Everyone' } as const;
const GENDER = { woman: 'Woman', man: 'Man', nonbinary: 'Non-binary' } as const;

function Row({
  icon,
  label,
  value,
  verified,
}: {
  icon: 'mail-outline' | 'call-outline' | 'logo-google' | 'briefcase-outline' | 'location-outline' | 'heart-outline' | 'person-outline';
  label: string;
  value: string | null;
  verified?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={c.primary} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold">{value ?? 'Not added'}</ThemedText>
      </View>
      {value && verified !== undefined && (
        <View style={[styles.chip, verified ? styles.chipOk : styles.chipPending]}>
          <Ionicons name={verified ? 'checkmark-circle' : 'time-outline'} size={13} color={verified ? c.success : c.textSecondary} />
          <Text style={[styles.chipText, { color: verified ? c.success : c.textSecondary }]}>{verified ? 'Verified' : 'Pending'}</Text>
        </View>
      )}
    </View>
  );
}

/** Spark+ status / upgrade entry (hidden when subscriptions are switched off in the DB). */
function SparkPlusCard() {
  const q = useQuery({ queryKey: subscriptionKeys.overview, queryFn: async () => (await subscriptionApi.overview()).data });
  const d = q.data;
  if (!d || !d.enabled) return null;
  return (
    <Pressable onPress={() => router.push('/premium')} accessibilityRole="button" style={{ borderRadius: 20, overflow: 'hidden' }}>
      <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
        <Ionicons name={d.premium ? 'diamond' : 'diamond-outline'} size={26} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.extrabold, fontSize: 17, color: '#fff' }}>{d.premium ? `Spark+ · ${d.subscription?.plan ?? 'active'}` : 'Get Spark+'}</Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
            {d.premium ? 'See who likes you, unlimited likes, rewind' : `See who likes you · unlimited likes · ${d.usage.likesToday} likes used today`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  // Required by Google Play: members can delete their account from inside the app.
  const confirmDelete = () =>
    Alert.alert('Delete your account?', 'Your profile, photos, matches and messages are deleted for good. This can’t be undone.\n\nIf you have Spark+, cancel it in Google Play too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: () => deleteAccount().catch((e: Error) => Alert.alert('Couldn’t delete your account', e.message)),
      },
    ]);
  const [signingOut, setSigningOut] = useState(false);
  const { profile, refetch, isRefetching } = useOwnProfile();

  // Account details (email/phone verification) come from /auth/me.
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  useEffect(() => {
    if (me.data) setUser(me.data.data.user);
  }, [me.data, setUser]);

  const logOut = async (everywhere: boolean) => {
    setSigningOut(true);
    await signOut({ everywhere });
  };

  const confirmLogOutAll = () =>
    Alert.alert('Log out everywhere?', 'You will be logged out on all your devices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out everywhere', style: 'destructive', onPress: () => logOut(true) },
    ]);

  if (!user || !profile) return null;
  const details = profile.profile;

  return (
    <TabScreen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || me.isRefetching}
            onRefresh={() => {
              refetch();
              me.refetch();
            }}
            tintColor={c.primary}
          />
        }>
        <TabHeader
          right={
            <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button" accessibilityLabel="Edit profile" style={styles.editBtn}>
              <Ionicons name="create-outline" size={18} color={c.primary} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          }
        />

        <View style={styles.content}>
          <SparkPlusCard />
          <ProfileCard
            maxChips={4}
            data={{
              name: profile.name,
              age: details?.age ?? null,
              countryCode: details?.countryCode ?? null,
              photoUrl: profile.photos[0]?.url ?? null,
              interests: profile.interests,
              voice: details?.voice ?? null,
            }}
          />

          {profile.photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {profile.photos.slice(1).map((p) => (
                <Image key={p.id} source={mediaUrl(p.url)} style={styles.thumb} contentFit="cover" />
              ))}
            </ScrollView>
          )}

          {details?.bio && (
            <GlassCard style={styles.card}>
              <ThemedText type="smallBold">About me</ThemedText>
              <ThemedText type="small">{details.bio}</ThemedText>
            </GlassCard>
          )}

          <GlassCard style={styles.card}>
            <ThemedText type="smallBold">Details</ThemedText>
            <Row icon="person-outline" label="Gender" value={details ? GENDER[details.gender] : null} />
            <Row icon="heart-outline" label="Looking for" value={details ? LOOKING_FOR[details.interestedIn] : null} />
            <Row icon="briefcase-outline" label="Work" value={details?.jobTitle ?? null} />
            <Row icon="location-outline" label="City" value={details?.city ?? null} />
          </GlassCard>

          <GlassCard style={styles.card}>
            <ThemedText type="smallBold">Account</ThemedText>
            <Row icon="mail-outline" label="Email" value={user.email} verified={user.isEmailVerified} />
            <Row icon="call-outline" label="Phone" value={user.phone} verified={user.isPhoneVerified} />
            <Row icon="logo-google" label="Google" value={user.hasGoogle ? 'Connected' : null} />
          </GlassCard>

          <View style={styles.actions}>
            <Button title="Edit profile" icon="create-outline" onPress={() => router.push('/edit-profile')} />
            <Button title="Log out" variant="secondary" icon="log-out-outline" loading={signingOut} onPress={() => logOut(false)} />
            <Button title="Log out on all devices" variant="ghost" disabled={signingOut} onPress={confirmLogOutAll} />
            <Button title="Delete account" variant="ghost" icon="trash-outline" disabled={signingOut} onPress={confirmDelete} />
          </View>
        </View>
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.five },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three, marginTop: Spacing.three },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  editText: { fontFamily: Fonts.bold, fontSize: 14, color: c.primary },
  strip: { gap: 10 },
  thumb: { width: 92, height: 115, borderRadius: Radius.md, backgroundColor: '#F6E6F1' },
  card: { padding: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  chipOk: { backgroundColor: 'rgba(59,156,106,0.12)' },
  chipPending: { backgroundColor: 'rgba(122,113,144,0.12)' },
  chipText: { fontFamily: Fonts.bold, fontSize: 12 },
  actions: { gap: Spacing.one },
});
