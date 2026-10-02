import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { chatApi, chatKeys, convApi, newClientId, storyApi, type Story, type StoryGroup } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;
const IMAGE_MS = 5000;
const TEXT_MS = 6000;
const REACTIONS = ['😍', '😂', '😮', '😢', '🔥', '👏'];

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
};

function VideoStory({ uri, paused, onEnd, onDuration }: { uri: string; paused: boolean; onEnd: () => void; onDuration: (ms: number) => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  useEffect(() => {
    const a = player.addListener('playToEnd', onEnd);
    const b = player.addListener('sourceLoad', (e) => onDuration(e.duration * 1000));
    return () => {
      a.remove();
      b.remove();
    };
  }, [player, onEnd, onDuration]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

/** WhatsApp Status viewer: progress bars, tap right/left for next/previous, hold to pause, reply or react. */
export default function StoryViewer() {
  const userId = Number(useLocalSearchParams<{ userId: string }>().userId);
  const qc = useQueryClient();
  const feed = useQuery({ queryKey: chatKeys.stories, queryFn: async () => (await storyApi.feed()).data.feed });
  const groups = feed.data ?? [];
  const [gi, setGi] = useState(-1);
  const [si, setSi] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(IMAGE_MS);
  const [reply, setReply] = useState('');
  const [viewersOpen, setViewersOpen] = useState(false);
  const elapsed = useRef(0);

  // Start at this person's first unseen update.
  if (gi === -1 && groups.length) {
    const g = Math.max(0, groups.findIndex((x) => x.user.id === userId));
    setGi(g);
    const firstUnseen = groups[g].stories.findIndex((s) => !s.seen);
    setSi(firstUnseen === -1 ? 0 : firstUnseen);
  }
  const group: StoryGroup | undefined = groups[gi];
  const story: Story | undefined = group?.stories[si];

  const next = () => {
    if (!group) return;
    elapsed.current = 0;
    setProgress(0);
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1 && !group.mine) {
      setGi(gi + 1);
      setSi(0);
    } else router.back();
  };
  const prev = () => {
    elapsed.current = 0;
    setProgress(0);
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(0);
    }
  };

  // Mark seen.
  useEffect(() => {
    if (!story || group?.mine || story.seen) return;
    storyApi.view(story.id).catch(() => {});
    qc.setQueryData(chatKeys.stories, (f: StoryGroup[] | undefined) =>
      f?.map((g) => (g.user.id === group!.user.id ? { ...g, stories: g.stories.map((s) => (s.id === story.id ? { ...s, seen: true } : s)), allSeen: g.stories.every((s) => s.id === story.id || s.seen) } : g)),
    );
  }, [story, group, qc]);

  // Timer for photos and text (videos report their own length).
  const typing = reply.length > 0;
  useEffect(() => {
    if (!story) return;
    const total = story.type === 'video' ? duration : story.type === 'text' ? TEXT_MS : IMAGE_MS;
    if (paused || typing || viewersOpen) return;
    const t = setInterval(() => {
      elapsed.current += 50;
      setProgress(Math.min(1, elapsed.current / total));
      if (elapsed.current >= total && story.type !== 'video') next();
    }, 50);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused, typing, viewersOpen, duration]);

  const viewers = useQuery({ queryKey: ['story-viewers', story?.id], queryFn: async () => (await storyApi.viewers(story!.id)).data.viewers, enabled: viewersOpen && !!story && !!group?.mine });

  const sendReply = async (text: string) => {
    if (!group || !story) return;
    // Replies go to your 1:1 chat with them, quoting the update like WhatsApp.
    const list = await chatApi.conversations();
    const chat = list.data.conversations.find((x) => x.kind === 'match' && x.user.id === group.user.id);
    if (!chat || chat.kind !== 'match') return Alert.alert('You can only reply to people you’re matched with.');
    const what = story.type === 'text' ? `“${story.body?.slice(0, 60)}”` : story.type === 'video' ? 'video' : 'photo';
    await convApi.send({ kind: 'match', id: chat.matchId }, { type: 'text', body: `↩︎ Replying to your status (${what}): ${text}` }, { clientId: newClientId() });
    setReply('');
  };
  const react = async (emoji: string) => {
    if (!story) return;
    await storyApi.view(story.id, emoji).catch(() => {});
    await sendReply(emoji).catch(() => {});
  };
  const remove = () =>
    Alert.alert('Delete this status?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await storyApi.remove(story!.id).catch(() => {});
          qc.invalidateQueries({ queryKey: chatKeys.stories });
          router.back();
        },
      },
    ]);

  if (!group || !story) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        {feed.isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.name}>No updates</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.root, story.type === 'text' && { backgroundColor: story.bg ?? '#C2185B' }]}>
      <StatusBar barStyle="light-content" />
      {story.type === 'image' && <Image source={mediaUrl(story.url)} style={StyleSheet.absoluteFill} contentFit="contain" />}
      {story.type === 'video' && (
        <VideoStory
          key={story.id}
          uri={mediaUrl(story.url)!}
          paused={paused || typing || viewersOpen}
          onEnd={next}
          onDuration={(ms) => {
            elapsed.current = 0;
            setDuration(ms || IMAGE_MS);
          }}
        />
      )}
      {story.type === 'text' && (
        <View style={styles.textWrap}>
          <Text style={styles.textStory}>{story.body}</Text>
        </View>
      )}

      {/* Tap zones: left third = back, rest = next. Hold anywhere = pause. */}
      <View style={styles.zones}>
        <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={200} accessibilityLabel="Previous" />
        <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={200} accessibilityLabel="Next" />
      </View>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.bars}>
          {group.stories.map((s, i) => (
            <View key={s.id} style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(i < si ? 1 : i === si ? progress : 0) * 100}%` }]} />
            </View>
          ))}
        </View>
        <View style={styles.headRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Image source={mediaUrl(group.user.photoUrl)} style={styles.avatar} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{group.mine ? 'My status' : group.user.name}</Text>
            <Text style={styles.time}>{ago(story.createdAt)}</Text>
          </View>
          {group.mine && (
            <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Delete status">
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {story.type !== 'text' && !!story.body && (
        <View style={styles.captionWrap} pointerEvents="none">
          <Text style={styles.caption}>{story.body}</Text>
        </View>
      )}

      <KeyboardAvoider style={styles.bottom}>
        <SafeAreaView edges={['bottom']}>
          {group.mine ? (
            <Pressable onPress={() => setViewersOpen(true)} style={styles.viewersBtn} accessibilityRole="button">
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={styles.name}>{story.viewCount}</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.reactRow}>
                {REACTIONS.map((e) => (
                  <Pressable key={e} onPress={() => react(e)} accessibilityLabel={`React ${e}`}>
                    <Text style={{ fontSize: 30 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.replyRow}>
                <TextInput value={reply} onChangeText={setReply} placeholder="Reply…" placeholderTextColor="rgba(255,255,255,0.7)" style={styles.replyInput} />
                {!!reply.trim() && (
                  <Pressable onPress={() => sendReply(reply.trim())} style={styles.send} accessibilityLabel="Send reply">
                    <Ionicons name="send" size={18} color="#fff" />
                  </Pressable>
                )}
              </View>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoider>

      <AppModal visible={viewersOpen} transparent animationType="slide" onRequestClose={() => setViewersOpen(false)}>
        <Pressable style={styles.sheetBg} onPress={() => setViewersOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Viewed by {story.viewCount}</Text>
            {viewers.isLoading ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <FlatList
                data={viewers.data ?? []}
                keyExtractor={(v) => String(v.id)}
                ListEmptyComponent={<Text style={styles.empty}>No views yet</Text>}
                renderItem={({ item }) => (
                  <View style={styles.viewer}>
                    <Image source={mediaUrl(item.photoUrl)} style={styles.viewerAvatar} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.viewerName}>{item.name}</Text>
                      <Text style={styles.empty}>{ago(item.at)}</Text>
                    </View>
                    {!!item.emoji && <Text style={{ fontSize: 22 }}>{item.emoji}</Text>}
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  zones: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', top: 110, bottom: 140 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.two },
  bars: { flexDirection: 'row', gap: 3, paddingTop: 6 },
  barTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 2.5, backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#555' },
  name: { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
  time: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  textWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  textStory: { fontFamily: Fonts.bold, fontSize: 30, color: '#fff', textAlign: 'center', lineHeight: 40 },
  captionWrap: { position: 'absolute', bottom: 150, left: 0, right: 0, padding: 14, backgroundColor: 'rgba(0,0,0,0.4)' },
  caption: { fontFamily: Fonts.medium, fontSize: 15, color: '#fff', textAlign: 'center' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.two },
  reactRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 10 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontFamily: Fonts.medium },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  viewersBtn: { alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', padding: 12 },
  sheetBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '60%', backgroundColor: '#FFF7FB', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.three },
  sheetTitle: { fontFamily: Fonts.bold, fontSize: 16, color: c.text, marginBottom: Spacing.two },
  viewer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6E6F1' },
  viewerName: { fontFamily: Fonts.semibold, fontSize: 15, color: c.text },
  empty: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary },
});
