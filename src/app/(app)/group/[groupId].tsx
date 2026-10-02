import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useViewingChat } from '@/lib/live-notify';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { commonItems } from '@/components/chat/chat-menu';
import { ConversationView } from '@/components/chat/conversation-view';
import type { Tick } from '@/components/chat/message-bubble';
import { AppBackground } from '@/components/design/app-background';
import { showMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { chatKeys, convApi, groupApi, groupExtraApi, type ChatMessage } from '@/lib/chat-api';
import { joinGroupCall, startGroupCall, useGroupCall } from '@/lib/group-calls';
import type { CallType } from '@/lib/calls';
import { mediaUrl } from '@/lib/media';
import { useOlderMessages } from '@/lib/use-older-messages';

const c = Colors.light;

/** Group chat: text, photos and voice notes (gifts and requests are 1:1 only). */
export default function GroupChatScreen() {
  const groupId = Number(useLocalSearchParams<{ groupId: string }>().groupId);
  useViewingChat(`g${groupId}`);
  const me = useAuth((s) => s.user?.id ?? 0);
  const qc = useQueryClient();
  const [searching, setSearching] = useState(false);
  const conv = useMemo(() => ({ kind: 'group' as const, id: groupId }), [groupId]);
  const convState = useQuery({ queryKey: chatKeys.state(conv), queryFn: async () => (await convApi.state(conv)).data, retry: false });

  const thread = useQuery({ queryKey: chatKeys.groupThread(groupId), queryFn: async () => (await groupApi.thread(groupId)).data, retry: false });
  const { messages, loadOlder } = useOlderMessages(thread.data, async (id) => (await groupApi.thread(groupId, id)).data);
  const group = thread.data?.group;
  const names = useMemo(() => new Map(group?.members.map((m) => [m.id, m.name.split(' ')[0]]) ?? []), [group]);
  const activeCall = useQuery({ queryKey: ['group-call', groupId], queryFn: async () => (await groupExtraApi.activeCall(groupId)).data.call, retry: false });
  const inThisCall = useGroupCall((st) => st.phase === 'in-call' && st.call?.groupId === groupId);
  const call = (type: CallType) => startGroupCall(groupId, type).catch((e: Error) => Alert.alert('Can’t start the call', e.message));
  const mentionable = useMemo(() => group?.members.filter((m) => m.id !== me).map((m) => ({ id: m.id, name: m.name })) ?? [], [group, me]);

  const lastTheirs = [...messages].reverse().find((m) => m.senderId !== me && m.id > 0)?.id;
  useEffect(() => {
    if (!lastTheirs) return;
    groupApi.markRead(groupId, lastTheirs).then(() => qc.invalidateQueries({ queryKey: chatKeys.list, exact: true })).catch(() => {});
  }, [lastTheirs, groupId, qc]);

  // Groups show ⏱ / ✓ / failed (no per-member delivery tracking).
  const tickFor = (m: ChatMessage): Tick => (m.status === 'failed' ? 'failed' : m.status === 'sending' || m.id < 0 ? 'sending' : 'sent');
  const openMenu = () =>
    showMenu(
      [{ label: 'Group info', icon: 'information-circle-outline', onPress: () => router.push(`/group-info/${groupId}`) }, ...commonItems(qc, conv, convState.data, () => setSearching(true))],
      group?.name,
    );

  // Removed from the group (or it was deleted) — the API answers 404.
  if (thread.error) {
    return (
      <AppBackground>
        <SafeAreaView style={[styles.flex, styles.center]}>
          <Ionicons name="people-outline" size={48} color={c.textSecondary} />
          <Text style={styles.goneText}>You’re not in this group any more.</Text>
          <Button title="Back to chats" size="sm" onPress={() => router.back()} />
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Pressable style={styles.who} onPress={() => router.push(`/group-info/${groupId}`)} accessibilityRole="button" accessibilityLabel="Group info">
            {group?.photoUrl ? (
              <Image source={mediaUrl(group.photoUrl)} style={styles.headAvatar} contentFit="cover" />
            ) : (
              <View style={styles.headAvatar}>
                <Ionicons name="people" size={20} color={c.primary} />
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.headName} numberOfLines={1}>
                {group?.name ?? ' '}
              </Text>
              <Text style={styles.status} numberOfLines={1}>
                {group ? group.members.map((m) => (m.id === me ? 'You' : m.name.split(' ')[0])).join(', ') : ' '}
              </Text>
            </View>
          </Pressable>
          <Pressable onPress={() => call('audio')} hitSlop={8} style={styles.headBtn} accessibilityRole="button" accessibilityLabel="Group voice call">
            <Ionicons name="call-outline" size={22} color={c.primary} />
          </Pressable>
          <Pressable onPress={() => call('video')} hitSlop={8} style={styles.headBtn} accessibilityRole="button" accessibilityLabel="Group video call">
            <Ionicons name="videocam-outline" size={24} color={c.primary} />
          </Pressable>
          <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-vertical" size={22} color={c.text} />
          </Pressable>
        </View>

        {activeCall.data && (
          <Pressable
            onPress={() => joinGroupCall(activeCall.data!.id, activeCall.data!.type).catch((e: Error) => Alert.alert('Can’t join', e.message))}
            style={styles.callBanner}
            accessibilityRole="button"
            accessibilityLabel={inThisCall ? 'Return to call' : 'Join the call'}>
            <Ionicons name={activeCall.data.type === 'video' ? 'videocam' : 'call'} size={18} color="#fff" />
            <Text style={styles.callBannerText} numberOfLines={1}>
              {activeCall.data.type === 'video' ? 'Video' : 'Voice'} call · {activeCall.data.participants.map((p) => (p.id === me ? 'You' : p.name.split(' ')[0])).join(', ')}
            </Text>
            <Text style={styles.callBannerJoin}>{inThisCall ? 'Return' : 'Join'}</Text>
          </Pressable>
        )}
        <ConversationView
          conv={conv}
          messages={messages}
          loadOlder={loadOlder}
          loading={thread.isLoading}
          error={null}
          me={me}
          names={names}
          isGroup
          tickFor={tickFor}
          unreadAfter={null}
          intro={<Text style={styles.intro}>This is the start of {group?.name}. Say hi to everyone 👋</Text>}
          members={mentionable}
          search={searching}
          onCloseSearch={() => setSearching(false)}
        />
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  goneText: { fontFamily: Fonts.semibold, fontSize: 16, color: c.text, textAlign: 'center' },
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
  headAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FBE3F1', alignItems: 'center', justifyContent: 'center' },
  headBtn: { padding: 4 },
  callBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 10, backgroundColor: '#1FA855' },
  callBannerText: { flex: 1, fontFamily: Fonts.semibold, fontSize: 14, color: '#fff' },
  callBannerJoin: { fontFamily: Fonts.bold, fontSize: 14, color: '#fff', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  headName: { fontFamily: Fonts.bold, fontSize: 16, color: c.text },
  status: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  intro: { fontFamily: Fonts.medium, fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
});
