import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { confirmClear, muteMenu } from '@/components/chat/chat-menu';
import { showMenu } from '@/components/ui/action-menu';

import { EmptyState } from '@/components/design/empty-state';
import { TabHeader } from '@/components/design/tab-header';
import { TabScreen } from '@/components/design/tab-screen';
import { Button } from '@/components/ui/button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { chatApi, chatKeys, convApi, preview, storyApi, type Conversation, type ConvRef, type DirectConversation, type GroupConversation } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';
import { useTyping } from '@/lib/use-chat-socket';
import { useOwnProfile } from '@/lib/use-profile';

const c = Colors.light;

/** "18:16" today, "Mon" this week, "12 Sep" otherwise — like the Figma chat list. */
function when(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const refOf = (x: Conversation): ConvRef => (x.kind === 'match' ? { kind: 'match', id: x.matchId } : { kind: 'group', id: x.groupId });
const isMuted = (x: Conversation) => !!x.prefs?.mutedUntil && new Date(x.prefs.mutedUntil) > new Date();
const unreadOf = (x: Conversation) => x.unread || (x.prefs?.markedUnread ? 1 : 0);

/** Long-press a chat: pin, mute, archive, mark unread, clear (WhatsApp chat list actions). */
function chatMenu(qc: ReturnType<typeof useQueryClient>, x: Conversation) {
  const ref = refOf(x);
  const set = (p: Parameters<typeof convApi.prefs>[1]) =>
    convApi
      .prefs(ref, p)
      .then(() => qc.invalidateQueries({ queryKey: chatKeys.list, exact: true }))
      .catch((e: Error) => Alert.alert('Couldn’t update', e.message));
  showMenu(
    [
      { label: x.prefs.pinned ? 'Unpin chat' : 'Pin chat', icon: 'pin-outline', onPress: () => set({ pinned: !x.prefs.pinned }) },
      { label: isMuted(x) ? 'Unmute' : 'Mute', icon: isMuted(x) ? 'notifications-outline' : 'notifications-off-outline', onPress: () => muteMenu(qc, ref, x.prefs.mutedUntil) },
      { label: x.prefs.archived ? 'Unarchive chat' : 'Archive chat', icon: 'archive-outline', onPress: () => set({ archived: !x.prefs.archived }) },
      unreadOf(x)
        ? { label: 'Mark as read', icon: 'checkmark-done-outline', onPress: () => set({ markedUnread: false }) }
        : { label: 'Mark as unread', icon: 'mail-unread-outline', onPress: () => set({ markedUnread: true }) },
      { label: 'Clear chat', icon: 'trash-bin-outline', danger: true, onPress: () => confirmClear(qc, ref) },
    ],
    x.kind === 'match' ? x.user.name : x.name,
  );
}

/** Pinned / muted icons + unread badge on the right of a row. */
function RowBadges({ x }: { x: Conversation }) {
  const n = unreadOf(x);
  return (
    <View style={styles.badges}>
      {isMuted(x) && <Ionicons name="volume-mute" size={15} color={c.textSecondary} accessibilityLabel="Muted" />}
      {x.prefs.pinned && <Ionicons name="pin" size={14} color={c.textSecondary} accessibilityLabel="Pinned" />}
      {n > 0 && (
        <View style={[styles.newDot, isMuted(x) && { backgroundColor: c.textSecondary }]}>
          <Text style={styles.newText}>{x.unread ? (x.unread > 99 ? '99+' : x.unread) : ''}</Text>
        </View>
      )}
    </View>
  );
}

function LastTick({ conv }: { conv: DirectConversation }) {
  const id = conv.lastMessage?.id ?? 0;
  if (id <= conv.otherLastRead) return <Ionicons name="checkmark-done" size={15} color="#34B7F1" />;
  if (id <= conv.otherLastDelivered) return <Ionicons name="checkmark-done" size={15} color={c.textSecondary} />;
  return <Ionicons name="checkmark" size={15} color={c.textSecondary} />;
}

function Row({ c: conv, me, onLongPress }: { c: DirectConversation; me?: number; onLongPress: () => void }) {
  const last = conv.lastMessage;
  const typing = useTyping((s) => !!s.typing[conv.matchId]);
  const mineLast = !!last && last.senderId === me && !last.deleted;
  return (
    <Pressable
      onPress={() => router.push(`/chat/${conv.matchId}`)}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${conv.user.name}${conv.unread ? `, ${conv.unread} unread` : ''}`}>
      <View>
        <Image source={mediaUrl(conv.user.photoUrl)} style={styles.avatar} contentFit="cover" />
        {conv.user.online && <View style={styles.online} />}
      </View>
      <View style={styles.flex}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {conv.user.name}
          </Text>
          <Text style={styles.time}>{when(conv.updatedAt)}</Text>
        </View>
        <View style={styles.top}>
          <View style={styles.previewRow}>
            {mineLast && !typing && <LastTick conv={conv} />}
            <Text style={[styles.preview, !conv.unread && last && styles.previewRead, typing && styles.typing]} numberOfLines={1}>
              {typing ? 'typing…' : preview(last, false)}
            </Text>
          </View>
          {!last && !unreadOf(conv) ? (
            <View style={styles.newDot}>
              <Text style={styles.newText}>New</Text>
            </View>
          ) : (
            <RowBadges x={conv} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function GroupRow({ g, me, onLongPress }: { g: GroupConversation; me?: number; onLongPress: () => void }) {
  const last = g.lastMessage;
  const who = last && last.senderId !== me ? `${last.senderName.split(' ')[0]}: ` : '';
  return (
    <Pressable
      onPress={() => router.push(`/group/${g.groupId}`)}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Group ${g.name}, ${g.memberCount} people${g.unread ? `, ${g.unread} unread` : ''}`}>
      {g.photoUrl ? (
        <Image source={mediaUrl(g.photoUrl)} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.groupAvatar]}>
          <Ionicons name="people" size={24} color={c.primary} />
        </View>
      )}
      <View style={styles.flex}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {g.name}
          </Text>
          <Text style={styles.time}>{when(g.updatedAt)}</Text>
        </View>
        <View style={styles.top}>
          <Text style={[styles.preview, !g.unread && styles.previewRead]} numberOfLines={1}>
            {last ? who + preview(last, last.senderId === me) : `${g.memberCount} people · say hi 👋`}
          </Text>
          <RowBadges x={g} />
        </View>
      </View>
    </Pressable>
  );
}

/** Figma "Announcements" channel, pinned above the chats. */
function AnnouncementsRow() {
  const q = useQuery({ queryKey: chatKeys.announcements, queryFn: async () => (await chatApi.announcements()).data.announcements });
  const latest = q.data?.[0];
  if (!latest) return null;
  return (
    <Pressable onPress={() => router.push('/announcements')} style={styles.row} accessibilityRole="button" accessibilityLabel="Announcements">
      <View style={[styles.avatar, styles.megaphone]}>
        <Ionicons name="megaphone" size={24} color="#fff" />
      </View>
      <View style={styles.flex}>
        <View style={styles.top}>
          <Text style={styles.name}>Announcements</Text>
          <Text style={styles.time}>{when(latest.createdAt)}</Text>
        </View>
        <Text style={[styles.preview, styles.previewRead]} numberOfLines={1}>
          {latest.title}
        </Text>
      </View>
    </Pressable>
  );
}

/** WhatsApp "Updates": my status + matches' statuses (ring = unseen). */
function StoriesRow() {
  // Loads the profile if it isn't cached yet (e.g. after a web page reload).
  const myPhoto = useOwnProfile().profile?.photos?.[0]?.url ?? null;
  const q = useQuery({ queryKey: chatKeys.stories, queryFn: async () => (await storyApi.feed()).data.feed });
  const feed = q.data ?? [];
  const mine = feed.find((g) => g.mine);
  const others = feed.filter((g) => !g.mine);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
      <Pressable
        onPress={() => (mine ? router.push(`/stories/${mine.user.id}`) : router.push('/new-story'))}
        onLongPress={() => router.push('/new-story')}
        style={styles.story}
        accessibilityRole="button"
        accessibilityLabel={mine ? 'My status. Long press to add' : 'Add status'}>
        <View>
          <View style={[styles.ring, { borderColor: mine ? c.borderStrong : 'transparent' }]}>
            {/* key: remount when the photo URL arrives (expo-image on web doesn't recover from an empty first source). */}
            <Image key={myPhoto ?? 'none'} source={mediaUrl(myPhoto)} style={styles.storyAvatar} contentFit="cover" />
          </View>
          {/* A badge, not a nested button: tap opens / adds your status, long-press always adds. */}
          <View style={styles.addBadge} pointerEvents="none">
            <Ionicons name="add" size={14} color="#fff" />
          </View>
        </View>
        <Text style={styles.storyName} numberOfLines={1}>
          My status
        </Text>
      </Pressable>
      {others.map((g) => (
        <Pressable key={g.user.id} onPress={() => router.push(`/stories/${g.user.id}`)} style={styles.story} accessibilityRole="button" accessibilityLabel={`${g.user.name}'s status${g.allSeen ? '' : ', new'}`}>
          <View style={[styles.ring, { borderColor: g.allSeen ? c.borderStrong : c.primary }]}>
            <Image source={mediaUrl(g.user.photoUrl)} style={styles.storyAvatar} contentFit="cover" />
          </View>
          <Text style={styles.storyName} numberOfLines={1}>
            {g.user.name.split(' ')[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
] as const;

/** Chats (Figma frame 4) with WhatsApp's list features: status, search, filters, pin/mute/archive. */
export default function ChatsScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [archivedOpen, setArchivedOpen] = useState(false);
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const chats = useQuery({
    queryKey: chatKeys.list,
    queryFn: async () => (await chatApi.conversations()).data.conversations,
  });
  const q = query.trim();
  // Search inside messages too (WhatsApp shows chats, then matching messages).
  const msgSearch = useQuery({ queryKey: ['search-all', q], queryFn: async () => (await convApi.searchAll(q)).data.messages, enabled: q.length >= 2 });

  const all = useMemo(() => chats.data ?? [], [chats.data]);
  const archivedCount = all.filter((x) => x.prefs?.archived).length;
  const list = useMemo(() => {
    let rows = all.filter((x) => (archivedOpen ? x.prefs?.archived : !x.prefs?.archived));
    if (filter === 'unread') rows = rows.filter((x) => unreadOf(x) > 0);
    if (filter === 'groups') rows = rows.filter((x) => x.kind === 'group');
    const lq = q.toLowerCase();
    return lq ? all.filter((m) => (m.kind === 'group' ? m.name : m.user.name).toLowerCase().includes(lq)) : rows;
  }, [all, q, filter, archivedOpen]);

  const header = q ? null : (
    <>
      {!archivedOpen && <StoriesRow />}
      {!archivedOpen && (
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: filter === f.key }}>
              <Text style={[styles.chipText, filter === f.key && { color: c.primary }]}>{f.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/starred')} style={styles.chip} accessibilityRole="button" accessibilityLabel="Starred messages">
            <Ionicons name="star-outline" size={15} color={c.textSecondary} />
          </Pressable>
        </View>
      )}
      {archivedOpen ? (
        <Pressable onPress={() => setArchivedOpen(false)} style={styles.row} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={c.text} />
          <Text style={styles.name}>Archived</Text>
        </Pressable>
      ) : (
        archivedCount > 0 && (
          <Pressable onPress={() => setArchivedOpen(true)} style={styles.row} accessibilityRole="button" accessibilityLabel={`Archived, ${archivedCount} chats`}>
            <View style={[styles.avatar, styles.archive]}>
              <Ionicons name="archive-outline" size={22} color={c.primary} />
            </View>
            <Text style={styles.name}>Archived</Text>
            <Text style={styles.time}>{archivedCount}</Text>
          </Pressable>
        )
      )}
      {!archivedOpen && filter === 'all' && <AnnouncementsRow />}
    </>
  );

  const footer =
    q.length >= 2 && (msgSearch.data?.length ?? 0) > 0 ? (
      <View>
        <Text style={styles.section}>Messages</Text>
        {msgSearch.data!.map((m) => (
          <Pressable key={m.id} onPress={() => (m.matchId ? router.push(`/chat/${m.matchId}`) : router.push(`/group/${m.groupId}`))} style={styles.msgHit} accessibilityRole="button">
            <View style={styles.top}>
              <Text style={styles.name} numberOfLines={1}>
                {m.senderId === me ? 'You' : m.senderName}
              </Text>
              <Text style={styles.time}>{when(m.createdAt)}</Text>
            </View>
            <Text style={[styles.preview, styles.previewRead]} numberOfLines={2}>
              {m.body}
            </Text>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <TabScreen>
      <TabHeader
        title="Chats"
        right={
          <Pressable onPress={() => router.push('/new-group')} style={styles.newGroup} accessibilityRole="button" accessibilityLabel="New group">
            <Ionicons name="people-outline" size={18} color={c.primary} />
            <Text style={styles.newGroupText}>New group</Text>
          </Pressable>
        }
      />
      <View style={styles.search}>
        <Ionicons name="search" size={17} color={c.textSecondary} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search chats and messages" placeholderTextColor={c.textSecondary} style={styles.searchInput} accessibilityLabel="Search chats and messages" />
      </View>

      {chats.isLoading ? (
        <ActivityIndicator color={c.primary} style={styles.loading} />
      ) : chats.error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load chats" body={chats.error.message} action={<Button title="Try again" size="sm" onPress={() => chats.refetch()} />} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(m) => (m.kind === 'group' ? `g${m.groupId}` : `m${m.matchId}`)}
          renderItem={({ item }) =>
            item.kind === 'group' ? <GroupRow g={item} me={me} onLongPress={() => chatMenu(qc, item)} /> : <Row c={item} me={me} onLongPress={() => chatMenu(qc, item)} />
          }
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={
            q && (msgSearch.data?.length ?? 0) > 0 ? null : (
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title={q ? 'No results' : filter === 'unread' ? 'No unread chats' : filter === 'groups' ? 'No groups yet' : 'No chats yet'}
                body={q ? 'Try another name or word.' : filter !== 'all' ? '' : 'When you match with someone, your conversation will show up here.'}
                action={!q && filter === 'all' ? <Button title="Find people" size="sm" variant="secondary" onPress={() => router.navigate('/featured')} /> : undefined}
              />
            )
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={chats.isRefetching}
              onRefresh={() => {
                chats.refetch();
                qc.invalidateQueries({ queryKey: chatKeys.stories });
              }}
              tintColor={c.primary}
            />
          }
        />
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: Spacing.six },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F6E6F1' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: Fonts.bold, fontSize: 16, color: c.text },
  time: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  preview: { flex: 1, fontFamily: Fonts.semibold, fontSize: 13, color: c.text, marginTop: 2 },
  previewRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  typing: { color: c.primary, fontFamily: Fonts.semibold },
  previewRead: { fontFamily: Fonts.medium, color: c.textSecondary },
  online: { position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#3CCB6C', borderWidth: 2, borderColor: '#fff' },
  groupAvatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBE3F1' },
  newGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: c.borderStrong, marginRight: 52 },
  newGroupText: { fontFamily: Fonts.bold, fontSize: 13, color: c.primary },
  megaphone: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  newDot: { minWidth: 22, alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: c.primary },
  newText: { fontFamily: Fonts.bold, fontSize: 11, color: '#fff' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stories: { gap: 14, paddingVertical: Spacing.two },
  story: { alignItems: 'center', width: 66, gap: 4 },
  ring: { width: 62, height: 62, borderRadius: 31, borderWidth: 2.5, padding: 2, alignItems: 'center', justifyContent: 'center' },
  storyAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F6E6F1' },
  addBadge: { position: 'absolute', right: -1, bottom: -1, width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  storyName: { fontFamily: Fonts.medium, fontSize: 12, color: c.text },
  filters: { flexDirection: 'row', gap: 8, paddingBottom: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.75)' },
  chipOn: { backgroundColor: '#FBE3F1' },
  chipText: { fontFamily: Fonts.semibold, fontSize: 13, color: c.textSecondary },
  archive: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
  section: { fontFamily: Fonts.bold, fontSize: 13, color: c.textSecondary, marginTop: Spacing.three, marginBottom: 4 },
  msgHit: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderStrong },
});
