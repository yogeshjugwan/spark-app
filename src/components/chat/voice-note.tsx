import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { Colors, Fonts } from '@/constants/theme';

const c = Colors.light;
const SPEEDS = [1, 1.5, 2] as const;

/**
 * Shared voice-note state (WhatsApp): only one plays at a time, the chosen speed applies to all,
 * and when one finishes the next consecutive voice note starts by itself.
 */
export const useVoice = create<{ playing: number | null; request: number | null; speed: (typeof SPEEDS)[number]; queue: number[] }>(() => ({
  playing: null,
  request: null,
  speed: 1,
  queue: [],
}));
/** The chat screen tells us the order of voice notes on screen (oldest → newest). */
export const setVoiceQueue = (ids: number[]) => useVoice.setState({ queue: ids });
const cycleSpeed = () => useVoice.setState((s) => ({ speed: SPEEDS[(SPEEDS.indexOf(s.speed) + 1) % SPEEDS.length] }));

/** A fallback shape when the sender's phone didn't record levels. */
const DEFAULT_BARS = '2468357924681357246813572468'.split('').map(Number);

export function VoiceNote({ id, uri, sec, mine, waveform, avatarLetter }: { id: number; uri: string; sec: number; mine: boolean; waveform?: string; avatarLetter?: string }) {
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);
  const speed = useVoice((s) => s.speed);
  // Paused partway (tap resumes there) vs. idle (tap plays from the start).
  const [pausedHere, setPausedHere] = useState(false);
  const bars = (waveform ? waveform.split('').map(Number) : DEFAULT_BARS).slice(0, 40);

  const start = async (fromStart: boolean) => {
    // Playing needs playback mode; a recording just before can leave the session in record mode.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (fromStart) await player.seekTo(0);
    player.setPlaybackRate(useVoice.getState().speed);
    setPausedHere(false);
    useVoice.setState({ playing: id, request: null });
    player.play();
  };

  // Another note started → stop this one.
  const someoneElse = useVoice((s) => s.playing !== null && s.playing !== id);
  useEffect(() => {
    if (someoneElse && st.playing) player.pause();
  }, [someoneElse, st.playing, player]);

  // Auto-play when the previous note asked for us (a store subscription, not render state).
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });
  useEffect(
    () =>
      useVoice.subscribe((s, prev) => {
        if (s.request === id && prev.request !== id) void startRef.current(true);
      }),
    [id],
  );

  useEffect(() => {
    if (st.playing) player.setPlaybackRate(speed);
  }, [speed, st.playing, player]);

  // Finished: rewind, and hand over to the next voice note in the chat.
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (e) => {
      if (!e.didJustFinish) return;
      player.pause();
      player.seekTo(0);
      setPausedHere(false);
      const { queue } = useVoice.getState();
      const next = queue[queue.indexOf(id) + 1];
      useVoice.setState({ playing: null, request: next ?? null });
    });
    return () => sub.remove();
  }, [player, id]);

  const toggle = () => {
    if (st.playing) {
      player.pause();
      setPausedHere(true);
      useVoice.setState({ playing: null });
      return;
    }
    void start(!pausedHere || (st.duration > 0 && st.currentTime >= st.duration - 0.1));
  };

  const progress = st.duration > 0 ? st.currentTime / st.duration : 0;
  const fg = mine ? '#fff' : c.primary;
  const shown = st.playing || pausedHere ? Math.max(0, Math.ceil(st.currentTime)) : sec;
  return (
    <View style={styles.voice}>
      <Pressable onPress={toggle} style={[styles.play, { backgroundColor: mine ? 'rgba(255,255,255,0.25)' : '#FBE3F1' }]} accessibilityRole="button" accessibilityLabel={`${st.playing ? 'Pause' : 'Play'} voice message, ${sec} seconds`}>
        <Ionicons name={st.playing ? 'pause' : 'play'} size={20} color={fg} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Pressable
          style={styles.wave}
          onPress={(e) => {
            // Tap on the waveform to seek.
            if (st.duration > 0) player.seekTo((e.nativeEvent.locationX / 150) * st.duration);
          }}
          accessibilityLabel="Seek">
          {bars.map((h, i) => (
            <View key={i} style={[styles.bar, { height: 4 + h * 2.2, backgroundColor: fg, opacity: i / bars.length <= progress ? 1 : 0.4 }]} />
          ))}
        </Pressable>
        <Text style={[styles.dur, { color: mine ? 'rgba(255,255,255,0.9)' : c.textSecondary }]}>
          {Math.floor(shown / 60)}:{String(shown % 60).padStart(2, '0')}
        </Text>
      </View>
      {st.playing || pausedHere ? (
        <Pressable onPress={cycleSpeed} style={[styles.speed, { backgroundColor: mine ? 'rgba(255,255,255,0.3)' : '#F1DCE8' }]} accessibilityRole="button" accessibilityLabel={`Playback speed ${speed} times`}>
          <Text style={[styles.speedText, { color: fg }]}>{speed}×</Text>
        </Pressable>
      ) : avatarLetter ? (
        <View style={styles.avatar}>
          <Ionicons name="mic" size={16} color={mine ? '#fff' : c.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  voice: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 240 },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 28, width: 150 },
  bar: { width: 2.5, borderRadius: 2 },
  dur: { fontFamily: Fonts.semibold, fontSize: 11, marginTop: 1 },
  speed: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  speedText: { fontFamily: Fonts.bold, fontSize: 12 },
  avatar: { width: 26, alignItems: 'center' },
});
