import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { VoicePlayer } from '@/components/profile/voice-player';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { countryName, flagEmoji } from '@/lib/countries';
import { mediaUrl } from '@/lib/media';
import type { Interest } from '@/lib/types';

export interface ProfileCardData {
  name: string;
  age: number | null;
  countryCode: string | null;
  photoUrl: string | null;
  interests: Interest[];
  voice?: { url: string; durationSec: number } | null;
}

/**
 * Full-bleed photo card from the Figma "Featured Characters" frame:
 * "Sakura, 23" + flag/nationality line + interest chips over a dark fade.
 * Used for your own profile now and the swipe deck in Phase 3.
 */
export function ProfileCard({
  data,
  style,
  corner,
  nameAccessory,
  voiceLabel = 'Hear my voice',
  maxChips = 3,
}: {
  data: ProfileCardData;
  style?: StyleProp<ViewStyle>;
  /** Top-right slot (e.g. the pass button on Featured cards). */
  corner?: ReactNode;
  /** Beside the name — the Figma puts the pink bubble here ("Sakura, 23 ●"). */
  nameAccessory?: ReactNode;
  /** Voice pill text: "Hear my voice" on your own card, "Hear her voice" on others'. */
  voiceLabel?: string;
  maxChips?: number;
}) {
  const nationality = countryName(data.countryCode);
  return (
    <View style={[styles.card, style]} accessibilityLabel={`${data.name}${data.age ? `, ${data.age}` : ''}`}>
      {data.photoUrl ? (
        <Image source={mediaUrl(data.photoUrl)} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noPhoto]} />
      )}
      <LinearGradient
        colors={['rgba(20,12,30,0)', 'rgba(20,12,30,0.25)', 'rgba(20,12,30,0.78)']}
        locations={[0.45, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {data.voice && (
        <View style={styles.voice}>
          <VoicePlayer uri={mediaUrl(data.voice.url)!} label={voiceLabel} durationSec={data.voice.durationSec} />
        </View>
      )}
      {corner && <View style={styles.corner}>{corner}</View>}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {data.name}
            {data.age ? `, ${data.age}` : ''}
          </Text>
          {nameAccessory}
        </View>
        {nationality && (
          <View style={styles.natRow}>
            <View style={styles.flagDot}>
              <Text style={styles.flag}>{flagEmoji(data.countryCode)}</Text>
            </View>
            <Text style={styles.nat}>{nationality}</Text>
          </View>
        )}
        {data.interests.length > 0 && (
          <View style={styles.chips}>
            {data.interests.slice(0, maxChips).map((i) => (
              <View key={i.id} style={styles.chip}>
                <Text style={styles.chipText}>{i.label}</Text>
              </View>
            ))}
            {data.interests.length > maxChips && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>+{data.interests.length - maxChips}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#E9DCEF', aspectRatio: 3 / 4 },
  noPhoto: { backgroundColor: '#E9DCEF' },
  voice: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  corner: { position: 'absolute', top: Spacing.three, right: Spacing.three },
  info: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flexShrink: 1, fontFamily: Fonts.extrabold, fontSize: 26, color: '#fff' },
  natRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flagDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  flag: { fontSize: 13 },
  nat: { fontFamily: Fonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.92)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipText: { fontFamily: Fonts.semibold, fontSize: 12, color: '#fff' },
});
