import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView, type MediaStream } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Gradients, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import {
  declineGroupCall,
  flipGroupCamera,
  joinGroupCall,
  leaveGroupCall,
  toggleGroupCamera,
  toggleGroupMute,
  toggleGroupSpeaker,
  useGroupCall,
  type GroupCallPerson,
} from '@/lib/group-calls';
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

function Control({ icon, label, onPress, on, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; on?: boolean; danger?: boolean }) {
  return (
    <View style={styles.control}>
      <Pressable
        onPress={onPress}
        style={[styles.round, on && styles.roundOn, danger && styles.roundDanger]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={on !== undefined ? { selected: on } : undefined}>
        <Ionicons name={icon} size={24} color={on ? '#1B1020' : '#fff'} style={danger && icon === 'call' && styles.hangUp} />
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

/** One participant: their video, or their photo for voice calls / camera off / still connecting. */
function Tile({ person, stream, video, status, mirror, muted }: { person: GroupCallPerson; stream: MediaStream | null; video: boolean; status?: string; mirror?: boolean; muted?: boolean }) {
  const showVideo = video && stream && stream.getVideoTracks().some((t) => t.enabled);
  return (
    <View style={styles.tile}>
      {showVideo ? (
        <RTCView streamURL={stream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror={mirror} zOrder={mirror ? 1 : 0} />
      ) : (
        <View style={styles.tileAvatarWrap}>
          <Image source={mediaUrl(person.photoUrl)} style={styles.tileAvatar} contentFit="cover" />
          {/* Voice calls: keep the audio stream attached. */}
          {stream && !mirror && <RTCView streamURL={stream.toURL()} style={styles.hidden} />}
        </View>
      )}
      <View style={styles.tileLabel}>
        {muted && <Ionicons name="mic-off" size={13} color="#fff" />}
        <Text style={styles.tileName} numberOfLines={1}>
          {person.name}
        </Text>
        {!!status && <Text style={styles.tileStatus}>{status}</Text>}
      </View>
    </View>
  );
}

/** WhatsApp-style group call: ringing screen, then a grid of everyone in the call. */
export default function GroupCallScreen() {
  const { call, phase, from, local, peers, muted, cameraOff, speaker, joinedAt, endedText } = useGroupCall();
  const myId = useAuth((s) => s.user?.id ?? 0);
  const myProfile = useAuth((s) => s.profile);
  const myName = useAuth((s) => s.user?.name ?? 'You');
  const elapsed = useElapsed(phase === 'in-call' ? joinedAt : null);
  const video = call?.type === 'video';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phase && router.canGoBack()) router.back();
  }, [phase]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const others = Object.values(peers);
  const tiles = [
    { key: 'me', person: { id: myId, name: 'You', photoUrl: myProfile?.photos?.[0]?.url ?? null }, stream: local, mirror: true, muted, status: undefined as string | undefined },
    ...others.map((p) => ({ key: String(p.person.id), person: p.person, stream: p.stream, mirror: false, muted: false, status: p.state === 'connected' ? undefined : p.state === 'failed' ? 'Poor connection' : 'Connecting…' })),
  ];
  // 1–2 people: stacked; 3–4: 2×2; up to 8: two columns.
  const cols = tiles.length <= 2 ? 1 : 2;
  const rows = Math.ceil(tiles.length / cols);

  if (phase === 'incoming' || !call) {
    return (
      <View style={styles.flex}>
        <LinearGradient colors={['#3A1C3F', '#7B2F6B', ...Gradients.primary]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.flex}>
          <View style={styles.top}>
            {call?.groupPhotoUrl ? (
              <Image source={mediaUrl(call.groupPhotoUrl)} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.groupPh]}>
                <Ionicons name="people" size={56} color="#fff" />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {call?.groupName ?? ''}
            </Text>
            <Text style={styles.status}>{from ? `${from.name} is calling · ${video ? 'Video' : 'Voice'} call` : 'Connecting…'}</Text>
            {!!call?.participants.length && <Text style={styles.status}>{call.participants.map((p) => p.name.split(' ')[0]).join(', ')} in the call</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
          <View style={styles.flex} />
          {phase === 'incoming' && call && (
            <View style={styles.incomingRow}>
              <Control icon="close" label="Ignore" onPress={declineGroupCall} danger />
              <View style={styles.control}>
                <Pressable onPress={() => joinGroupCall(call.id, call.type).catch((e: Error) => setError(e.message))} style={[styles.round, styles.accept]} accessibilityRole="button" accessibilityLabel="Join call">
                  <Ionicons name={video ? 'videocam' : 'call'} size={28} color="#fff" />
                </Pressable>
                <Text style={styles.controlLabel}>Join</Text>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: '#1B1020' }]}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headTitle} numberOfLines={1}>
              {call.groupName}
            </Text>
            <Text style={styles.headSub}>
              {phase === 'ended' ? endedText : phase === 'joining' ? 'Joining…' : `${elapsed ?? ''} · ${tiles.length} ${tiles.length === 1 ? 'person' : 'people'}`}
            </Text>
          </View>
          <Ionicons name={video ? 'videocam' : 'call'} size={20} color="rgba(255,255,255,0.8)" />
        </View>

        <View style={styles.grid}>
          {tiles.length === 1 && phase === 'in-call' ? (
            <View style={[styles.cell, { width: '100%', height: '100%' }]}>
              <Tile person={{ ...tiles[0].person, name: myName }} stream={local} video={video && !cameraOff} mirror muted={muted} />
              <View style={styles.waiting} pointerEvents="none">
                <Text style={styles.waitingText}>Waiting for others to join…</Text>
              </View>
            </View>
          ) : (
            tiles.map((t) => (
              <View key={t.key} style={[styles.cell, { width: `${100 / cols}%`, height: `${100 / rows}%` }]}>
                <Tile person={t.person} stream={t.stream} video={video && !(t.mirror && cameraOff)} status={t.status} mirror={t.mirror} muted={t.muted} />
              </View>
            ))
          )}
        </View>

        {phase !== 'ended' && (
          <View style={styles.controls}>
            <Control icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} onPress={toggleGroupMute} on={muted} />
            {video ? (
              <>
                <Control icon={cameraOff ? 'videocam-off' : 'videocam'} label={cameraOff ? 'Camera on' : 'Camera off'} onPress={toggleGroupCamera} on={cameraOff} />
                <Control icon="camera-reverse" label="Flip" onPress={flipGroupCamera} />
              </>
            ) : (
              <Control icon="volume-high" label="Speaker" onPress={toggleGroupSpeaker} on={speaker} />
            )}
            <Control icon="call" label="Leave" onPress={leaveGroupCall} danger />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { width: 1, height: 1, opacity: 0 },
  top: { alignItems: 'center', gap: 6, paddingTop: Spacing.six, paddingHorizontal: Spacing.four },
  avatar: { width: 128, height: 128, borderRadius: 64, borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)', marginBottom: Spacing.three, backgroundColor: '#F6E6F1' },
  groupPh: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: Fonts.extrabold, fontSize: 28, color: '#fff' },
  status: { fontFamily: Fonts.semibold, fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  error: { fontFamily: Fonts.semibold, fontSize: 14, color: '#FFD1D8', textAlign: 'center', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  headTitle: { fontFamily: Fonts.bold, fontSize: 18, color: '#fff' },
  headSub: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
  cell: { padding: 4 },
  tile: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#2E1F33' },
  tileAvatarWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F6E6F1' },
  tileLabel: { position: 'absolute', left: 8, bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileName: { flexShrink: 1, fontFamily: Fonts.bold, fontSize: 13, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  tileStatus: { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  waiting: { position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' },
  waitingText: { fontFamily: Fonts.semibold, fontSize: 14, color: '#fff', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: 'hidden' },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four },
  incomingRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: Spacing.six, minHeight: 120 },
  control: { alignItems: 'center', gap: 8 },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  roundOn: { backgroundColor: '#fff' },
  roundDanger: { backgroundColor: '#F0445A' },
  hangUp: { transform: [{ rotate: '135deg' }] },
  accept: { backgroundColor: '#2FC26B', width: 72, height: 72, borderRadius: 36 },
  controlLabel: { fontFamily: Fonts.semibold, fontSize: 12, color: '#fff' },
});
