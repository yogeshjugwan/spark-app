import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

import { STICKERS } from './rich-content';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;

function Sheet({ visible, onClose, children, title }: { visible: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  return (
    <AppModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {!!title && <Text style={styles.sheetTitle}>{title}</Text>}
            {children}
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </AppModal>
  );
}

export type AttachChoice = 'document' | 'camera' | 'gallery' | 'location' | 'contact' | 'poll' | 'gift' | 'viewOnce';
const ATTACH: { key: AttachChoice; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { key: 'document', icon: 'document-text', label: 'Document', color: '#7F66FF' },
  { key: 'camera', icon: 'camera', label: 'Camera', color: '#FF2E74' },
  { key: 'gallery', icon: 'images', label: 'Gallery', color: '#C861FA' },
  { key: 'location', icon: 'location', label: 'Location', color: '#1FA855' },
  { key: 'contact', icon: 'person', label: 'Contact', color: '#009DE2' },
  { key: 'poll', icon: 'stats-chart', label: 'Poll', color: '#FFBC38' },
  { key: 'viewOnce', icon: 'eye-off', label: 'View once', color: '#5E5E5E' },
  { key: 'gift', icon: 'gift', label: 'Gift', color: '#E063B2' },
];

export function AttachSheet({ visible, onClose, onPick, hide = [] }: { visible: boolean; onClose: () => void; onPick: (k: AttachChoice) => void; hide?: AttachChoice[] }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.grid}>
        {ATTACH.filter((a) => !hide.includes(a.key)).map((a) => (
          <Pressable
            key={a.key}
            style={styles.cell}
            onPress={() => {
              onClose();
              onPick(a.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={a.label}>
            <View style={[styles.cellIcon, { backgroundColor: a.color }]}>
              <Ionicons name={a.icon} size={24} color="#fff" />
            </View>
            <Text style={styles.cellText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_KEY;
type Gif = { id: string; url: string; preview: string; width: number; height: number };

/** Stickers (built in) and GIFs (GIPHY, when an API key is configured). */
export function StickerPanel({ visible, onClose, onSticker, onGif }: { visible: boolean; onClose: () => void; onSticker: (code: string) => void; onGif: (g: Gif) => void }) {
  const [tab, setTab] = useState<'stickers' | 'gifs'>('stickers');
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const search = async (term: string) => {
    if (!GIPHY_KEY) return;
    setLoading(true);
    try {
      const path = term.trim() ? `search?q=${encodeURIComponent(term)}&` : 'trending?';
      const res = await fetch(`https://api.giphy.com/v1/gifs/${path}api_key=${GIPHY_KEY}&limit=30&rating=pg-13`);
      const json = (await res.json()) as { data: { id: string; images: { fixed_width: { url: string; width: string; height: string }; fixed_width_small: { url: string } } }[] };
      setGifs(json.data.map((g) => ({ id: g.id, url: g.images.fixed_width.url, preview: g.images.fixed_width_small.url, width: Number(g.images.fixed_width.width), height: Number(g.images.fixed_width.height) })));
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.tabs}>
        {(['stickers', 'gifs'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setTab(t);
              if (t === 'gifs' && gifs.length === 0) void search('');
            }}
            style={[styles.tab, tab === t && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}>
            <Text style={[styles.tabText, tab === t && { color: c.primary }]}>{t === 'stickers' ? 'Stickers' : 'GIFs'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'stickers' ? (
        <View style={styles.stickers}>
          {Object.entries(STICKERS).map(([code, emoji]) => (
            <Pressable
              key={code}
              onPress={() => {
                onClose();
                onSticker(code);
              }}
              style={styles.stickerCell}
              accessibilityRole="button"
              accessibilityLabel={`Sticker ${code.replace('_', ' ')}`}>
              <Text style={styles.stickerEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : !GIPHY_KEY ? (
        <Text style={styles.note}>GIFs need a GIPHY API key. Add EXPO_PUBLIC_GIPHY_KEY to dating-app/.env and restart Metro.</Text>
      ) : (
        <View style={{ height: 360 }}>
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => search(q)} placeholder="Search GIPHY" placeholderTextColor={c.textSecondary} style={styles.input} returnKeyType="search" />
          {loading ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={gifs}
              numColumns={3}
              keyExtractor={(g) => g.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onClose();
                    onGif(item);
                  }}
                  style={styles.gifCell}
                  accessibilityLabel="GIF">
                  <Image source={item.preview} style={{ flex: 1 }} contentFit="cover" autoplay />
                </Pressable>
              )}
            />
          )}
          <Text style={styles.powered}>Powered by GIPHY</Text>
        </View>
      )}
    </Sheet>
  );
}

export function PollComposer({ visible, onClose, onSend }: { visible: boolean; onClose: () => void; onSend: (p: { question: string; options: string[]; multi: boolean }) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const clean = options.map((o) => o.trim()).filter(Boolean);
  const ok = question.trim().length > 0 && clean.length >= 2;
  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
    setMulti(false);
  };
  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF7FB' }}>
        <KeyboardAvoider style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={c.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Create poll</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Question</Text>
            <TextInput value={question} onChangeText={setQuestion} placeholder="Ask a question" placeholderTextColor={c.textSecondary} style={styles.input} maxLength={255} />
            <Text style={styles.label}>Options</Text>
            {options.map((o, i) => (
              <TextInput
                key={i}
                value={o}
                onChangeText={(v) => {
                  const next = options.slice();
                  next[i] = v;
                  // Always keep one empty box at the end (up to 12), like WhatsApp.
                  if (i === next.length - 1 && v && next.length < 12) next.push('');
                  setOptions(next);
                }}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={c.textSecondary}
                style={styles.input}
                maxLength={100}
              />
            ))}
            <View style={styles.switchRow}>
              <Text style={styles.label}>Allow multiple answers</Text>
              <Switch value={multi} onValueChange={setMulti} trackColor={{ true: c.primary }} />
            </View>
          </ScrollView>
          <Pressable
            disabled={!ok}
            onPress={() => {
              onSend({ question: question.trim(), options: clean, multi });
              reset();
              onClose();
            }}
            style={[styles.primaryBtn, !ok && { opacity: 0.4 }]}
            accessibilityRole="button">
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={styles.primaryText}>Send poll</Text>
          </Pressable>
        </KeyboardAvoider>
      </SafeAreaView>
    </AppModal>
  );
}

export function LocationSheet({ visible, onClose, onPick, busy }: { visible: boolean; onClose: () => void; onPick: (liveMinutes?: 15 | 60 | 480) => void; busy?: boolean }) {
  const row = (icon: keyof typeof Ionicons.glyphMap, label: string, sub: string, fn: () => void, color: string = c.primary) => (
    <Pressable onPress={fn} style={styles.row} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.rowIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
    </Pressable>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title="Send location">
      {busy ? (
        <ActivityIndicator color={c.primary} style={{ margin: 24 }} />
      ) : (
        <>
          {row('navigate', 'Send your current location', 'Accurate to a few metres', () => onPick())}
          {row('radio', 'Share live location · 15 min', 'Updates while Spark is open', () => onPick(15), '#1FA855')}
          {row('radio', 'Share live location · 1 hour', 'Updates while Spark is open', () => onPick(60), '#1FA855')}
          {row('radio', 'Share live location · 8 hours', 'Updates while Spark is open', () => onPick(480), '#1FA855')}
          <Text style={styles.note}>For safety, only share your live location with people you trust.</Text>
        </>
      )}
    </Sheet>
  );
}

export interface PickedMedia {
  uri: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
  durationSec?: number;
}

/** Preview before sending (WhatsApp): swipe through picks, add a caption, toggle view once. */
export function MediaPreview({ items, initialViewOnce, onClose, onSend }: { items: PickedMedia[]; initialViewOnce?: boolean; onClose: () => void; onSend: (caption: string, viewOnce: boolean) => void }) {
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(!!initialViewOnce);
  const [index, setIndex] = useState(0);
  const cur = items[index];
  const canOnce = items.length === 1;
  return (
    <AppModal visible={items.length > 0} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <KeyboardAvoider style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel">
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>{items.length > 1 ? `${index + 1} of ${items.length}` : cur?.type === 'video' ? 'Video' : 'Photo'}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {cur &&
              (cur.type === 'video' ? (
                <View style={styles.videoPh}>
                  <Ionicons name="videocam" size={60} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.primaryText}>{cur.durationSec ? `${Math.floor(cur.durationSec / 60)}:${String(Math.round(cur.durationSec % 60)).padStart(2, '0')}` : 'Video'}</Text>
                </View>
              ) : (
                <Image source={cur.uri} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              ))}
          </View>
          {items.length > 1 && (
            <ScrollView horizontal contentContainerStyle={{ gap: 6, padding: 8 }}>
              {items.map((it, i) => (
                <Pressable key={it.uri} onPress={() => setIndex(i)} style={[styles.thumb, i === index && { borderColor: c.primary }]}>
                  {it.type === 'video' ? <Ionicons name="videocam" size={20} color="#fff" /> : <Image source={it.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={styles.captionBar}>
            <TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption…" placeholderTextColor="rgba(255,255,255,0.6)" style={styles.captionInput} multiline maxLength={1000} />
            {canOnce && (
              <Pressable
                onPress={() => setViewOnce((v) => !v)}
                style={[styles.onceBtn, viewOnce && { backgroundColor: c.primary, borderColor: c.primary }]}
                accessibilityRole="switch"
                accessibilityState={{ checked: viewOnce }}
                accessibilityLabel="View once">
                <Text style={styles.onceText}>1</Text>
              </Pressable>
            )}
            <Pressable onPress={() => onSend(caption.trim(), canOnce && viewOnce)} style={styles.sendBtn} accessibilityRole="button" accessibilityLabel="Send">
              <Ionicons name="send" size={20} color="#fff" />
            </Pressable>
          </View>
          {viewOnce && canOnce && <Text style={styles.onceHint}>View once: they can open it one time. Screenshots are blocked where the phone allows it.</Text>}
        </KeyboardAvoider>
      </SafeAreaView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,10,25,0.35)', justifyContent: 'flex-end' },
  sheetWrap: { padding: Spacing.two },
  sheet: { backgroundColor: '#FFF7FB', borderRadius: 24, padding: Spacing.three },
  sheetTitle: { fontFamily: Fonts.bold, fontSize: 17, color: c.text, marginBottom: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 },
  cell: { width: '25%', alignItems: 'center', gap: 6 },
  cellIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontFamily: Fonts.medium, fontSize: 12, color: c.text },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: Spacing.two },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F4E6EF' },
  tabOn: { backgroundColor: '#FBE3F1' },
  tabText: { fontFamily: Fonts.semibold, fontSize: 14, color: c.textSecondary },
  stickers: { flexDirection: 'row', flexWrap: 'wrap' },
  stickerCell: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  stickerEmoji: { fontSize: 38 },
  gifCell: { flex: 1 / 3, aspectRatio: 1, margin: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee' },
  powered: { fontFamily: Fonts.medium, fontSize: 11, color: c.textSecondary, textAlign: 'center', marginTop: 4 },
  note: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary, marginTop: Spacing.two },
  input: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: c.text,
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.three },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 18, color: c.text },
  label: { fontFamily: Fonts.semibold, fontSize: 14, color: c.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two },
  primaryBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', margin: Spacing.three, paddingVertical: 14, borderRadius: 26, backgroundColor: c.primary },
  primaryText: { fontFamily: Fonts.bold, fontSize: 16, color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontFamily: Fonts.semibold, fontSize: 15, color: c.text },
  rowSub: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  videoPh: { alignItems: 'center', gap: 10 },
  thumb: { width: 54, height: 54, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222' },
  captionBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: Spacing.two },
  captionInput: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: Fonts.medium, fontSize: 15 },
  onceBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  onceText: { fontFamily: Fonts.bold, fontSize: 13, color: '#fff' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  onceHint: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: 20, paddingBottom: 8 },
});
