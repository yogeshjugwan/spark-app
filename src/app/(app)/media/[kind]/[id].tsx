import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openViewer } from '@/components/chat/media-viewer';
import { FileCard, LinkCard } from '@/components/chat/rich-content';
import { AppBackground } from '@/components/design/app-background';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { convApi, type ConvRef } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';
import { useFrameSize } from '@/components/ui/web-frame';

const c = Colors.light;
const TABS = [
  { key: 'media', label: 'Media' },
  { key: 'links', label: 'Links' },
  { key: 'docs', label: 'Docs' },
] as const;

/** "Media, links and docs" for a chat or group (WhatsApp contact info). */
export default function MediaScreen() {
  const p = useLocalSearchParams<{ kind: string; id: string }>();
  const conv: ConvRef = { kind: p.kind === 'group' ? 'group' : 'match', id: Number(p.id) };
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('media');
  const q = useQuery({ queryKey: ['gallery', conv.kind, conv.id, tab], queryFn: async () => (await convApi.gallery(conv, tab)).data.messages });
  const items = q.data ?? [];
  const CELL = (useFrameSize().width - 4 * 3) / 3;

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Text style={styles.title}>Media, links and docs</Text>
        </View>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
              <Text style={[styles.tabText, tab === t.key && { color: c.primary }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        {q.isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>Nothing here yet.</Text>
        ) : tab === 'media' ? (
          <FlatList
            key="grid"
            data={items}
            numColumns={3}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ gap: 3, padding: 3 }}
            columnWrapperStyle={{ gap: 3 }}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() =>
                  openViewer(
                    items.map((m) => ({ key: String(m.id), type: m.type === 'video' ? 'video' : 'image', uri: m.data?.gif ?? mediaUrl(m.url)!, caption: m.body })),
                    index,
                  )
                }
                accessibilityRole="imagebutton">
                {item.type === 'video' ? (
                  <View style={[styles.cell, styles.video, { width: CELL, height: CELL }]}>
                    <Ionicons name="play" size={28} color="#fff" />
                  </View>
                ) : (
                  <Image source={item.data?.gif ?? mediaUrl(item.url)} style={[styles.cell, { width: CELL, height: CELL }]} contentFit="cover" />
                )}
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            key="list"
            data={items}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
            renderItem={({ item }) =>
              tab === 'docs' ? (
                <View style={styles.card}>
                  <FileCard m={item} mine={false} />
                </View>
              ) : (
                <View style={styles.card}>
                  {item.data?.link ? <LinkCard link={item.data.link} mine={false} /> : null}
                  <Text style={styles.linkText} numberOfLines={3}>
                    {item.body}
                  </Text>
                </View>
              )
            }
          />
        )}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  title: { fontFamily: Fonts.bold, fontSize: 18, color: c.text },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)' },
  tabOn: { backgroundColor: '#FBE3F1' },
  tabText: { fontFamily: Fonts.semibold, fontSize: 14, color: c.textSecondary },
  empty: { fontFamily: Fonts.medium, fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 60 },
  cell: { backgroundColor: '#F6E6F1' },
  video: { backgroundColor: '#2A1A24', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 16, padding: 10 },
  linkText: { fontFamily: Fonts.medium, fontSize: 14, color: c.text },
});
