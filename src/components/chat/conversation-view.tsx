import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { chatKeys, convApi, quoteText, type ChatMessage, type ConvRef } from '@/lib/chat-api';
import { joinGroupCall } from '@/lib/group-calls';
import { startLiveSharing } from '@/lib/live-location';
import { mediaUrl } from '@/lib/media';
import { patchMessage, upsertMessage } from '@/lib/use-chat-socket';
import { useConversation, type Draft } from '@/lib/use-conversation';

import { Composer, type Mentionable } from './composer';
import { ForwardSheet } from './forward-sheet';
import { MessageActions, canEdit } from './message-actions';
import type { Tick } from './message-bubble';
import { MessageList, type MessageListHandle } from './message-list';
import { openViewer, type ViewerItem } from './media-viewer';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';

const c = Colors.light;
export const WALLPAPERS: Record<string, string> = {
  default: 'transparent',
  blush: '#FCE4EC',
  lavender: '#EDE7F6',
  mint: '#E0F2F1',
  sky: '#E3F2FD',
  sand: '#FFF3E0',
  night: '#2B2233',
};

/**
 * Everything below the chat header, shared by 1:1 and group chats: message list, pinned message,
 * search, multi-select, long-press actions, forwarding, media viewer, view-once, composer.
 */
export function ConversationView({
  conv,
  messages,
  loadOlder,
  loading,
  error,
  me,
  names,
  isGroup,
  tickFor,
  unreadAfter,
  intro,
  members,
  onGift,
  onTyping,
  search,
  onCloseSearch,
}: {
  conv: ConvRef;
  messages: ChatMessage[];
  loadOlder: () => void;
  loading: boolean;
  error: string | null;
  me: number;
  names: Map<number, string>;
  isGroup: boolean;
  tickFor: (m: ChatMessage) => Tick | undefined;
  unreadAfter: number | null;
  intro?: ReactElement | null;
  members?: Mentionable[];
  onGift?: () => void;
  onTyping?: () => void;
  /** In-chat search: null = closed. */
  search: boolean;
  onCloseSearch: () => void;
}) {
  const qc = useQueryClient();
  const list = useRef<MessageListHandle>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [forwardIds, setForwardIds] = useState<number[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionsNow, setActionsNow] = useState(0);
  const { send, retry, discard, react, remove, edit, vote } = useConversation(conv);

  const state = useQuery({ queryKey: chatKeys.state(conv), queryFn: async () => (await convApi.state(conv)).data });
  const st = state.data;
  const starredIds = useMemo(() => new Set(st?.starredIds ?? []), [st?.starredIds]);
  // Mine: opened by anyone else. Theirs: opened by me.
  const openedIds = useMemo(() => {
    const byId = new Map(messages.map((m) => [m.id, m.senderId]));
    return new Set((st?.opened ?? []).filter((o) => (byId.get(o.messageId) === me ? o.userId !== me : o.userId === me)).map((o) => o.messageId));
  }, [st?.opened, messages, me]);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((x) => (x === t ? null : x)), 1800);
  };

  // ---- search
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<number[]>([]);
  const [hitIndex, setHitIndex] = useState(0);
  const runSearch = async () => {
    if (!q.trim()) return;
    const res = await convApi.search(conv, q.trim());
    const ids = res.data.messages.map((m) => m.id); // newest first
    setHits(ids);
    setHitIndex(0);
    if (ids[0]) list.current?.jumpTo(ids[0]);
    else flash('No messages found');
  };
  const stepHit = (d: 1 | -1) => {
    const next = Math.min(hits.length - 1, Math.max(0, hitIndex + d));
    setHitIndex(next);
    list.current?.jumpTo(hits[next]);
  };
  const closeSearch = () => {
    setQ('');
    setHits([]);
    onCloseSearch();
  };

  // ---- sending
  const onSend = async (draft: Draft) => {
    const replying = replyTo;
    setReplyTo(null);
    const m = await send(draft, replying);
    // Live location: keep it updated from this phone.
    if (m && m.type === 'location' && m.data?.live && m.data.until) startLiveSharing(m.id, new Date(m.data.until)).catch(() => {});
  };

  // ---- media viewer: every photo/video in the chat, opened at the tapped one
  const openMedia = (m: ChatMessage) => {
    const media = messages.filter((x) => (x.type === 'image' || x.type === 'video') && !x.deleted && !x.viewOnce && (x.url || x.localUri || x.data?.gif));
    const items: ViewerItem[] = media.map((x) => ({
      key: String(x.clientId ?? x.id),
      type: x.type === 'video' ? 'video' : 'image',
      uri: x.data?.gif ?? x.localUri ?? mediaUrl(x.url)!,
      caption: x.body,
      title: x.senderId === me ? 'You' : (names.get(x.senderId) ?? ''),
      subtitle: new Date(x.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }));
    openViewer(items, media.findIndex((x) => x.id === m.id));
  };
  const openOnce = async (m: ChatMessage) => {
    try {
      const res = await convApi.open(m.id);
      qc.invalidateQueries({ queryKey: chatKeys.state(conv) });
      if (res.data.type === 'voice') {
        // A view-once voice note plays once, full screen isn't needed.
        openViewer([{ key: `once-${m.id}`, type: 'video', uri: mediaUrl(res.data.url)!, title: 'View once voice message' }], 0, true);
      } else openViewer([{ key: `once-${m.id}`, type: res.data.type === 'video' ? 'video' : 'image', uri: mediaUrl(res.data.url)!, title: names.get(m.senderId) ?? '' }], 0, true);
    } catch (e) {
      Alert.alert('Can’t open', e instanceof Error ? e.message : String(e));
    }
  };

  // ---- actions
  const star = async (ids: number[], on: boolean) => {
    qc.setQueryData(chatKeys.state(conv), (s: typeof st) => (s ? { ...s, starredIds: on ? [...new Set([...s.starredIds, ...ids])] : s.starredIds.filter((x) => !ids.includes(x)) } : s));
    await Promise.all(ids.map((id) => convApi.star(id, on))).catch(() => qc.invalidateQueries({ queryKey: chatKeys.state(conv) }));
    qc.invalidateQueries({ queryKey: chatKeys.starred });
  };
  const pin = async (m: ChatMessage, on: boolean) => {
    try {
      await convApi.pin(conv, on ? m.id : null);
      qc.invalidateQueries({ queryKey: chatKeys.state(conv) });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    }
  };
  const toggleSelect = (m: ChatMessage) => {
    if (m.id < 0) return;
    setSelected((s) => {
      const next = new Set(s ?? []);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next.size ? next : null;
    });
  };
  const selectedMsgs = messages.filter((m) => selected?.has(m.id));
  const deleteSelected = () => {
    const all = selectedMsgs;
    const mineRecent = all.every((m) => m.senderId === me && !m.deleted && Date.now() - new Date(m.createdAt).getTime() < 48 * 3600e3 && m.type !== 'gift' && m.type !== 'call');
    const run = async (everyone: boolean) => {
      setSelected(null);
      for (const m of all) await remove(m, everyone).catch(() => {});
    };
    Alert.alert(`Delete ${all.length} message${all.length === 1 ? '' : 's'}?`, undefined, [
      ...(mineRecent ? [{ text: 'Delete for everyone', style: 'destructive' as const, onPress: () => run(true) }] : []),
      { text: 'Delete for me', style: 'destructive', onPress: () => run(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const copySelected = () => {
    const text = selectedMsgs
      .filter((m) => m.body)
      .map((m) => m.body)
      .join('\n');
    Clipboard.setStringAsync(text).catch(() => {});
    setSelected(null);
    flash('Copied');
  };

  const bg = WALLPAPERS[st?.prefs.wallpaper ?? 'default'] ?? st?.prefs.wallpaper ?? 'transparent';
  const pinned = st?.pinned;

  return (
    <View style={[styles.flex, { backgroundColor: bg }]}>
      {selected ? (
        <View style={styles.selectBar}>
          <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel selection">
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
          <Text style={styles.selectCount}>{selected.size}</Text>
          <Pressable onPress={() => star([...selected], !selectedMsgs.every((m) => starredIds.has(m.id)))} style={styles.selBtn} accessibilityLabel="Star">
            <Ionicons name={selectedMsgs.every((m) => starredIds.has(m.id)) ? 'star' : 'star-outline'} size={22} color={c.text} />
          </Pressable>
          <Pressable onPress={copySelected} style={styles.selBtn} accessibilityLabel="Copy">
            <Ionicons name="copy-outline" size={22} color={c.text} />
          </Pressable>
          <Pressable onPress={deleteSelected} style={styles.selBtn} accessibilityLabel="Delete">
            <Ionicons name="trash-outline" size={22} color={c.danger} />
          </Pressable>
          <Pressable
            onPress={() => {
              setForwardIds(selectedMsgs.filter((m) => !m.deleted && !m.viewOnce && !['gift', 'call', 'request', 'poll'].includes(m.type)).map((m) => m.id));
              setSelected(null);
            }}
            style={styles.selBtn}
            accessibilityLabel="Forward">
            <Ionicons name="arrow-redo-outline" size={22} color={c.text} />
          </Pressable>
        </View>
      ) : search ? (
        <View style={styles.selectBar}>
          <Pressable onPress={closeSearch} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close search">
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={runSearch} placeholder="Search…" placeholderTextColor={c.textSecondary} style={styles.searchInput} autoFocus returnKeyType="search" />
          {hits.length > 0 && (
            <Text style={styles.hitCount}>
              {hitIndex + 1}/{hits.length}
            </Text>
          )}
          <Pressable onPress={() => stepHit(1)} disabled={hitIndex >= hits.length - 1} style={styles.selBtn} accessibilityLabel="Older result">
            <Ionicons name="chevron-up" size={22} color={hitIndex >= hits.length - 1 ? c.borderStrong : c.text} />
          </Pressable>
          <Pressable onPress={() => stepHit(-1)} disabled={hitIndex <= 0} style={styles.selBtn} accessibilityLabel="Newer result">
            <Ionicons name="chevron-down" size={22} color={hitIndex <= 0 ? c.borderStrong : c.text} />
          </Pressable>
        </View>
      ) : null}

      {pinned && !selected && (
        <Pressable onPress={() => list.current?.jumpTo(pinned.id)} style={styles.pinned} accessibilityRole="button" accessibilityLabel={`Pinned message: ${quoteText(pinned)}`}>
          <Ionicons name="pin" size={16} color={c.primary} />
          <Text style={styles.pinnedText} numberOfLines={1}>
            {quoteText(pinned)}
          </Text>
          {st?.isAdmin && (
            <Pressable onPress={() => pin(pinned, false)} hitSlop={10} accessibilityLabel="Unpin">
              <Ionicons name="close" size={18} color={c.textSecondary} />
            </Pressable>
          )}
        </Pressable>
      )}

      {/* Expo 57 is edge-to-edge on Android too, so the window no longer resizes for the keyboard: pad on both platforms. */}
      <KeyboardAvoider style={styles.flex}>
        {loading ? (
          <ActivityIndicator color={c.primary} style={styles.flex} />
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <MessageList
            ref={list}
            messages={messages}
            me={me}
            names={names}
            isGroup={isGroup}
            tickFor={tickFor}
            unreadAfter={unreadAfter}
            loadOlder={loadOlder}
            header={messages.length === 0 ? intro : null}
            onReply={setReplyTo}
            onLongPress={(m) => {
              setActionsNow(Date.now());
              setActionsFor(m);
            }}
            onRetry={retry}
            starredIds={starredIds}
            openedIds={openedIds}
            highlight={search ? q : undefined}
            selected={selected}
            onToggleSelect={toggleSelect}
            onVote={vote}
            onOpenMedia={openMedia}
            onOpenViewOnce={openOnce}
            onJoinCall={(m) => {
              if (m.data?.callId) joinGroupCall(m.data.callId, m.meta?.startsWith('group-video') ? 'video' : 'audio').catch((e: Error) => setSendError(e.message));
            }}
          />
        )}

        {!!toast && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        <Composer
          onSend={onSend}
          onGift={onGift}
          onTyping={onTyping}
          error={sendError}
          onDismissError={() => setSendError(null)}
          replyTo={replyTo ? { author: replyTo.senderId === me ? 'You' : (names.get(replyTo.senderId) ?? ''), text: quoteText(replyTo) } : null}
          onCancelReply={() => setReplyTo(null)}
          members={members}
          editing={editing ? { text: editing.body ?? '' } : null}
          onCancelEdit={() => setEditing(null)}
          onSubmitEdit={(body) => {
            const m = editing!;
            setEditing(null);
            if (body !== m.body) edit(m, body).catch((e: Error) => setSendError(e.message));
          }}
          blocked={st && !st.canSend ? 'Only admins can send messages' : null}
        />
      </KeyboardAvoider>

      <MessageActions
        message={actionsFor}
        me={me}
        onClose={() => setActionsFor(null)}
        onReact={react}
        onReply={setReplyTo}
        onDelete={(m, everyone) => remove(m, everyone).catch((e: Error) => setSendError(e.message))}
        onRetry={retry}
        onDiscard={discard}
        editable={!!actionsFor && canEdit(actionsFor, me, actionsNow)}
        starred={!!actionsFor && starredIds.has(actionsFor.id)}
        pinned={!!actionsFor && pinned?.id === actionsFor.id}
        canPin={!!st?.isAdmin}
        onEdit={setEditing}
        onStar={(m, on) => star([m.id], on)}
        onPin={pin}
        onForward={(m) => setForwardIds([m.id])}
        onSelect={(m) => setSelected(new Set([m.id]))}
      />
      <ForwardSheet messageIds={forwardIds} onClose={() => setForwardIds([])} onDone={(n) => flash(`Forwarded to ${n} chat${n === 1 ? '' : 's'}`)} />
    </View>
  );
}

/** Keep optimistic helpers importable from one place for screens. */
export { patchMessage, upsertMessage };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  errorText: { fontFamily: Fonts.medium, color: c.danger, textAlign: 'center' },
  selectBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.three, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderStrong },
  selectCount: { flex: 1, fontFamily: Fonts.bold, fontSize: 18, color: c.text },
  selBtn: { padding: 6 },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 16, color: c.text, paddingVertical: 6 },
  hitCount: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderStrong },
  pinnedText: { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: c.text },
  toast: { position: 'absolute', alignSelf: 'center', bottom: 90, backgroundColor: 'rgba(40,20,35,0.85)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  toastText: { fontFamily: Fonts.semibold, fontSize: 13, color: '#fff' },
});
