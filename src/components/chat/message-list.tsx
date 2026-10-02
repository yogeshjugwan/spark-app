import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { systemText, type ChatMessage } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';
import { Image } from 'expo-image';

import { MessageBubble, type Tick } from './message-bubble';
import { setVoiceQueue } from './voice-note';

const c = Colors.light;
const GROUP_GAP_MS = 5 * 60 * 1000;
const REPLY_THRESHOLD = 64;

type Row =
  | { kind: 'msg'; key: string; m: ChatMessage; tail: boolean; showName: boolean }
  | { kind: 'album'; key: string; items: ChatMessage[]; tail: boolean; showName: boolean }
  | { kind: 'system'; key: string; m: ChatMessage }
  | { kind: 'day'; key: string; label: string }
  | { kind: 'unread'; key: string; count: number };

/** "Today", "Yesterday", "Monday", "12 Sep 2025" — WhatsApp date chips. */
function dayLabel(d: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (today.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: today.getFullYear() === d.getFullYear() ? undefined : 'numeric' });
}

/** Oldest→newest messages into rows with day chips, the unread divider, and bubble grouping. */
function buildRows(messages: ChatMessage[], unreadAfter: number | null, me: number): Row[] {
  const rows: Row[] = [];
  let unreadPlaced = false;
  const unreadCount = unreadAfter == null ? 0 : messages.filter((m) => m.id > unreadAfter && m.senderId !== me).length;
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const d = new Date(m.createdAt);
    if (!prev || new Date(prev.createdAt).toDateString() !== d.toDateString()) rows.push({ kind: 'day', key: `day-${d.toDateString()}`, label: dayLabel(d) });
    if (!unreadPlaced && unreadAfter != null && unreadCount > 0 && m.id > unreadAfter && m.senderId !== me) {
      rows.push({ kind: 'unread', key: 'unread', count: unreadCount });
      unreadPlaced = true;
    }
    if (m.data?.system) {
      rows.push({ kind: 'system', key: `sys-${m.id}`, m });
      return;
    }
    const last = rows[rows.length - 1];
    // Photos sent together (same albumId) collapse into one grid bubble.
    const albumId = m.type === 'image' && !m.deleted && !m.viewOnce ? m.data?.albumId : undefined;
    if (albumId && last && ((last.kind === 'album' && last.items[0].data?.albumId === albumId) || (last.kind === 'msg' && last.m.data?.albumId === albumId && last.m.type === 'image' && !last.m.body))) {
      if (last.kind === 'album') last.items.push(m);
      else rows[rows.length - 1] = { kind: 'album', key: `album-${albumId}`, items: [last.m, m], tail: last.tail, showName: last.showName };
      return;
    }
    const lastSender = last?.kind === 'msg' ? last.m.senderId : last?.kind === 'album' ? last.items[0].senderId : null;
    const startsRun = !prev || lastSender !== m.senderId || d.getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS || (last?.kind !== 'msg' && last?.kind !== 'album');
    rows.push({ kind: 'msg', key: m.clientId ?? String(m.id), m, tail: startsRun, showName: startsRun });
  });
  return rows;
}

/** Swipe a bubble right to reply (WhatsApp); long-press for the actions sheet. */
function SwipeToReply({ children, onReply, onLongPress, enabled, selecting, onTap }: { children: ReactElement; onReply: () => void; onLongPress: () => void; enabled: boolean; selecting?: boolean; onTap?: () => void }) {
  const x = useSharedValue(0);
  const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  const pan = Gesture.Pan()
    .enabled(enabled && !selecting)
    .activeOffsetX(12)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      x.value = Math.max(0, Math.min(e.translationX, REPLY_THRESHOLD + 20));
    })
    .onEnd(() => {
      if (x.value >= REPLY_THRESHOLD) {
        runOnJS(buzz)();
        runOnJS(onReply)();
      }
      x.value = withSpring(0);
    });
  const press = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => {
      runOnJS(buzz)();
      runOnJS(onLongPress)();
    });
  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const icon = useAnimatedStyle(() => ({ opacity: Math.min(1, x.value / REPLY_THRESHOLD), transform: [{ scale: Math.min(1, 0.5 + x.value / (REPLY_THRESHOLD * 2)) }] }));
  return (
    <GestureDetector gesture={selecting ? Gesture.Tap().onEnd(() => onTap && runOnJS(onTap)()) : Gesture.Race(pan, press)}>
      <View>
        <Animated.View style={[styles.replyIcon, icon]} pointerEvents="none">
          <Ionicons name="arrow-undo" size={18} color={c.primary} />
        </Animated.View>
        <Animated.View style={bubble}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

export interface MessageListHandle {
  /** Scroll to a message by id (pinned banner, search results, quoted message). */
  jumpTo: (id: number) => void;
}

export const MessageList = forwardRef<
  MessageListHandle,
  {
    messages: ChatMessage[];
    me: number;
    /** userId → first name, for group sender labels and reply authors. */
    names: Map<number, string>;
    isGroup: boolean;
    tickFor: (m: ChatMessage) => Tick | undefined;
    /** Messages from others after this id are unread (divider shown when the chat opens). */
    unreadAfter: number | null;
    loadOlder: () => void;
    header?: ReactElement | null;
    onReply: (m: ChatMessage) => void;
    onLongPress: (m: ChatMessage) => void;
    onRetry: (m: ChatMessage) => void;
    starredIds?: Set<number>;
    /** View-once message ids already opened (by them for mine, by me for theirs). */
    openedIds?: Set<number>;
    highlight?: string;
    /** Multi-select mode (forward / delete / star several). */
    selected?: Set<number> | null;
    onToggleSelect?: (m: ChatMessage) => void;
    onVote?: (m: ChatMessage, options: number[]) => void;
    onOpenMedia?: (m: ChatMessage) => void;
    onOpenViewOnce?: (m: ChatMessage) => void;
    onJoinCall?: (m: ChatMessage) => void;
  }
>(function MessageList(
  {
    messages,
    me,
    names,
    isGroup,
    tickFor,
    unreadAfter,
    loadOlder,
    header,
    onReply,
    onLongPress,
    onRetry,
    starredIds,
    openedIds,
    highlight,
    selected,
    onToggleSelect,
    onVote,
    onOpenMedia,
    onOpenViewOnce,
    onJoinCall,
  },
  ref,
) {
  const listRef = useRef<FlatList<Row>>(null);
  const rows = useMemo(() => buildRows(messages, unreadAfter, me), [messages, unreadAfter, me]);
  const inverted = useMemo(() => [...rows].reverse(), [rows]);
  const [flash, setFlash] = useState<number | null>(null);

  // Voice notes in order, so a finished one can start the next (WhatsApp auto-play).
  useEffect(() => {
    setVoiceQueue(messages.filter((m) => m.type === 'voice' && m.id > 0 && !m.deleted && !m.viewOnce).map((m) => m.id));
  }, [messages]);

  // Scroll-to-bottom button with a count of messages that arrived while scrolled up.
  const [scrolledUp, setScrolledUp] = useState(false);
  const [seenCount, setSeenCount] = useState(messages.length);
  const newWhileUp = scrolledUp ? Math.max(0, messages.length - seenCount) : 0;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const up = e.nativeEvent.contentOffset.y > 300; // inverted list: offset grows as you scroll into the past
    if (up !== scrolledUp) {
      setScrolledUp(up);
      setSeenCount(messages.length);
    }
  };
  const jumpToBottom = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setSeenCount(messages.length);
  };

  const author = (id: number) => (id === me ? 'You' : (names.get(id) ?? ''));
  const jumpTo = (id: number) => {
    const index = inverted.findIndex((r) => (r.kind === 'msg' && r.m.id === id) || (r.kind === 'album' && r.items.some((x) => x.id === id)));
    if (index < 0) return false;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1500);
    return true;
  };
  useImperativeHandle(ref, () => ({ jumpTo: (id) => void jumpTo(id) }));

  const selecting = !!selected;
  const rowShell = (key: number, mine: boolean, child: ReactElement, m: ChatMessage, tail: boolean) => {
    const isSel = !!selected?.has(key);
    return (
      <View style={[styles.item, tail && styles.itemGap, (isSel || flash === key) && styles.itemSelected]}>
        {selecting && (
          <View style={[styles.check, mine ? { left: 0 } : { left: 0 }]} pointerEvents="none">
            <Ionicons name={isSel ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={isSel ? c.primary : c.textSecondary} />
          </View>
        )}
        <View style={selecting && styles.shifted}>
          <SwipeToReply enabled={m.id > 0 && !m.deleted} selecting={selecting} onTap={() => onToggleSelect?.(m)} onReply={() => onReply(m)} onLongPress={() => onLongPress(m)}>
            {child}
          </SwipeToReply>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <FlatList
        ref={listRef}
        inverted
        data={inverted}
        keyExtractor={(r) => r.key}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onScrollToIndexFailed={() => {}}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
        ListFooterComponent={header}
        extraData={[selected, flash, starredIds, openedIds, highlight]}
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return (
              <View style={styles.dayChip} accessibilityRole="header">
                <Text style={styles.dayText}>{item.label}</Text>
              </View>
            );
          }
          if (item.kind === 'unread') {
            return (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>
                  {item.count} unread message{item.count === 1 ? '' : 's'}
                </Text>
              </View>
            );
          }
          if (item.kind === 'system') {
            return (
              <View style={styles.system}>
                <Ionicons name="timer-outline" size={13} color={c.textSecondary} />
                <Text style={styles.systemText}>{systemText(item.m, item.m.senderId === me)}</Text>
              </View>
            );
          }
          if (item.kind === 'album') {
            const first = item.items[0];
            const mine = first.senderId === me;
            const shown = item.items.slice(0, 4);
            const extra = item.items.length - 4;
            return rowShell(
              first.id,
              mine,
              <View style={[styles.albumSide, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                {isGroup && !mine && item.showName && <Text style={styles.sender}>{names.get(first.senderId) ?? ''}</Text>}
                <View style={[styles.album, { backgroundColor: mine ? '#EC7CC0' : '#fff' }]}>
                  {shown.map((x, i) => (
                    <Pressable key={x.clientId ?? x.id} onPress={() => (selecting ? onToggleSelect?.(first) : onOpenMedia?.(x))} style={styles.albumCell} accessibilityRole="imagebutton" accessibilityLabel={`Photo ${i + 1} of ${item.items.length}`}>
                      <Image source={x.localUri ?? mediaUrl(x.url)} style={styles.albumImg} contentFit="cover" />
                      {i === 3 && extra > 0 && (
                        <View style={styles.albumMore}>
                          <Text style={styles.albumMoreText}>+{extra}</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.albumTime}>
                  {new Date(first.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  {item.items.some((x) => x.status === 'sending') ? ' · sending…' : ''}
                </Text>
              </View>,
              first,
              item.tail,
            );
          }
          const m = item.m;
          const mine = m.senderId === me;
          const mentionNames = m.data?.mentions?.map((id) => (id === me ? 'You' : names.get(id))).filter((x): x is string => !!x);
          return rowShell(
            m.id,
            mine,
            <MessageBubble
              m={m}
              mine={mine}
              me={me}
              tick={mine ? tickFor(m) : undefined}
              name={names.get(m.senderId) ?? ''}
              senderLabel={isGroup && item.showName ? (names.get(m.senderId) ?? 'Former member') : undefined}
              tail={item.tail}
              quoteAuthor={m.replyTo ? author(m.replyTo.senderId) : undefined}
              onRetry={() => onRetry(m)}
              onQuotePress={m.replyTo ? () => jumpTo(m.replyTo!.id) : undefined}
              onReactionsPress={() => onLongPress(m)}
              starred={starredIds?.has(m.id)}
              opened={openedIds?.has(m.id)}
              highlight={highlight}
              mentionNames={mentionNames?.length ? [...mentionNames, ...mentionNames.map((n) => n.split(' ')[0])] : undefined}
              onVote={onVote ? (o) => onVote(m, o) : undefined}
              onOpenMedia={() => (selecting ? onToggleSelect?.(m) : onOpenMedia?.(m))}
              onOpenViewOnce={() => onOpenViewOnce?.(m)}
              onJoinCall={() => onJoinCall?.(m)}
            />,
            m,
            item.tail,
          );
        }}
      />

      {scrolledUp && (
        <Pressable onPress={jumpToBottom} style={styles.fab} accessibilityRole="button" accessibilityLabel={newWhileUp ? `${newWhileUp} new messages. Scroll to latest` : 'Scroll to latest'}>
          <Ionicons name="chevron-down" size={22} color={c.text} />
          {newWhileUp > 0 && (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeText}>{newWhileUp > 99 ? '99+' : newWhileUp}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  item: { marginTop: 2, borderRadius: 8 },
  itemSelected: { backgroundColor: 'rgba(224,99,178,0.16)' },
  check: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', zIndex: 2 },
  shifted: { marginLeft: 30 },
  system: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '85%', marginVertical: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,245,200,0.95)' },
  systemText: { fontFamily: Fonts.medium, fontSize: 12, color: c.text, textAlign: 'center', flexShrink: 1 },
  sender: { fontFamily: Fonts.bold, fontSize: 12, color: c.primary, marginLeft: 6, marginBottom: 2 },
  albumSide: { maxWidth: '82%' },
  album: { width: 236, flexDirection: 'row', flexWrap: 'wrap', gap: 3, padding: 3, borderRadius: 18 },
  albumCell: { width: 113, height: 113 },
  albumImg: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#F6E6F1' },
  albumMore: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  albumMoreText: { fontFamily: Fonts.bold, fontSize: 24, color: '#fff' },
  albumTime: { fontFamily: Fonts.medium, fontSize: 11, color: c.textSecondary, alignSelf: 'flex-end', marginTop: 2, marginRight: 6 },
  itemGap: { marginTop: 8 },
  replyIcon: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center', paddingLeft: 4 },
  dayChip: { alignSelf: 'center', marginVertical: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.85)' },
  dayText: { fontFamily: Fonts.semibold, fontSize: 12, color: c.textSecondary },
  unread: { alignSelf: 'stretch', alignItems: 'center', marginVertical: 8, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.7)' },
  unreadText: { fontFamily: Fonts.bold, fontSize: 12, color: c.primary },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabBadge: { position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  fabBadgeText: { fontFamily: Fonts.bold, fontSize: 11, color: '#fff' },
});
