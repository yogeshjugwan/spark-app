import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { quoteText, type ChatMessage } from '@/lib/chat-api';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
const DELETE_FOR_EVERYONE_MS = 48 * 60 * 60 * 1000;
const EDIT_MS = 15 * 60 * 1000;
/** Can this message still be edited? (Checked when the sheet opens — it depends on the clock.) */
export const canEdit = (m: ChatMessage, me: number, now: number) => m.senderId === me && m.type === 'text' && !m.deleted && m.id > 0 && !m.data?.system && now - new Date(m.createdAt).getTime() < EDIT_MS;
const FORWARDABLE = new Set(['text', 'image', 'video', 'voice', 'file', 'location', 'contact', 'sticker']);

/**
 * Long-press sheet (WhatsApp): quick reactions on top, then Reply / Copy / Delete.
 * Failed messages get Retry / Delete instead.
 */
export function MessageActions({
  message,
  me,
  onClose,
  onReact,
  onReply,
  onDelete,
  onRetry,
  onDiscard,
  editable,
  starred,
  pinned,
  canPin,
  onEdit,
  onStar,
  onPin,
  onForward,
  onSelect,
}: {
  message: ChatMessage | null;
  me: number;
  onClose: () => void;
  onReact: (m: ChatMessage, emoji: string | null) => void;
  onReply: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage, forEveryone: boolean) => void;
  onRetry: (m: ChatMessage) => void;
  onDiscard: (m: ChatMessage) => void;
  editable?: boolean;
  starred?: boolean;
  pinned?: boolean;
  canPin?: boolean;
  onEdit?: (m: ChatMessage) => void;
  onStar?: (m: ChatMessage, on: boolean) => void;
  onPin?: (m: ChatMessage, on: boolean) => void;
  onForward?: (m: ChatMessage) => void;
  onSelect?: (m: ChatMessage) => void;
}) {
  const m = message;
  const pending = !!m && m.id < 0;
  const myReaction = m?.reactions.find((r) => r.userId === me)?.emoji;

  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <AppModal visible={!!m} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        {m && (
          <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.preview} numberOfLines={2}>
                {quoteText(m)}
              </Text>

              {pending ? (
                <>
                  {m.status === 'failed' && <Row icon="refresh" label="Retry" onPress={act(() => onRetry(m))} />}
                  <Row icon="trash-outline" label="Delete" danger onPress={act(() => onDiscard(m))} />
                </>
              ) : (
                <>
                  {!m.deleted && (
                    <View style={styles.emojis} accessibilityRole="toolbar">
                      {QUICK_REACTIONS.map((e) => (
                        <Pressable
                          key={e}
                          onPress={act(() => onReact(m, myReaction === e ? null : e))}
                          style={[styles.emoji, myReaction === e && styles.emojiOn]}
                          accessibilityRole="button"
                          accessibilityLabel={myReaction === e ? `Remove ${e}` : `React ${e}`}>
                          <Text style={styles.emojiText}>{e}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {!m.deleted && <Row icon="arrow-undo-outline" label="Reply" onPress={act(() => onReply(m))} />}
                  {!m.deleted && !!m.body && !m.viewOnce && <Row icon="copy-outline" label="Copy" onPress={act(() => Clipboard.setStringAsync(m.body ?? ''))} />}
                  {editable && onEdit && <Row icon="create-outline" label="Edit" onPress={act(() => onEdit(m))} />}
                  {!m.deleted && !m.viewOnce && FORWARDABLE.has(m.type) && onForward && <Row icon="arrow-redo-outline" label="Forward" onPress={act(() => onForward(m))} />}
                  {!m.deleted && onStar && <Row icon={starred ? 'star' : 'star-outline'} label={starred ? 'Unstar' : 'Star'} onPress={act(() => onStar(m, !starred))} />}
                  {!m.deleted && canPin && onPin && <Row icon="pin-outline" label={pinned ? 'Unpin' : 'Pin'} onPress={act(() => onPin(m, !pinned))} />}
                  {onSelect && <Row icon="checkmark-circle-outline" label="Select" onPress={act(() => onSelect(m))} />}
                  <Row icon="trash-outline" label="Delete" danger onPress={act(() => confirmDelete(m, me, onDelete))} />
                </>
              )}
            </Pressable>
          </SafeAreaView>
        )}
      </Pressable>
    </AppModal>
  );
}

/** "Delete for everyone" only for my own recent messages (checked at tap time — it depends on the clock). */
function confirmDelete(msg: ChatMessage, me: number, onDelete: (m: ChatMessage, forEveryone: boolean) => void) {
  const canDeleteForEveryone =
    msg.senderId === me && !msg.deleted && msg.type !== 'gift' && msg.type !== 'call' && Date.now() - new Date(msg.createdAt).getTime() < DELETE_FOR_EVERYONE_MS;
  Alert.alert('Delete message?', undefined, [
    ...(canDeleteForEveryone ? [{ text: 'Delete for everyone', style: 'destructive' as const, onPress: () => onDelete(msg, true) }] : []),
    { text: 'Delete for me', style: 'destructive', onPress: () => onDelete(msg, false) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function Row({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F8EDF4' }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? c.danger : c.text} />
      <Text style={[styles.rowText, danger && { color: c.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,10,25,0.35)', justifyContent: 'flex-end' },
  sheetWrap: { padding: Spacing.three },
  sheet: { backgroundColor: '#FFF7FB', borderRadius: 24, paddingVertical: Spacing.two, overflow: 'hidden' },
  preview: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  emojis: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: Spacing.two, paddingBottom: Spacing.two },
  emoji: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  emojiOn: { backgroundColor: '#FBE3F1' },
  emojiText: { fontSize: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.four, paddingVertical: 14, borderRadius: Radius.md },
  rowText: { fontFamily: Fonts.semibold, fontSize: 16, color: c.text },
});
