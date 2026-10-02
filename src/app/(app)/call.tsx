import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Gradients, Spacing } from '@/constants/theme';
import { acceptCall, declineCall, flipCamera, hangUp, toggleCamera, toggleMute, toggleSpeaker, useCall } from '@/lib/calls';
import { mediaUrl } from '@/lib/media';

function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Control({
  icon,
  label,
  onPress,
  on,
  danger,
  rotate,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  on?: boolean;
  danger?: boolean;
  /** Tilt the phone glyph into the "hang up" pose. */
  rotate?: boolean;
}) {
  return (
    <View style={styles.control}>
      <Pressable
        onPress={onPress}
        style={[styles.round, on && styles.roundOn, danger && styles.roundDanger]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={on !== undefined ? { selected: on } : undefined}>
        <Ionicons name={icon} size={26} color={on ? '#1B1020' : '#fff'} style={rotate && styles.hangUp} />
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

/** Full-screen call UI (Figma call frames): incoming, ringing, and in-call for voice or video. */
export default function CallScreen() {
  const { call, peer, phase, local, remote, muted, cameraOff, speaker, answeredAt, endedText } = useCall();
  const elapsed = useElapsed(phase === 'active' ? answeredAt : null);
  const video = call?.type === 'video';

  // Nothing to show (e.g. opened by a stale link): leave.
  useEffect(() => {
    if (!phase && router.canGoBack()) router.back();
  }, [phase]);

  // Android back button shouldn't silently leave a live call behind the chat.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const status =
    phase === 'incoming'
      ? `Incoming ${video ? 'video' : 'voice'} call…`
      : phase === 'outgoing'
        ? call
          ? 'Ringing…'
          : 'Calling…'
        : phase === 'connecting'
          ? 'Connecting…'
          : phase === 'active'
            ? elapsed
            : endedText;

  const showRemoteVideo = video && phase === 'active' && remote;

  return (
    <View style={styles.flex}>
      {showRemoteVideo ? (
        <RTCView streamURL={remote.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <LinearGradient colors={['#3A1C3F', '#7B2F6B', ...Gradients.primary]} style={StyleSheet.absoluteFill} />
      )}
      {/* Keep the remote stream's audio playing on voice calls too. */}
      {!video && remote && <RTCView streamURL={remote.toURL()} style={styles.hidden} />}

      <SafeAreaView style={styles.flex}>
        <View style={[styles.top, showRemoteVideo && styles.topOverVideo]}>
          {!showRemoteVideo && <Image source={mediaUrl(peer?.photoUrl)} style={styles.avatar} contentFit="cover" />}
          <Text style={styles.name} numberOfLines={1}>
            {peer?.name ?? ''}
          </Text>
          <Text style={styles.status}>{status}</Text>
        </View>

        {video && local && !cameraOff && phase !== 'ended' && (
          <View style={styles.pip}>
            <RTCView streamURL={local.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror zOrder={1} />
          </View>
        )}

        <View style={styles.flex} />

        {phase === 'incoming' ? (
          <View style={styles.incomingRow}>
            <Control icon="close" label="Decline" onPress={declineCall} danger />
            <View style={styles.control}>
              <Pressable onPress={acceptCall} style={[styles.round, styles.accept]} accessibilityRole="button" accessibilityLabel="Accept">
                <Ionicons name={video ? 'videocam' : 'call'} size={28} color="#fff" />
              </Pressable>
              <Text style={styles.controlLabel}>Accept</Text>
            </View>
          </View>
        ) : phase === 'ended' ? (
          <View style={styles.incomingRow} />
        ) : (
          <View style={styles.controls}>
            <Control icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} onPress={toggleMute} on={muted} />
            {video ? (
              <>
                <Control icon={cameraOff ? 'videocam-off' : 'videocam'} label={cameraOff ? 'Camera on' : 'Camera off'} onPress={toggleCamera} on={cameraOff} />
                <Control icon="camera-reverse" label="Flip" onPress={flipCamera} />
              </>
            ) : (
              <Control icon="volume-high" label="Speaker" onPress={toggleSpeaker} on={speaker} />
            )}
            <Control icon="call" label="End" onPress={hangUp} danger rotate />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { width: 1, height: 1, opacity: 0 },
  top: { alignItems: 'center', gap: 6, paddingTop: Spacing.six },
  topOverVideo: { paddingTop: Spacing.three, alignSelf: 'flex-start', alignItems: 'flex-start', paddingHorizontal: Spacing.three },
  avatar: { width: 128, height: 128, borderRadius: 64, borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)', marginBottom: Spacing.three, backgroundColor: '#F6E6F1' },
  name: { fontFamily: Fonts.extrabold, fontSize: 28, color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 6 },
  status: { fontFamily: Fonts.semibold, fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  pip: {
    position: 'absolute',
    top: Spacing.six + Spacing.five,
    right: Spacing.three,
    width: 110,
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: '#000',
  },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  incomingRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: Spacing.six, minHeight: 120 },
  control: { alignItems: 'center', gap: 8 },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  roundOn: { backgroundColor: '#fff' },
  roundDanger: { backgroundColor: '#F0445A' },
  hangUp: { transform: [{ rotate: '135deg' }] },
  accept: { backgroundColor: '#2FC26B', width: 72, height: 72, borderRadius: 36 },
  controlLabel: { fontFamily: Fonts.semibold, fontSize: 12, color: '#fff' },
});
