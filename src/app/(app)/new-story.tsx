import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Spacing } from '@/constants/theme';
import { chatKeys, storyApi } from '@/lib/chat-api';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';

const COLORS = ['#C2185B', '#7B1FA2', '#303F9F', '#00796B', '#F57C00', '#5D4037', '#263238'];

/** Post a Status: text on a colour (tap the palette to change it), or a photo / video with a caption. */
export default function NewStory() {
  const mode = useLocalSearchParams<{ mode?: string }>().mode;
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [bg, setBg] = useState(COLORS[0]);
  const [media, setMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    const fn = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return setError('Allow camera access in Settings.');
    const res = await fn({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 60 });
    const a = res.assets?.[0];
    if (!res.canceled && a) setMedia({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' });
  };
  // Open straight into the picker when coming from the camera button.
  const [autoPicked, setAutoPicked] = useState(false);
  if (!autoPicked && mode === 'media') {
    setAutoPicked(true);
    void pick(false);
  }

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      if (media) await storyApi.media(media.type, { uri: media.uri, name: media.type === 'video' ? 'story.mp4' : 'story.jpg', type: media.type === 'video' ? 'video/mp4' : 'image/jpeg' }, caption.trim() || undefined);
      else await storyApi.text(text.trim(), bg);
      qc.invalidateQueries({ queryKey: chatKeys.stories });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canPost = media ? true : text.trim().length > 0;
  return (
    <View style={[styles.root, { backgroundColor: media ? '#000' : bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoider style={{ flex: 1 }}>
          <View style={styles.top}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }} />
            {!media && (
              <Pressable onPress={() => setBg(COLORS[(COLORS.indexOf(bg) + 1) % COLORS.length])} hitSlop={10} accessibilityLabel="Change colour">
                <Ionicons name="color-palette" size={26} color="#fff" />
              </Pressable>
            )}
            <Pressable onPress={() => pick(false)} hitSlop={10} accessibilityLabel="Photo or video from gallery">
              <Ionicons name="images" size={26} color="#fff" />
            </Pressable>
            <Pressable onPress={() => pick(true)} hitSlop={10} accessibilityLabel="Camera">
              <Ionicons name="camera" size={26} color="#fff" />
            </Pressable>
          </View>
          {media ? (
            <View style={{ flex: 1 }}>
              {media.type === 'image' ? (
                <Image source={media.uri} style={{ flex: 1 }} contentFit="contain" />
              ) : (
                <View style={styles.center}>
                  <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.hint}>Video ready</Text>
                </View>
              )}
              <TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption…" placeholderTextColor="rgba(255,255,255,0.7)" style={styles.caption} maxLength={700} />
            </View>
          ) : (
            <View style={styles.center}>
              <TextInput value={text} onChangeText={setText} placeholder="Type a status" placeholderTextColor="rgba(255,255,255,0.7)" style={styles.text} multiline autoFocus={mode !== 'media'} maxLength={700} textAlign="center" />
            </View>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.bottom}>
            <Text style={styles.hint}>Your matches can see this for 24 hours</Text>
            <Pressable onPress={post} disabled={!canPost || busy} style={[styles.send, !canPost && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Post status">
              {busy ? <ActivityIndicator color="#C2185B" /> : <Ionicons name="send" size={22} color="#C2185B" />}
            </Pressable>
          </View>
        </KeyboardAvoider>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 20, padding: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  text: { fontFamily: Fonts.bold, fontSize: 30, color: '#fff', width: '100%' },
  caption: { margin: Spacing.three, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: Fonts.medium, fontSize: 15 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  hint: { fontFamily: Fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  send: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: Fonts.medium, color: '#fff', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: 8 },
});
