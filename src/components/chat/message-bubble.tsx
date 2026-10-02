import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Gradients } from '@/constants/theme';
import { callLabel, quoteText, type ChatMessage } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';

import { ContactCard, FileCard, LinkCard, LocationCard, PollCard, RichText, STICKERS } from './rich-content';
import { VoiceNote } from './voice-note';

const c = Colors.light;
const GIFT = { rose: { emoji: '🌹', label: 'a rose' }, chocolate: { emoji: '🍫', label: 'chocolates' }, ring: { emoji: '💍', label: 'a ring' } } as const;
const BLUE_TICK = '#34B7F1';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

/** WhatsApp tick states for my messages. */
export type Tick = 'sending' | 'failed' | 'sent' | 'delivered' | 'read';

function Ticks({ tick, onDark }: { tick: Tick; onDark: boolean }) {
  const dim = onDark ? 'rgba(255,255,255,0.85)' : c.textSecondary;
  if (tick === 'sending') return <Ionicons name="time-outline" size={13} color={dim} accessibilityLabel="Sending" />;
  if (tick === 'failed') return <Ionicons name="alert-circle" size={15} color={c.danger} accessibilityLabel="Not sent" />;
  if (tick === 'sent') return <Ionicons name="checkmark" size={15} color={dim} accessibilityLabel="Sent" />;
  return <Ionicons name="checkmark-done" size={15} color={tick === 'read' ? BLUE_TICK : dim} accessibilityLabel={tick === 'read' ? 'Read' : 'Delivered'} />;
}

/** The quoted message shown at the top of a reply. */
function Quote({ q, mine, author, onPress }: { q: NonNullable<ChatMessage['replyTo']>; mine: boolean; author: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]} accessibilityRole="button" accessibilityLabel={`Reply to ${author}: ${quoteText(q)}`}>
      <Text style={[styles.quoteAuthor, mine && { color: '#fff' }]} numberOfLines={1}>
        {author}
      </Text>
      <Text style={[styles.quoteText, mine && { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={2}>
        {quoteText(q)}
      </Text>
    </Pressable>
  );
}

/** Grouped emoji chips under a bubble: ❤️ 2  😂. */
function Reactions({ reactions, mine, me, onPress }: { reactions: ChatMessage['reactions']; mine: boolean; me: number; onPress?: () => void }) {
  if (reactions.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const mineToo = reactions.some((r) => r.userId === me);
  return (
    <Pressable onPress={onPress} style={[styles.reactions, mine ? styles.reactionsMine : styles.reactionsTheirs, mineToo && styles.reactionsSelected]} accessibilityLabel={`Reactions: ${[...counts].map(([e, n]) => `${e} ${n}`).join(', ')}`}>
      {[...counts].map(([emoji, n]) => (
        <Text key={emoji} style={styles.reactionText}>
          {emoji}
          {n > 1 ? ` ${n}` : ''}
        </Text>
      ))}
    </Pressable>
  );
}

export function MessageBubble({
  m,
  mine,
  me,
  tick,
  name,
  senderLabel,
  tail,
  quoteAuthor,
  onRetry,
  onQuotePress,
  onReactionsPress,
  starred,
  highlight,
  mentionNames,
  onVote,
  onOpenMedia,
  onOpenViewOnce,
  opened,
  onJoinCall,
}: {
  m: ChatMessage;
  mine: boolean;
  /** My user id (to highlight my reaction). */
  me: number;
  tick?: Tick;
  /** The other person's first name (gift/request wording). */
  name: string;
  /** Group chats: the sender's name above their bubble. */
  senderLabel?: string;
  /** First bubble in a run from the same person gets the pointed corner. */
  tail: boolean;
  /** Who wrote the message being replied to ("You", "Meera"). */
  quoteAuthor?: string;
  onRetry?: () => void;
  onQuotePress?: () => void;
  onReactionsPress?: () => void;
  starred?: boolean;
  /** Search term to highlight in the text. */
  highlight?: string;
  /** Names of people @mentioned in this message. */
  mentionNames?: string[];
  onVote?: (options: number[]) => void;
  onOpenMedia?: () => void;
  onOpenViewOnce?: () => void;
  /** View-once: has the other person (for mine) / have I (for theirs) opened it. */
  opened?: boolean;
  /** Group call card: join the call. */
  onJoinCall?: () => void;
}) {
  const label = !mine && senderLabel ? <Text style={styles.sender}>{senderLabel}</Text> : null;
  const side = mine ? styles.right : styles.left;
  const dimOn = (onDark: boolean) => (onDark ? 'rgba(255,255,255,0.85)' : c.textSecondary);
  const meta = (onDark: boolean) => (
    <View style={[styles.metaRow, onDark && styles.metaOnDark]}>
      {starred && <Ionicons name="star" size={11} color={dimOn(onDark)} accessibilityLabel="Starred" />}
      {!!m.expiresAt && <Ionicons name="timer-outline" size={11} color={dimOn(onDark)} accessibilityLabel="Disappearing message" />}
      {!!m.editedAt && <Text style={[styles.time, onDark && { color: dimOn(true) }]}>Edited</Text>}
      <Text style={[styles.time, onDark && { color: 'rgba(255,255,255,0.85)' }]}>{time(m.createdAt)}</Text>
      {mine && tick && <Ticks tick={tick} onDark={onDark} />}
    </View>
  );
  const failed =
    m.status === 'failed' ? (
      <Pressable onPress={onRetry} style={styles.failed} accessibilityRole="button" accessibilityLabel="Not sent. Tap to retry">
        <Text style={styles.failedText}>Not sent · Tap to retry</Text>
      </Pressable>
    ) : null;
  const reactions = <Reactions reactions={m.reactions} mine={mine} me={me} onPress={onReactionsPress} />;
  const forwarded = m.forwarded ? (
    <View style={styles.fwd}>
      <Ionicons name="arrow-redo" size={12} color={mine ? 'rgba(255,255,255,0.85)' : c.textSecondary} />
      <Text style={[styles.fwdText, mine && { color: 'rgba(255,255,255,0.85)' }]}>Forwarded</Text>
    </View>
  ) : null;

  // ---- deleted
  if (m.deleted) {
    return (
      <View style={side}>
        {label}
        <View style={[styles.bubble, styles.bubbleDeleted, tail && (mine ? styles.tailMine : styles.tailTheirs)]}>
          <View style={styles.row}>
            <Ionicons name="ban-outline" size={14} color={c.textSecondary} />
            <Text style={styles.deletedText}>{mine ? 'You deleted this message' : 'This message was deleted'}</Text>
          </View>
          {meta(false)}
        </View>
      </View>
    );
  }

  // ---- sticker: big art, no bubble
  if (m.type === 'sticker') {
    return (
      <View style={side}>
        {label}
        <Text style={styles.sticker} accessibilityLabel="Sticker">
          {STICKERS[m.meta ?? ''] ?? '💖'}
        </Text>
        <View style={styles.stickerMeta}>{meta(false)}</View>
        {reactions}
      </View>
    );
  }

  // ---- view once: a pill until opened, then "Opened"
  if (m.viewOnce) {
    const what = m.type === 'video' ? 'Video' : m.type === 'voice' ? 'Voice message' : 'Photo';
    const canOpen = !mine && !opened && m.id > 0;
    const pill = (
      <Pressable
        onPress={canOpen ? onOpenViewOnce : undefined}
        style={[styles.bubble, mine ? styles.onceMine : styles.bubbleTheirs, tail && (mine ? styles.tailMine : styles.tailTheirs)]}
        accessibilityRole={canOpen ? 'button' : undefined}
        accessibilityLabel={`View once ${what}${opened ? ', opened' : canOpen ? ', tap to open' : ''}`}>
        <View style={styles.row}>
          <View style={[styles.onceIcon, { borderColor: mine ? '#fff' : c.primary }, opened && styles.onceIconDone]}>
            {opened ? <Ionicons name="checkmark" size={12} color={mine ? '#fff' : c.textSecondary} /> : <Text style={[styles.onceNum, { color: mine ? '#fff' : c.primary }]}>1</Text>}
          </View>
          <Text style={[styles.text, mine && styles.textMine, { fontFamily: Fonts.semibold }]}>{opened ? 'Opened' : what}</Text>
          {m.status === 'sending' && <ActivityIndicator size="small" color={mine ? '#fff' : c.primary} />}
        </View>
        <View style={styles.metaAbs}>{meta(mine)}</View>
      </Pressable>
    );
    return (
      <View style={side}>
        {label}
        {pill}
        {reactions}
        {failed}
      </View>
    );
  }

  // ---- cards (gift / request / call) keep their own look
  if (m.type === 'gift' || m.type === 'request' || m.type === 'call') {
    let body: React.ReactNode;
    if (m.type === 'gift') {
      const g = GIFT[m.meta as keyof typeof GIFT] ?? GIFT.rose;
      body = (
        <View style={styles.giftCard}>
          <Text style={styles.giftEmoji}>{g.emoji}</Text>
          <Text style={styles.giftTitle}>{mine ? `You sent ${g.label}` : `${name} sent you ${g.label}`}</Text>
          {!!m.body && <Text style={styles.giftNote}>“{m.body}”</Text>}
          {meta(false)}
        </View>
      );
    } else if (m.type === 'request') {
      const what = m.meta === 'video' ? 'a video' : 'a photo';
      body = (
        <View style={styles.card}>
          <Ionicons name={m.meta === 'video' ? 'videocam' : 'camera'} size={20} color={c.primary} />
          <Text style={styles.cardText}>{mine ? `You asked ${name} for ${what}` : `${name} would love ${what} of you`}</Text>
          {meta(false)}
        </View>
      );
    } else {
      const [type, status] = (m.meta ?? 'audio:ended').split(':');
      const missed = status !== 'ended' && status !== 'ongoing';
      const isGroup = type.startsWith('group-');
      const live = isGroup && status === 'ongoing';
      body = live ? (
        <Pressable onPress={onJoinCall} style={[styles.card, styles.liveCard]} accessibilityRole="button" accessibilityLabel={`${callLabel(m, mine)}. Join`}>
          <Ionicons name={type === 'group-video' ? 'videocam' : 'call'} size={18} color="#1FA855" />
          <Text style={styles.cardText}>{type === 'group-video' ? 'Group video call' : 'Group voice call'}</Text>
          <View style={styles.joinBtn}>
            <Text style={styles.joinText}>Join</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.card}>
          <Ionicons name={type.endsWith('video') ? 'videocam' : missed ? 'call-outline' : 'call'} size={18} color={missed && !mine && !isGroup ? c.danger : c.primary} />
          <Text style={[styles.cardText, missed && !mine && !isGroup && { color: c.danger }]}>{callLabel(m, mine)}</Text>
          {meta(false)}
        </View>
      );
    }
    return (
      <View style={side}>
        {label}
        {body}
        {reactions}
      </View>
    );
  }

  // ---- image / GIF / video
  if (m.type === 'image' || m.type === 'video') {
    const gif = m.data?.gif;
    const src = gif ?? m.localUri ?? mediaUrl(m.url);
    const ratio = m.data?.width && m.data?.height ? m.data.height / m.data.width : 1.25;
    const h = Math.max(140, Math.min(320, 230 * ratio));
    const onDark = !m.body;
    return (
      <View style={side}>
        {label}
        <View style={[styles.photoWrap, mine ? styles.photoMine : styles.photoTheirs, tail && (mine ? styles.tailMine : styles.tailTheirs)]}>
          {forwarded && <View style={{ paddingHorizontal: 6, paddingTop: 2 }}>{forwarded}</View>}
          {m.replyTo && <Quote q={m.replyTo} mine={mine} author={quoteAuthor ?? ''} onPress={onQuotePress} />}
          <Pressable onPress={onOpenMedia} accessibilityRole="imagebutton" accessibilityLabel={m.type === 'video' ? 'Video. Play' : gif ? 'GIF' : 'Photo. Open'}>
            {m.type === 'video' ? (
              <View style={[styles.photo, styles.videoBox, { height: 180 }]}>
                <Ionicons name="videocam" size={34} color="rgba(255,255,255,0.6)" />
                <View style={styles.playBig}>
                  <Ionicons name="play" size={26} color="#fff" />
                </View>
                {!!m.durationSec && (
                  <Text style={styles.videoDur}>
                    {Math.floor(m.durationSec / 60)}:{String(m.durationSec % 60).padStart(2, '0')}
                  </Text>
                )}
              </View>
            ) : (
              <Image source={src} style={[styles.photo, { height: gif ? 180 : h }]} contentFit="cover" transition={150} autoplay />
            )}
            {gif && (
              <View style={styles.gifBadge}>
                <Text style={styles.gifText}>GIF</Text>
              </View>
            )}
            {m.status === 'sending' && (
              <View style={styles.uploading}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            {onDark && <View style={styles.photoMeta}>{meta(true)}</View>}
          </Pressable>
          {!!m.body && (
            <View style={styles.caption}>
              <RichText body={m.body} mine={mine} highlight={highlight} style={[styles.text, mine && styles.textMine]} />
              {meta(mine)}
            </View>
          )}
        </View>
        {reactions}
        {failed}
      </View>
    );
  }

  // ---- text / voice / file / location / contact / poll
  let content: React.ReactNode;
  if (m.type === 'voice' && (m.url || m.localUri)) {
    content = <VoiceNote id={m.id} uri={m.localUri ?? mediaUrl(m.url)!} sec={m.durationSec ?? 0} mine={mine} waveform={m.data?.waveform} avatarLetter={name[0]} />;
  } else if (m.type === 'file') {
    content = <FileCard m={m} mine={mine} />;
  } else if (m.type === 'location') {
    content = <LocationCard m={m} mine={mine} />;
  } else if (m.type === 'contact') {
    content = <ContactCard m={m} mine={mine} />;
  } else if (m.type === 'poll') {
    content = <PollCard m={m} mine={mine} me={me} onVote={onVote} />;
  } else {
    content = (
      <>
        {m.data?.link && <LinkCard link={m.data.link} mine={mine} />}
        <RichText body={m.body ?? ''} mine={mine} mentionNames={mentionNames} highlight={highlight} style={[styles.text, mine && styles.textMine]} />
      </>
    );
  }

  const inner = (
    <>
      {forwarded}
      {m.replyTo && <Quote q={m.replyTo} mine={mine} author={quoteAuthor ?? ''} onPress={onQuotePress} />}
      {content}
      <View style={styles.metaAbs}>{meta(mine)}</View>
    </>
  );

  return (
    <View style={side}>
      {label}
      {mine ? (
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, tail && styles.tailMine, m.status === 'failed' && styles.bubbleFailed]}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleTheirs, tail && styles.tailTheirs]}>{inner}</View>
      )}
      {reactions}
      {failed}
    </View>
  );
}

const styles = StyleSheet.create({
  left: { alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '82%' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '82%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sender: { fontFamily: Fonts.bold, fontSize: 12, color: c.primary, marginLeft: 6, marginBottom: 2 },
  bubble: { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 18, minWidth: 80 },
  bubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' },
  bubbleDeleted: { backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: c.borderStrong },
  bubbleFailed: { opacity: 0.75 },
  tailMine: { borderTopRightRadius: 4 },
  tailTheirs: { borderTopLeftRadius: 4 },
  text: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 21, color: c.text },
  textMine: { color: '#fff' },
  spacer: { color: 'transparent', fontSize: 11 },
  deletedText: { fontFamily: Fonts.medium, fontStyle: 'italic', fontSize: 14, color: c.textSecondary },
  // In the flow under the content (an absolute overlay collided with the last line on Android).
  metaAbs: { alignSelf: 'flex-end', marginTop: 1, marginBottom: -2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: 2 },
  metaOnDark: {},
  time: { fontFamily: Fonts.medium, fontSize: 11, color: c.textSecondary },
  quote: { borderLeftWidth: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5, minWidth: 140 },
  quoteMine: { backgroundColor: 'rgba(255,255,255,0.22)', borderLeftColor: '#fff' },
  quoteTheirs: { backgroundColor: '#FBE9F4', borderLeftColor: c.primary },
  quoteAuthor: { fontFamily: Fonts.bold, fontSize: 12, color: c.primary },
  quoteText: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary },
  reactions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F0DCE8',
  },
  reactionsMine: { marginRight: 8 },
  reactionsTheirs: { marginLeft: 8 },
  reactionsSelected: { borderColor: c.primary },
  reactionText: { fontSize: 13, fontFamily: Fonts.semibold, color: c.text },
  failed: { marginTop: 3, marginRight: 4 },
  failedText: { fontFamily: Fonts.semibold, fontSize: 12, color: c.danger },
  photoWrap: { padding: 3, borderRadius: 18 },
  photoMine: { backgroundColor: '#EC7CC0' },
  photoTheirs: { backgroundColor: '#fff' },
  photo: { width: 230, height: 280, borderRadius: 15, backgroundColor: '#F6E6F1' },
  videoBox: { backgroundColor: '#2A1A24', alignItems: 'center', justifyContent: 'center' },
  playBig: { position: 'absolute', width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  videoDur: { position: 'absolute', left: 8, bottom: 6, fontFamily: Fonts.semibold, fontSize: 11, color: '#fff' },
  gifBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  gifText: { fontFamily: Fonts.bold, fontSize: 11, color: '#fff' },
  caption: { paddingHorizontal: 8, paddingTop: 5, paddingBottom: 3, maxWidth: 230 },
  sticker: { fontSize: 96, lineHeight: 110 },
  stickerMeta: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 10, paddingHorizontal: 6, marginTop: -6 },
  fwd: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  fwdText: { fontFamily: Fonts.medium, fontStyle: 'italic', fontSize: 12, color: c.textSecondary },
  onceMine: { backgroundColor: '#E063B2' },
  onceIcon: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  onceIconDone: { borderStyle: 'solid', borderColor: c.textSecondary },
  onceNum: { fontFamily: Fonts.bold, fontSize: 11 },
  photoMeta: { position: 'absolute', right: 8, bottom: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingHorizontal: 6, paddingBottom: 1 },
  uploading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 15 },
  giftCard: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#F7C4E2',
  },
  giftEmoji: { fontSize: 44 },
  giftTitle: { fontFamily: Fonts.bold, fontSize: 14, color: c.text, textAlign: 'center' },
  giftNote: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#F7C4E2',
  },
  liveCard: { borderColor: '#9BE3B3', backgroundColor: '#F1FBF4' },
  joinBtn: { marginLeft: 6, backgroundColor: '#1FA855', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5 },
  joinText: { fontFamily: Fonts.bold, fontSize: 13, color: '#fff' },
  cardText: { flexShrink: 1, fontFamily: Fonts.semibold, fontSize: 14, color: c.text },
});
