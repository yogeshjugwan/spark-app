import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/design/glass-card';
import { LevelMeter } from '@/components/ui/level-meter';
import { VoicePlayer } from '@/components/profile/voice-player';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { mediaUrl } from '@/lib/media';
import { useProfileMutations } from '@/lib/use-profile';
import type { ProfileDetails } from '@/lib/types';
import { useVoiceRecording } from '@/lib/use-voice-recording';

const c = Colors.light;
const MAX_SECONDS = 60;
const MIN_SECONDS = 2;

/** Record, preview and save a voice intro (up to 60 s, M4A). */
export function VoiceRecorder({ current }: { current: ProfileDetails['voice'] }) {
  const { setVoice, deleteVoice } = useProfileMutations();
  const [take, setTake] = useState<{ uri: string; durationSec: number } | null>(null);
  const voice = useVoiceRecording({ maxSec: MAX_SECONDS, minSec: MIN_SECONDS, onTake: setTake });
  const { error, setError } = voice;
  const recording = voice.recording;
  const seconds = voice.elapsedSec;
  const starting = voice.phase === 'starting' || voice.phase === 'stopping';

  const start = () => {
    setTake(null);
    voice.start();
  };

  const save = () => {
    if (!take) return;
    setVoice.mutate(
      { file: { uri: take.uri, name: 'voice-intro.m4a', type: 'audio/mp4' }, durationSec: take.durationSec },
      { onSuccess: () => setTake(null), onError: (e) => setError(e.message) },
    );
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <Pressable
          onPress={recording ? voice.stop : start}
          disabled={starting}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
          style={[styles.mic, recording && styles.micOn]}>
          <Ionicons name={recording ? 'stop' : 'mic'} size={30} color="#fff" />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>{recording ? 'Recording…' : starting ? 'Starting…' : take ? 'Listen back' : current ? 'Your voice intro' : 'Tap to record'}</Text>
          <Text style={styles.sub}>
            {recording
              ? `0:${String(seconds).padStart(2, '0')} / 1:00`
              : take
                ? `${take.durationSec}s — save it or record again`
                : 'Say hi and one thing people should know about you.'}
          </Text>
        </View>
      </View>

      {recording && <LevelMeter level={voice.level} />}
      {recording && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, (seconds / MAX_SECONDS) * 100)}%` }]} />
        </View>
      )}

      {!recording && take && (
        <View style={styles.actions}>
          <VoicePlayer uri={take.uri} label="Play" durationSec={take.durationSec} />
          <Button title="Save voice intro" size="sm" loading={setVoice.isPending} onPress={save} />
        </View>
      )}

      {!recording && !take && current && (
        <View style={styles.actions}>
          <VoicePlayer uri={mediaUrl(current.url)!} label="Hear my voice" durationSec={current.durationSec} />
          <Button title="Remove" size="sm" variant="ghost" loading={deleteVoice.isPending} onPress={() => deleteVoice.mutate()} />
        </View>
      )}

      <FormMessage message={error} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({

  flex: { flex: 1 },
  card: { padding: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  mic: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: c.danger },
  title: { fontFamily: Fonts.bold, fontSize: 17, color: c.text },
  sub: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary, marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#F3D9EA', overflow: 'hidden' },
  fill: { height: 6, backgroundColor: c.primary },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
});
