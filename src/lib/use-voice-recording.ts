import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface VoiceTake {
  uri: string;
  durationSec: number;
  /** Loudness 0-9 per slice, as a digit string, for the bubble's waveform. */
  waveform: string;
}

/** Squash the level samples into `n` bars (0-9). */
function toWaveform(samples: number[], n = 40) {
  if (samples.length === 0) return '';
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * samples.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * samples.length) / n));
    const slice = samples.slice(a, b);
    out.push(Math.max(...slice));
  }
  const max = Math.max(...out, 0.01);
  return out.map((v) => Math.round((v / max) * 9)).join('');
}

// Metering is in dBFS: 0 is the loudest possible, -160 is silence. Speech is
// usually -35…-10; a muted/blocked mic (e.g. an emulator without host audio) stays below -50.
const SILENT_DB = -50;
const OPTIONS: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * Record a voice clip with the checks both the voice intro and chat voice messages need:
 * permission, min/max length, auto-stop at the limit, silence detection, errors surfaced,
 * and the mic released if the screen unmounts mid-recording.
 */
export function useVoiceRecording({ maxSec, minSec = 1, onTake }: { maxSec: number; minSec?: number; onTake: (take: VoiceTake) => void }) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'stopping'>('idle');
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const peak = useRef(-160);
  const active = useRef(false);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onTakeRef = useRef(onTake);
  useEffect(() => {
    onTakeRef.current = onTake;
  });

  // Track the loudest moment so a silent take can be rejected with a useful message.
  const level = state.isRecording && typeof state.metering === 'number' ? state.metering : -160;
  // Web browsers don't report loudness at all — then we can't judge silence and skip those checks.
  const hasMetering = useRef(false);
  useEffect(() => {
    if (state.isRecording && typeof state.metering === 'number') hasMetering.current = true;
    if (level > peak.current) peak.current = level;
  }, [level, state.isRecording, state.metering]);

  // A real microphone never reads *exactly* -160 dB (true digital silence) — there's always some
  // room noise. A run of it means the input stopped delivering audio (a known Android-emulator
  // issue with the host mic, or another app grabbing the mic), so say so while it happens.
  const [micStalled, setMicStalled] = useState(false);
  const samples = useRef<number[]>([]);
  const [paused, setPaused] = useState(false);
  const levelRef = useRef(level);
  const zeroSince = useRef<number | null>(null);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);
  useEffect(() => {
    if (!state.isRecording) return;
    const t = setInterval(() => {
      samples.current.push(Math.max(0, Math.min(1, (levelRef.current + 60) / 60)));
      if (!hasMetering.current) return;
      if (levelRef.current > -160) {
        zeroSince.current = null;
        setMicStalled(false);
      } else {
        zeroSince.current ??= Date.now();
        setMicStalled(Date.now() - zeroSince.current > 1500);
      }
    }, 300);
    return () => clearInterval(t);
  }, [state.isRecording]);

  const finish = useCallback(
    async (keep: boolean) => {
      if (!active.current) return;
      active.current = false;
      clearTimeout(limitTimer.current);
      setPhase('stopping');
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch (e) {
        setError(`Couldn't stop recording: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Back to playback mode, otherwise iOS keeps routing audio to the quiet earpiece.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      setPhase('idle');
      if (!keep || !uri) return;

      // Recorder time excludes pauses; fall back to the wall clock if it isn't reported.
      const durationSec = Math.min(maxSec, Math.round((recorder.currentTime || (Date.now() - startedAt.current) / 1000)));
      if (durationSec < minSec) return setError(minSec > 1 ? `Keep going a little longer — at least ${minSec} seconds.` : 'That was too short.');
      if (hasMetering.current && peak.current < SILENT_DB) return setError("We couldn't hear anything. Check your microphone isn't muted, then try again.");
      onTakeRef.current({ uri, durationSec, waveform: hasMetering.current ? toWaveform(samples.current) : '' });
    },
    [recorder, maxSec, minSec],
  );

  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  const start = useCallback(async () => {
    if (active.current || phase !== 'idle') return;
    setError(null);
    setPhase('starting');
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setPhase('idle');
        return setError('Allow microphone access in Settings to record.');
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(OPTIONS);
      peak.current = -160;
      hasMetering.current = false;
      samples.current = [];
      setPaused(false);
      zeroSince.current = null;
      setMicStalled(false);
      startedAt.current = Date.now();
      active.current = true;
      recorder.record();
      setPhase('recording');
      limitTimer.current = setTimeout(() => finishRef.current(true), maxSec * 1000); // auto-stop and keep at the limit
    } catch (e) {
      active.current = false;
      setPhase('idle');
      setError(`Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [recorder, phase, maxSec]);

  const elapsedSec = Math.floor(state.durationMillis / 1000);

  /** Locked (hands-free) recordings can pause and resume, like WhatsApp. */
  const togglePause = useCallback(() => {
    if (!active.current) return;
    if (paused) {
      recorder.record();
      setPaused(false);
    } else {
      recorder.pause();
      setPaused(true);
    }
  }, [recorder, paused]);

  // Leaving the screen mid-recording must release the mic.
  useEffect(
    () => () => {
      clearTimeout(limitTimer.current);
      if (active.current) {
        active.current = false;
        recorder.stop().catch(() => {});
        setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    },
    [recorder],
  );

  return {
    phase,
    recording: phase === 'recording',
    elapsedSec,
    /** 0…1 loudness for a live meter. */
    level: Math.max(0, Math.min(1, (level + 60) / 60)),
    /** The mic is delivering pure silence right now (see above). */
    micStalled: phase === 'recording' && micStalled,
    paused,
    togglePause,
    error,
    setError,
    start,
    stop: () => finish(true),
    cancel: () => finish(false),
  };
}
