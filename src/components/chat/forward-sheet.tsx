import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { chatApi, chatKeys, convApi, type ConvRef } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';
import { upsertMessage } from '@/lib/use-chat-socket';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;
const MAX = 5;

/** WhatsApp "Forward to…": pick up to 5 chats, then send. */
export function ForwardSheet({ messageIds, onClose, onDone }: { messageIds: number[]; onClose: () => void; onDone?: (n: number) => void }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: chatKeys.list, queryFn: async () => (await chatApi.conversations()).data.conversations, enabled: messageIds.length > 0 });
  const [picked, setPicked] = useState<ConvRef[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = (list.data ?? [])
    .map((x) => (x.kind === 'match' ? { ref: { kind: 'match' as const, id: x.matchId }, name: x.user.name, photo: x.user.photoUrl } : { ref: { kind: 'group' as const, id: x.groupId }, name: x.name, photo: x.photoUrl }))
    .filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const isOn = (r: ConvRef) => picked.some((p) => p.kind === r.kind && p.id === r.id);
  const toggle = (r: ConvRef) => setPicked((p) => (isOn(r) ? p.filter((x) => !(x.kind === r.kind && x.id === r.id)) : p.length < MAX ? [...p, r] : p));

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await convApi.forward(messageIds, picked);
      for (const m of res.data.messages) upsertMessage(qc, m);
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
      onDone?.(picked.length);
      setPicked([]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal visible={messageIds.length > 0} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Forward to…</Text>
            <Text style={styles.sub}>
              {picked.length}/{MAX} selected
            </Text>
          </View>
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={c.textSecondary} style={styles.search} />
        {list.isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 30 }} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => `${r.ref.kind}-${r.ref.id}`}
            renderItem={({ item }) => (
              <Pressable onPress={() => toggle(item.ref)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: isOn(item.ref) }} accessibilityLabel={item.name}>
                {item.photo ? (
                  <Image source={mediaUrl(item.photo)} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarPh]}>
                    <Ionicons name={item.ref.kind === 'group' ? 'people' : 'person'} size={20} color={c.primary} />
                  </View>
                )}
                <Text style={styles.name}>{item.name}</Text>
                <Ionicons name={isOn(item.ref) ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={isOn(item.ref) ? c.primary : c.textSecondary} />
              </Pressable>
            )}
          />
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {picked.length > 0 && (
          <Pressable onPress={send} disabled={busy} style={styles.send} accessibilityRole="button" accessibilityLabel="Send">
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={22} color="#fff" />}
          </Pressable>
        )}
      </SafeAreaView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF7FB' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.three },
  title: { fontFamily: Fonts.bold, fontSize: 18, color: c.text },
  sub: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  search: { marginHorizontal: Spacing.three, marginBottom: Spacing.two, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff', fontFamily: Fonts.medium, color: c.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F6E6F1' },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontFamily: Fonts.semibold, fontSize: 16, color: c.text },
  error: { fontFamily: Fonts.medium, color: c.danger, textAlign: 'center', padding: 8 },
  send: { position: 'absolute', right: 24, bottom: 36, width: 58, height: 58, borderRadius: 29, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
