import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useViewingChat } from '@/lib/live-notify';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { commonItems } from '@/components/chat/chat-menu';
import { ConversationView } from '@/components/chat/conversation-view';
import { GiftPanel } from '@/components/chat/gift-panel';
import type { Tick } from '@/components/chat/message-bubble';
import { AppBackground } from '@/components/design/app-background';
import { showMenu } from '@/components/ui/action-menu';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { startCall, type CallType } from '@/lib/calls';
import { chatApi, chatKeys, convApi, lastSeenText, type ChatMessage, type ReportReason } from '@/lib/chat-api';
import { discoveryApi } from '@/lib/discovery-api';
import { mediaUrl } from '@/lib/media';
import { emitTyping, upsertMessage, useTyping } from '@/lib/use-chat-socket';
import { discoveryKeys } from '@/lib/use-discovery';
import { useOlderMessages } from '@/lib/use-older-messages';

const c = Colors.light;
const REASONS: { code: ReportReason; label: string }[] = [
  { code: 'fake_profile', label: 'Fake profile' },
  { code: 'inappropriate', label: 'Inappropriate messages or photos' },
  { code: 'harassment', label: 'Harassment' },
  { code: 'scam', label: 'Scam or spam' },
  { code: 'underage', label: 'Under 18' },
  { code: 'other', label: 'Something else' },
];

/** One conversation (Figma frames 5–7), WhatsApp-style: instant send, ticks, replies, reactions. */
export default function ChatScreen() {
  const matchId = Number(useLocalSearchParams<{ matchId: string }>().matchId);
  useViewingChat(`m${matchId}`);
  const me = useAuth((s) => s.user?.id ?? 0);
  const qc = useQueryClient();
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const typing = useTyping((s) => !!s.typing[matchId]);

  const conv = useMemo(() => ({ kind: 'match' as const, id: matchId }), [matchId]);
  const convState = useQuery({ queryKey: chatKeys.state(conv), queryFn: async () => (await convApi.state(conv)).data });

  const thread = useQuery({ queryKey: chatKeys.thread(matchId), queryFn: async () => (await chatApi.thread(matchId)).data });
  const { messages, loadOlder } = useOlderMessages(thread.data, async (id) => (await chatApi.thread(matchId, id)).data);
  const user = thread.data?.user;
  const names = useMemo(() => new Map(user ? [[user.id, user.name.split(' ')[0]]] : []), [user]);

  // Opening the chat marks their latest message read (blue ticks for them).
  const lastTheirs = [...messages].reverse().find((m) => m.senderId !== me && m.id > 0)?.id;
  useEffect(() => {
    if (!lastTheirs) return;
    chatApi.markRead(matchId, lastTheirs).then(() => qc.invalidateQueries({ queryKey: chatKeys.list, exact: true })).catch(() => {});
  }, [lastTheirs, matchId, qc]);

  const otherLastRead = thread.data?.otherLastRead ?? 0;
  const otherLastDelivered = thread.data?.otherLastDelivered ?? 0;
  const tickFor = (m: ChatMessage): Tick => {
    if (m.status === 'failed') return 'failed';
    if (m.status === 'sending' || m.id < 0) return 'sending';
    if (m.id <= otherLastRead) return 'read';
    if (m.id <= otherLastDelivered) return 'delivered';
    return 'sent';
  };

  const afterSafety = () => {
    qc.invalidateQueries({ queryKey: chatKeys.list });
    qc.invalidateQueries({ queryKey: discoveryKeys.all });
    router.back();
  };
  const onFail = (e: Error) => Alert.alert('Something went wrong', e.message);
  const report = useMutation({
    mutationFn: (reason: ReportReason) => chatApi.report(user!.id, reason),
    onSuccess: () => Alert.alert('Thanks for telling us', 'Our team will review this. You can also block them so they can’t contact you.'),
    onError: onFail,
  });
  const block = useMutation({ mutationFn: () => discoveryApi.block(user!.id), onSuccess: afterSafety, onError: onFail });
  const unmatch = useMutation({ mutationFn: () => discoveryApi.unmatch(matchId), onSuccess: afterSafety, onError: onFail });

  const openMenu = () => {
    if (!user) return;
    showMenu(
      [
        { label: 'View profile', icon: 'person-circle-outline', onPress: () => router.push(`/user/${user.id}`) },
        ...commonItems(qc, conv, convState.data, () => setSearching(true)),
        {
          label: 'Report',
          icon: 'flag-outline',
          onPress: () => showMenu(REASONS.map((r) => ({ label: r.label, onPress: () => report.mutate(r.code) })), `Report ${user.name}`),
        },
        { label: 'Unmatch', icon: 'heart-dislike-outline', danger: true, onPress: () => unmatch.mutate() },
        {
          label: `Block ${user.name}`,
          icon: 'ban-outline',
          danger: true,
          onPress: () =>
            Alert.alert(`Block ${user.name}?`, "You won't see each other anywhere on Spark, and this chat ends.", [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => block.mutate() },
            ]),
        },
      ],
      user.name,
    );
  };

  const call = (type: CallType) => {
    if (!user) return;
    startCall(matchId, type, { id: user.id, name: user.name, photoUrl: user.photoUrl }).catch(onFail);
  };

  const status = typing ? 'typing…' : user?.online ? 'online' : lastSeenText(user?.lastSeenAt ?? null);

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Pressable style={styles.who} onPress={() => user && router.push(`/user/${user.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${user?.name ?? ''}'s profile`}>
            <Image source={mediaUrl(user?.photoUrl)} style={styles.headAvatar} contentFit="cover" />
            <View style={styles.flex}>
              <Text style={styles.headName} numberOfLines={1}>
                {user?.name ?? ' '}
              </Text>
              <Text style={[styles.status, (typing || user?.online) && { color: c.primary }]} numberOfLines={1}>
                {status}
              </Text>
            </View>
          </Pressable>
          <Pressable onPress={() => call('audio')} hitSlop={8} style={styles.headBtn} accessibilityRole="button" accessibilityLabel={`Voice call ${user?.name ?? ''}`}>
            <Ionicons name="call-outline" size={22} color={c.primary} />
          </Pressable>
          <Pressable onPress={() => call('video')} hitSlop={8} style={styles.headBtn} accessibilityRole="button" accessibilityLabel={`Video call ${user?.name ?? ''}`}>
            <Ionicons name="videocam-outline" size={24} color={c.primary} />
          </Pressable>
          <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-vertical" size={22} color={c.text} />
          </Pressable>
        </View>

        <ConversationView
          conv={conv}
          messages={messages}
          loadOlder={loadOlder}
          loading={thread.isLoading}
          error={thread.error?.message ?? null}
          me={me}
          names={names}
          isGroup={false}
          tickFor={tickFor}
          unreadAfter={thread.data?.myLastRead ?? null}
          intro={
            <View style={styles.intro}>
              <Image source={mediaUrl(user?.photoUrl)} style={styles.introAvatar} contentFit="cover" />
              <Text style={styles.introText}>You matched with {user?.name}. Say hi, send a voice note, or break the ice with a gift 🌹</Text>
            </View>
          }
          onGift={() => setGiftsOpen(true)}
          onTyping={() => emitTyping(matchId)}
          search={searching}
          onCloseSearch={() => setSearching(false)}
        />

        <GiftPanel
          visible={giftsOpen}
          matchId={matchId}
          name={user?.name ?? ''}
          onClose={() => setGiftsOpen(false)}
          onSent={(m) => {
            setGiftsOpen(false);
            upsertMessage(qc, m);
            qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
          }}
        />
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headBtn: { padding: 4 },
  headAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6E6F1' },
  headName: { fontFamily: Fonts.bold, fontSize: 16, color: c.text },
  status: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  intro: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
  introAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#F6E6F1' },
  introText: { fontFamily: Fonts.medium, fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
});
