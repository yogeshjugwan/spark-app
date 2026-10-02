import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { fileSizeText, type ChatMessage, type LinkPreview } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';

const c = Colors.light;
// Trailing punctuation ("see x.com!") isn't part of the link.
const URL_RE = /(https?:\/\/[^\s<>"']*[^\s<>"'.,!?;:)])/gi;

/** Built-in sticker set (big emoji art — no third-party sticker packs needed). */
export const STICKERS: Record<string, string> = {
  heart_eyes: '😍',
  kiss: '😘',
  love: '💞',
  fire: '🔥',
  wink: '😉',
  laugh: '🤣',
  hug: '🤗',
  shy: '🙈',
  party: '🥳',
  coffee: '☕',
  rose: '🌹',
  wave: '👋',
  cool: '😎',
  thinking: '🤔',
  sleepy: '😴',
  sparkles: '✨',
  pizza: '🍕',
  cheers: '🥂',
};

/**
 * Message text with tappable links and highlighted @mentions (WhatsApp: mentions are bold,
 * coloured). `names` maps userId → display name for mentions stored in message data.
 */
export function RichText({ body, mine, mentionNames, highlight, style }: { body: string; mine: boolean; mentionNames?: string[]; highlight?: string; style?: object }) {
  const linkColor = mine ? '#fff' : '#1E6FD9';
  const mentionColor = mine ? '#FFE6F4' : c.primary;
  // Split by URLs first, then by @Name tokens and the search highlight.
  const parts = body.split(URL_RE);
  const tokens = mentionNames?.length ? new RegExp(`(@(?:${mentionNames.map(esc).join('|')}))`, 'g') : null;
  const hl = highlight?.trim() ? new RegExp(`(${esc(highlight.trim())})`, 'ig') : null;
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (i % 2 === 1)
          return (
            <Text key={i} style={{ color: linkColor, textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(p).catch(() => {})}>
              {p}
            </Text>
          );
        const sub = tokens ? p.split(tokens) : [p];
        return sub.map((t, j) => {
          if (tokens && j % 2 === 1)
            return (
              <Text key={`${i}-${j}`} style={{ color: mentionColor, fontFamily: Fonts.bold }}>
                {t}
              </Text>
            );
          if (!hl) return t;
          return t.split(hl).map((x, k) =>
            k % 2 === 1 ? (
              <Text key={`${i}-${j}-${k}`} style={{ backgroundColor: '#FFE58A', color: c.text }}>
                {x}
              </Text>
            ) : (
              x
            ),
          );
        });
      })}
    </Text>
  );
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function LinkCard({ link, mine }: { link: LinkPreview; mine: boolean }) {
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(link.url).catch(() => {})} style={[styles.link, mine ? styles.linkMine : styles.linkTheirs]} accessibilityRole="link" accessibilityLabel={`Link: ${link.title ?? link.site}`}>
      {link.image && <Image source={link.image} style={styles.linkImage} contentFit="cover" />}
      <View style={styles.linkBody}>
        {!!link.title && (
          <Text style={[styles.linkTitle, mine && { color: '#fff' }]} numberOfLines={2}>
            {link.title}
          </Text>
        )}
        {!!link.description && (
          <Text style={[styles.linkDesc, mine && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={2}>
            {link.description}
          </Text>
        )}
        <Text style={[styles.linkSite, mine && { color: 'rgba(255,255,255,0.75)' }]}>{link.site}</Text>
      </View>
    </Pressable>
  );
}

const FILE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { pdf: 'document-text', doc: 'document', docx: 'document', xls: 'grid', xlsx: 'grid', ppt: 'easel', pptx: 'easel', zip: 'archive' };

export function FileCard({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const name = m.data?.name ?? 'Document';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const open = () => {
    const url = m.localUri ?? mediaUrl(m.url);
    if (url) WebBrowser.openBrowserAsync(url).catch(() => {});
  };
  return (
    <Pressable onPress={open} style={[styles.file, mine ? styles.fileMine : styles.fileTheirs]} accessibilityRole="button" accessibilityLabel={`Document ${name}, ${fileSizeText(m.data?.size)}. Open`}>
      <View style={styles.fileIcon}>
        <Ionicons name={FILE_ICON[ext] ?? 'document-attach'} size={22} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fileName, mine && { color: '#fff' }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.fileMeta, mine && { color: 'rgba(255,255,255,0.8)' }]}>
          {fileSizeText(m.data?.size)} · {ext.toUpperCase() || 'FILE'}
        </Text>
      </View>
      <Ionicons name="open-outline" size={18} color={mine ? '#fff' : c.textSecondary} />
    </Pressable>
  );
}

export function LocationCard({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const d = m.data ?? {};
  const live = !!d.live && !!d.until && new Date(d.until) > new Date();
  const open = () => {
    const q = `${d.lat},${d.lng}`;
    const url = Platform.OS === 'ios' ? `maps:0,0?q=${q}` : `geo:0,0?q=${q}(${encodeURIComponent(d.label ?? 'Shared location')})`;
    Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(`https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=16/${d.lat}/${d.lng}`));
  };
  return (
    <Pressable onPress={open} style={styles.loc} accessibilityRole="button" accessibilityLabel={`${live ? 'Live location' : 'Location'}${d.label ? `: ${d.label}` : ''}. Open in maps`}>
      <View style={styles.locMap}>
        <View style={styles.locGridH} />
        <View style={styles.locGridV} />
        <Ionicons name="location" size={40} color={live ? '#2E7D32' : c.primary} />
        {live && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
      <View style={styles.locBody}>
        <Text style={[styles.locTitle, mine && { color: '#fff' }]} numberOfLines={1}>
          {live ? 'Live location' : d.label || 'Shared location'}
        </Text>
        <Text style={[styles.locSub, mine && { color: 'rgba(255,255,255,0.85)' }]}>
          {live ? `Until ${new Date(d.until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : d.live ? 'Live location ended' : `${d.lat?.toFixed(4)}, ${d.lng?.toFixed(4)}`}
        </Text>
      </View>
    </Pressable>
  );
}

export function ContactCard({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const d = m.data ?? {};
  return (
    <View style={styles.contact}>
      <View style={styles.contactRow}>
        <View style={styles.contactAvatar}>
          <Ionicons name="person" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fileName, mine && { color: '#fff' }]}>{d.name}</Text>
          <Text style={[styles.fileMeta, mine && { color: 'rgba(255,255,255,0.85)' }]}>{d.phone}</Text>
        </View>
      </View>
      <Pressable onPress={() => Linking.openURL(`tel:${d.phone?.replace(/[^\d+]/g, '')}`).catch(() => {})} style={[styles.contactBtn, mine && { borderTopColor: 'rgba(255,255,255,0.35)' }]} accessibilityRole="button">
        <Text style={[styles.contactBtnText, mine && { color: '#fff' }]}>Call</Text>
      </Pressable>
    </View>
  );
}

export function PollCard({ m, mine, me, onVote }: { m: ChatMessage; mine: boolean; me: number; onVote?: (options: number[]) => void }) {
  const d = m.data ?? {};
  const options = d.options ?? [];
  const voters = new Set(m.votes.map((v) => v.userId)).size;
  const myVotes = new Set(m.votes.filter((v) => v.userId === me).map((v) => v.option));
  const count = (i: number) => m.votes.filter((v) => v.option === i).length;
  const max = Math.max(1, ...options.map((_, i) => count(i)));
  const fg = mine ? '#fff' : c.text;
  const toggle = (i: number) => {
    if (!onVote || m.id < 0) return;
    const next = new Set(myVotes);
    if (d.multi) {
      if (next.has(i)) next.delete(i);
      else next.add(i);
    }
    else if (next.has(i)) next.clear();
    else {
      next.clear();
      next.add(i);
    }
    onVote([...next]);
  };
  return (
    <View style={styles.poll}>
      <Text style={[styles.pollQ, { color: fg }]}>{d.question}</Text>
      <Text style={[styles.pollHint, mine && { color: 'rgba(255,255,255,0.8)' }]}>{d.multi ? 'Select one or more' : 'Select one'}</Text>
      {options.map((o, i) => (
        <Pressable key={i} onPress={() => toggle(i)} style={styles.pollOpt} accessibilityRole={d.multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: myVotes.has(i) }} accessibilityLabel={`${o}, ${count(i)} votes`}>
          <Ionicons name={myVotes.has(i) ? (d.multi ? 'checkbox' : 'radio-button-on') : d.multi ? 'square-outline' : 'radio-button-off'} size={20} color={mine ? '#fff' : c.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.pollRow}>
              <Text style={[styles.pollText, { color: fg }]}>{o}</Text>
              <Text style={[styles.pollCount, { color: fg }]}>{count(i)}</Text>
            </View>
            <View style={[styles.pollTrack, mine && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
              <View style={[styles.pollFill, { width: `${(count(i) / max) * 100}%`, backgroundColor: mine ? '#fff' : c.primary }]} />
            </View>
          </View>
        </Pressable>
      ))}
      <Text style={[styles.pollHint, { textAlign: 'center', marginTop: 4 }, mine && { color: 'rgba(255,255,255,0.8)' }]}>
        {voters} {voters === 1 ? 'vote' : 'votes'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { borderRadius: 10, overflow: 'hidden', marginBottom: 6, maxWidth: 260 },
  linkMine: { backgroundColor: 'rgba(255,255,255,0.18)' },
  linkTheirs: { backgroundColor: '#F7EEF4' },
  linkImage: { width: '100%', height: 120 },
  linkBody: { padding: 8, gap: 2 },
  linkTitle: { fontFamily: Fonts.bold, fontSize: 13, color: c.text },
  linkDesc: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  linkSite: { fontFamily: Fonts.medium, fontSize: 11, color: c.textSecondary },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, minWidth: 230, marginBottom: 2 },
  fileMine: { backgroundColor: 'rgba(255,255,255,0.18)' },
  fileTheirs: { backgroundColor: '#F7EEF4' },
  fileIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontFamily: Fonts.semibold, fontSize: 14, color: c.text },
  fileMeta: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  loc: { width: 240, marginBottom: 2 },
  locMap: { height: 120, borderRadius: 12, backgroundColor: '#E8F1E4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  locGridH: { position: 'absolute', left: 0, right: 0, top: '55%', height: 10, backgroundColor: '#fff', opacity: 0.8 },
  locGridV: { position: 'absolute', top: 0, bottom: 0, left: '30%', width: 8, backgroundColor: '#fff', opacity: 0.8 },
  liveBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2E7D32' },
  liveText: { fontFamily: Fonts.bold, fontSize: 10, color: '#2E7D32' },
  locBody: { paddingTop: 6, gap: 1 },
  locTitle: { fontFamily: Fonts.bold, fontSize: 14, color: c.text },
  locSub: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  contact: { minWidth: 220, marginBottom: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#C9B6C3', alignItems: 'center', justifyContent: 'center' },
  contactBtn: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderStrong, paddingTop: 8, alignItems: 'center' },
  contactBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: c.primary },
  poll: { minWidth: 240, gap: 6 },
  pollQ: { fontFamily: Fonts.bold, fontSize: 15 },
  pollHint: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  pollOpt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  pollRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pollText: { fontFamily: Fonts.semibold, fontSize: 14, flexShrink: 1 },
  pollCount: { fontFamily: Fonts.semibold, fontSize: 13 },
  pollTrack: { height: 5, borderRadius: 3, backgroundColor: '#F1DCE8', overflow: 'hidden' },
  pollFill: { height: 5, borderRadius: 3 },
});
