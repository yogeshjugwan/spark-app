import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { GlassCard } from '@/components/design/glass-card';
import { Logo } from '@/components/design/logo';
import { Button } from '@/components/ui/button';
import { Colors, Fonts, Gradients, Spacing } from '@/constants/theme';
import { avatarUrl } from '@/lib/avatars';
import { useFrameSize } from '@/components/ui/web-frame';

const c = Colors.light;

/** Floating glass "notification" card from the Figma welcome frame. */
function Notice({ seed, name, line, icon, time }: { seed: string; name: string; line: string; icon?: 'heart' | 'chatbubble'; time: string }) {
  return (
    <GlassCard style={styles.notice} radius={18}>
      <Image source={avatarUrl(seed)} style={styles.noticeAvatar} contentFit="cover" />
      <View style={styles.flex}>
        <View style={styles.noticeTop}>
          <Text style={styles.noticeName}>{name}</Text>
          <Text style={styles.noticeTime}>{time}</Text>
        </View>
        <View style={styles.noticeLineRow}>
          {icon && <Ionicons name={icon} size={13} color={c.primary} />}
          <Text style={styles.noticeLine} numberOfLines={1}>
            {line}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

export default function WelcomeScreen() {
  const { width } = useFrameSize();
  const heroSize = Math.min(width * 0.46, 200);

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.top}>
          <Logo />
        </View>

        <View style={styles.notices}>
          <View style={styles.noticeRight}>
            <Notice seed="anna" name="Anna D." line="It's a match! Say hi 💕" icon="heart" time="18:16" />
          </View>
          <View style={styles.noticeLeft}>
            <Notice seed="aiko" name="Aiko B." line="Coffee this weekend? ☕" icon="chatbubble" time="18:15" />
          </View>
        </View>

        {/* Three portraits overlapping the curved panel, as in the design. */}
        <View style={styles.heroRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Image source={avatarUrl('maya', 400, { transparent: true })} style={[styles.heroSide, { width: heroSize * 0.78, height: heroSize * 0.9 }]} />
          <Image source={avatarUrl('sakura', 400, { transparent: true })} style={[styles.heroMain, { width: heroSize, height: heroSize * 1.1 }]} />
          <Image source={avatarUrl('lena', 400, { transparent: true })} style={[styles.heroSide, { width: heroSize * 0.78, height: heroSize * 0.9 }]} />
        </View>
      </SafeAreaView>

      <View style={styles.panelWrap}>
        {/* The convex top edge: a very wide ellipse clipped by the panel. */}
        <LinearGradient colors={Gradients.hero} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[styles.curve, { width: width * 1.8, left: -width * 0.4 }]} />
        <SafeAreaView edges={['bottom']} style={styles.panel}>
          <Text style={styles.headline}>Meet people who{'\n'}actually get you</Text>
          <Text style={styles.sub}>Real profiles, verified by phone or email. Match, chat, and plan the first date.</Text>
          <Button title="Explore now" variant="light" icon="compass" onPress={() => router.push('/guest')} style={styles.cta} />
          <Button title="Log in" variant="onAccent" onPress={() => router.push('/login')} style={styles.loginLink} />
        </SafeAreaView>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { alignItems: 'center', paddingTop: Spacing.three },
  notices: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, gap: Spacing.two },
  noticeRight: { alignSelf: 'flex-end', width: '78%' },
  noticeLeft: { alignSelf: 'flex-start', width: '82%' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  noticeAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff' },
  noticeTop: { flexDirection: 'row', justifyContent: 'space-between' },
  noticeName: { fontFamily: Fonts.bold, fontSize: 14, color: c.text },
  noticeTime: { fontFamily: Fonts.medium, fontSize: 11, color: c.textSecondary },
  noticeLineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  noticeLine: { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: c.text },
  heroRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: -30,
    zIndex: 2,
  },
  heroMain: { borderRadius: 24, marginHorizontal: -18, zIndex: 2 },
  heroSide: { borderRadius: 20, opacity: 0.95 },
  panelWrap: { overflow: 'hidden' },
  curve: { position: 'absolute', top: 0, height: 900, borderTopLeftRadius: 9999, borderTopRightRadius: 9999 },
  panel: { paddingTop: 48, paddingHorizontal: Spacing.four, alignItems: 'center', gap: Spacing.two },
  headline: { fontFamily: Fonts.extrabold, fontSize: 26, lineHeight: 33, color: '#fff', textAlign: 'center' },
  sub: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  cta: { alignSelf: 'stretch' },
  loginLink: { marginBottom: Spacing.one },
});
