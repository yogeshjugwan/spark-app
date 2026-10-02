import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LevelMeter } from '@/components/ui/level-meter';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { newClientId } from '@/lib/chat-api';
import { currentPosition } from '@/lib/live-location';
import type { Draft } from '@/lib/use-conversation';
import { useVoiceRecording } from '@/lib/use-voice-recording';

import { AttachSheet, LocationSheet, MediaPreview, PollComposer, StickerPanel, type AttachChoice, type PickedMedia } from './composer-sheets';

const c = Colors.light;
const LOCK_DY = -70;
const CANCEL_DX = -110;

/** True while the software keyboard is on screen. */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // iOS gets "will" events (animate with the keyboard); Android only has "did".
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export interface Mentionable {
  id: number;
  name: string;
}

/**
 * WhatsApp-style message bar for 1:1 and group chats: text with @mentions, stickers/GIFs,
 * an attach menu (document, camera, gallery with multi-select and video, location / live
 * location, contact, poll, view-once, gift), and voice notes — hold to record, slide up to lock
 * hands-free (pause/resume), slide left to cancel. Also handles editing a sent message.
 */
export function Composer({
  onSend,
  onGift,
  onTyping,
  error,
  onDismissError,
  replyTo,
  onCancelReply,
  members,
  editing,
  onSubmitEdit,
  onCancelEdit,
  blocked,
}: {
  onSend: (draft: Draft) => void;
  onGift?: () => void;
  onTyping?: () => void;
  error?: string | null;
  onDismissError?: () => void;
  replyTo?: { author: string; text: string } | null;
  onCancelReply?: () => void;
  /** Group chats: people you can @mention. */
  members?: Mentionable[];
  /** Editing a sent text message. */
  editing?: { text: string } | null;
  onSubmitEdit?: (text: string) => void;
  onCancelEdit?: () => void;
  /** Shown instead of the bar (e.g. "Only admins can send messages"). */
  blocked?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<Mentionable[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'attach' | 'stickers' | 'poll' | 'location'>(null);
  const [picked, setPicked] = useState<PickedMedia[]>([]);
  const [pickedOnce, setPickedOnce] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [dragHint, setDragHint] = useState<'none' | 'lock' | 'cancel'>('none');
  const [voiceOnce, setVoiceOnce] = useState(false);
  const input = useRef<TextInput>(null);

  const voice = useVoiceRecording({
    maxSec: 900,
    onTake: (t) => onSend({ type: 'voice', uri: t.uri, durationSec: t.durationSec, waveform: t.waveform, viewOnce: voiceOnce }),
  });
  const shownError = error ?? voice.error ?? localError;
  const secs = voice.elapsedSec;

  // Editing: load the message text into the box (derived state, no effect).
  const [editingFor, setEditingFor] = useState<typeof editing>(null);
  if (editing !== editingFor) {
    setEditingFor(editing);
    if (editing) setText(editing.text);
  }

  // "@" autocomplete: the word being typed right before the cursor.
  const mentionQuery = members?.length ? /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1] : undefined;
  const suggestions = mentionQuery === undefined ? [] : (members ?? []).filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);
  const pickMention = (m: Mentionable) => {
    const first = m.name.split(' ')[0];
    setText((t) => t.replace(/@([^\s@]*)$/, `@${first} `));
    setMentions((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      onSubmitEdit?.(body);
      setText('');
      return;
    }
    const used = mentions.filter((m) => body.includes(`@${m.name.split(' ')[0]}`)).map((m) => m.id);
    setText('');
    setMentions([]);
    onSend({ type: 'text', body, ...(used.length && { mentions: used }) });
  };

  const fail = (e: unknown) => setLocalError(e instanceof Error ? e.message : String(e));

  const fromAssets = (assets: ImagePicker.ImagePickerAsset[]): PickedMedia[] =>
    assets.map((a) => ({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image', width: a.width, height: a.height, durationSec: a.duration ? a.duration / 1000 : undefined }));

  const pickGallery = async (once = false) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: !once, selectionLimit: once ? 1 : 30, videoMaxDuration: 180 });
    if (!res.canceled && res.assets.length) {
      setPickedOnce(once);
      setPicked(fromAssets(res.assets));
    }
  };
  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return fail(new Error('Allow camera access in Settings.'));
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 180 });
    if (!res.canceled && res.assets.length) {
      setPickedOnce(false);
      setPicked(fromAssets(res.assets));
    }
  };
  const sendPicked = (caption: string, viewOnce: boolean) => {
    const albumId = picked.length > 1 ? newClientId() : undefined;
    picked.forEach((p, i) => {
      // Caption goes on the first item, like WhatsApp.
      const cap = i === 0 && caption ? caption : undefined;
      if (p.type === 'video') onSend({ type: 'video', uri: p.uri, durationSec: p.durationSec ? Math.round(p.durationSec) : undefined, caption: cap, viewOnce });
      else onSend({ type: 'image', uri: p.uri, caption: cap, viewOnce, albumId, width: p.width, height: p.height });
    });
    setPicked([]);
  };

  const onAttach = async (k: AttachChoice) => {
    Keyboard.dismiss();
    try {
      if (k === 'gallery') await pickGallery();
      else if (k === 'viewOnce') await pickGallery(true);
      else if (k === 'camera') await openCamera();
      else if (k === 'gift') onGift?.();
      else if (k === 'poll') setSheet('poll');
      else if (k === 'location') setSheet('location');
      else if (k === 'document') {
        const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
        const a = res.assets?.[0];
        if (!res.canceled && a) {
          if ((a.size ?? 0) > 60 * 1024 * 1024) throw new Error('Documents can be up to 60 MB.');
          onSend({ type: 'file', uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/octet-stream', size: a.size ?? 0 });
        }
      } else if (k === 'contact') {
        const perm = await Contacts.requestPermissionsAsync();
        if (!perm.granted) throw new Error('Allow contacts access to share a contact.');
        const ct = await Contacts.presentContactPickerAsync();
        const phone = ct?.phoneNumbers?.[0]?.number;
        if (ct && phone) onSend({ type: 'contact', name: ct.name || phone, phone });
        else if (ct) throw new Error('That contact has no phone number.');
      }
    } catch (e) {
      fail(e);
    }
  };

  const sendLocation = async (liveMinutes?: 15 | 60 | 480) => {
    setLocBusy(true);
    try {
      const p = await currentPosition();
      onSend({ type: 'location', lat: p.lat, lng: p.lng, ...(liveMinutes && { liveMinutes }) });
      setSheet(null);
    } catch (e) {
      fail(e);
      setSheet(null);
    } finally {
      setLocBusy(false);
    }
  };

  // ---- voice: hold to record, slide up to lock, slide left to cancel; a quick tap starts locked.
  const startRec = () => {
    Keyboard.dismiss();
    setLocked(false);
    setVoiceOnce(false);
    setDragHint('none');
    void voice.start();
  };
  const endRec = (dx: number, dy: number) => {
    setDragHint('none');
    if (dx < CANCEL_DX) return voice.cancel();
    if (dy < LOCK_DY) return setLocked(true);
    voice.stop();
  };
  const tapRec = () => {
    Keyboard.dismiss();
    setLocked(true);
    setVoiceOnce(false);
    void voice.start();
  };
  const hold = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => runOnJS(startRec)())
    .onUpdate((e) => runOnJS(setDragHint)(e.translationX < CANCEL_DX ? 'cancel' : e.translationY < LOCK_DY ? 'lock' : 'none'))
    .onEnd((e) => runOnJS(endRec)(e.translationX, e.translationY));
  const tap = Gesture.Tap()
    .maxDuration(240)
    .onEnd(() => runOnJS(tapRec)());
  const micGesture = Gesture.Exclusive(hold, tap);

  const recordingUi = voice.recording || voice.phase === 'stopping' || voice.phase === 'starting';
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  if (blocked) {
    return (
      <View style={[styles.blocked, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
        <Text style={styles.blockedText}>{blocked}</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingBottom: keyboard ? Spacing.one : Math.max(insets.bottom, Spacing.one) }}>
      {!!shownError && (
        <Pressable
          onPress={() => {
            onDismissError?.();
            voice.setError(null);
            setLocalError(null);
          }}
          style={styles.errorBar}
          accessibilityRole="button"
          accessibilityHint="Dismiss">
          <Text style={styles.errorBarText}>{shownError}</Text>
        </Pressable>
      )}

      {suggestions.length > 0 && (
        <View style={styles.mentions}>
          {suggestions.map((m) => (
            <Pressable key={m.id} onPress={() => pickMention(m)} style={styles.mentionRow} accessibilityRole="button" accessibilityLabel={`Mention ${m.name}`}>
              <View style={styles.mentionAvatar}>
                <Text style={styles.mentionLetter}>{m.name[0]}</Text>
              </View>
              <Text style={styles.mentionName}>{m.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {(replyTo || editing) && (
        <View style={styles.replyBar}>
          <View style={styles.replyAccent} />
          <View style={styles.flex}>
            <Text style={styles.replyAuthor} numberOfLines={1}>
              {editing ? 'Edit message' : replyTo!.author}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {editing ? editing.text : replyTo!.text}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (editing) {
                setText('');
                onCancelEdit?.();
              } else onCancelReply?.();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Cancel edit' : 'Cancel reply'}>
            <Ionicons name="close" size={20} color={c.textSecondary} />
          </Pressable>
        </View>
      )}

      {voice.micStalled && (
        <View style={styles.stallBar} accessibilityLiveRegion="polite">
          <Text style={styles.errorBarText}>Your microphone stopped sending audio. Check it isn’t muted or used by another app.</Text>
        </View>
      )}

      {recordingUi && locked ? (
        // Hands-free (locked) recording: delete · timer + meter · pause/resume · view-once · send
        <View style={styles.lockedWrap}>
          <View style={[styles.input, styles.recording]}>
            <View style={[styles.recDot, voice.paused && { backgroundColor: c.textSecondary }]} />
            <Text style={styles.recText}>{clock}</Text>
            <View style={styles.flex}>
              <LevelMeter level={voice.paused ? 0 : voice.level} />
            </View>
          </View>
          <View style={styles.lockedRow}>
            <Pressable onPress={voice.cancel} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Delete recording">
              <Ionicons name="trash-outline" size={24} color={c.danger} />
            </Pressable>
            <Pressable onPress={voice.togglePause} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={voice.paused ? 'Resume recording' : 'Pause recording'}>
              <Ionicons name={voice.paused ? 'mic' : 'pause'} size={26} color={c.danger} />
            </Pressable>
            <Pressable
              onPress={() => setVoiceOnce((v) => !v)}
              style={[styles.onceBtn, voiceOnce && styles.onceOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: voiceOnce }}
              accessibilityLabel="View once">
              <Text style={[styles.onceText, voiceOnce && { color: '#fff' }]}>1</Text>
            </Pressable>
            <Pressable onPress={voice.stop} disabled={voice.phase !== 'recording'} style={styles.send} accessibilityRole="button" accessibilityLabel="Send voice message">
              {voice.phase === 'recording' ? <Ionicons name="send" size={20} color="#fff" /> : <ActivityIndicator color="#fff" />}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.bar}>
          {recordingUi ? (
            <View style={[styles.input, styles.recording]}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>{clock}</Text>
              <Text style={[styles.slideText, dragHint === 'cancel' && { color: c.danger }]} numberOfLines={1}>
                {dragHint === 'cancel' ? 'Release to cancel' : dragHint === 'lock' ? 'Release to lock' : '‹ Slide to cancel'}
              </Text>
            </View>
          ) : (
            <View style={[styles.input, styles.inputRow]}>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet('stickers');
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Stickers and GIFs">
                <Ionicons name="happy-outline" size={24} color={c.textSecondary} />
              </Pressable>
              <TextInput
                ref={input}
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  onTyping?.();
                }}
                placeholder={editing ? 'Edit message' : 'Message'}
                placeholderTextColor={c.textSecondary}
                style={styles.textInput}
                multiline
                maxLength={4000}
                // Web: Enter sends, Shift+Enter adds a new line (like WhatsApp Web).
                onKeyPress={
                  Platform.OS === 'web'
                    ? (e) => {
                        const ne = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                        if (ne.key === 'Enter' && !ne.shiftKey) {
                          e.preventDefault();
                          submit();
                        }
                      }
                    : undefined
                }
                accessibilityLabel="Message"
              />
              {!editing && (
                <>
                  <Pressable onPress={() => setSheet('attach')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Attach">
                    <Ionicons name="attach" size={24} color={c.textSecondary} style={{ transform: [{ rotate: '-45deg' }] }} />
                  </Pressable>
                  {!text.trim() && (
                    <Pressable onPress={() => onAttach('camera')} hitSlop={6} accessibilityRole="button" accessibilityLabel="Camera">
                      <Ionicons name="camera-outline" size={24} color={c.textSecondary} />
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}
          {text.trim() || editing ? (
            <Pressable onPress={submit} style={styles.send} accessibilityRole="button" accessibilityLabel={editing ? 'Save edit' : 'Send'}>
              <Ionicons name={editing ? 'checkmark' : 'send'} size={20} color="#fff" />
            </Pressable>
          ) : (
            <View>
              {recordingUi && (
                <View style={[styles.lockHint, dragHint === 'lock' && { backgroundColor: c.primary }]} pointerEvents="none">
                  <Ionicons name="lock-closed" size={16} color={dragHint === 'lock' ? '#fff' : c.textSecondary} />
                  <Ionicons name="chevron-up" size={14} color={dragHint === 'lock' ? '#fff' : c.textSecondary} />
                </View>
              )}
              <GestureDetector gesture={micGesture}>
                <View style={[styles.send, recordingUi && styles.sendBig]} accessibilityRole="button" accessibilityLabel="Record a voice message. Hold to record, or tap for hands-free" accessible>
                  {voice.phase === 'starting' ? <ActivityIndicator color="#fff" /> : <Ionicons name="mic" size={22} color="#fff" />}
                </View>
              </GestureDetector>
            </View>
          )}
        </View>
      )}

      <AttachSheet visible={sheet === 'attach'} onClose={() => setSheet(null)} onPick={onAttach} hide={onGift ? [] : ['gift']} />
      <StickerPanel
        visible={sheet === 'stickers'}
        onClose={() => setSheet(null)}
        onSticker={(code) => onSend({ type: 'sticker', code })}
        onGif={(g) => onSend({ type: 'gif', url: g.url, width: g.width, height: g.height })}
      />
      <PollComposer visible={sheet === 'poll'} onClose={() => setSheet(null)} onSend={(p) => onSend({ type: 'poll', ...p })} />
      <LocationSheet visible={sheet === 'location'} busy={locBusy} onClose={() => setSheet(null)} onPick={sendLocation} />
      <MediaPreview items={picked} initialViewOnce={pickedOnce} onClose={() => setPicked([])} onSend={sendPicked} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  errorBar: { marginHorizontal: Spacing.three, marginBottom: 6, padding: 10, borderRadius: Radius.md, backgroundColor: '#FDE2E4' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.two,
    marginTop: Spacing.one,
    paddingVertical: 8,
    paddingRight: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  replyAccent: { width: 4, alignSelf: 'stretch', backgroundColor: c.primary },
  replyAuthor: { fontFamily: Fonts.bold, fontSize: 13, color: c.primary },
  replyText: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary },
  stallBar: { marginHorizontal: Spacing.three, marginBottom: 6, padding: 10, borderRadius: Radius.md, backgroundColor: '#FFF1C9' },
  errorBarText: { fontFamily: Fonts.medium, fontSize: 13, color: c.danger },
  mentions: { marginHorizontal: Spacing.two, borderRadius: 14, backgroundColor: '#fff', paddingVertical: 4, overflow: 'hidden' },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  mentionAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FBE3F1', alignItems: 'center', justifyContent: 'center' },
  mentionLetter: { fontFamily: Fonts.bold, color: c.primary },
  mentionName: { fontFamily: Fonts.semibold, fontSize: 15, color: c.text },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: Spacing.two, paddingTop: Spacing.two, paddingBottom: Spacing.one },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  textInput: { flex: 1, maxHeight: 120, padding: 0, fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  recording: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger },
  recText: { fontFamily: Fonts.semibold, fontSize: 15, color: c.text },
  slideText: { flex: 1, textAlign: 'center', fontFamily: Fonts.medium, fontSize: 14, color: c.textSecondary },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  sendBig: { transform: [{ scale: 1.25 }] },
  lockHint: { position: 'absolute', bottom: 62, left: 5, width: 36, paddingVertical: 8, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center' },
  lockedWrap: { paddingHorizontal: Spacing.two, paddingTop: Spacing.two, gap: 8 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 4 },
  onceBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  onceOn: { backgroundColor: c.primary, borderStyle: 'solid' },
  onceText: { fontFamily: Fonts.bold, fontSize: 13, color: c.primary },
  blocked: { paddingTop: Spacing.three, paddingHorizontal: Spacing.four, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
  blockedText: { fontFamily: Fonts.medium, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
});
