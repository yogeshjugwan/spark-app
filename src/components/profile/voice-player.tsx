import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Fonts, Radius } from '@/constants/theme';

const c = Colors.light;

/** The Figma "Hear her voice" pill: tap to play/stop a voice clip. */
export function VoicePlayer({
  uri,
  label = 'Hear my voice',
  durationSec,
  compact,
}: {
  uri: string;
  label?: string;
  durationSec?: number | null;
  /** Small pill for tight spots (Recommendations row); hides the duration. */
  compact?: boolean;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  // Rewind when a clip finishes so the next tap plays from the start.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      player.seekTo(0);
      return;
    }
    // If the "finished" event was missed, the player sits at the end and play() is a no-op.
    const atEnd = status.duration > 0 && status.currentTime >= status.duration - 0.25;
    if (atEnd || status.didJustFinish) player.seekTo(0);
    player.play();
  };

  const secs = durationSec ?? Math.round(status.duration || 0);
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Stop voice intro' : `${label}${secs ? `, ${secs} seconds` : ''}`}
      style={({ pressed }) => [styles.pill, compact && styles.pillCompact, pressed && { opacity: 0.8 }]}>
      <Ionicons name={status.playing ? 'stop-circle' : 'volume-high'} size={compact ? 12 : 15} color={c.primary} />
      <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={1}>
        {status.playing ? 'Playing…' : label}
        {secs && !status.playing && !compact ? ` · ${secs}s` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  pillCompact: { alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  text: { fontFamily: Fonts.bold, fontSize: 13, color: c.text },
  textCompact: { fontSize: 10 },
});
