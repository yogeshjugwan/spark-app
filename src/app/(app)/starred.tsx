import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { chatKeys, convApi, preview } from '@/lib/chat-api';

const c = Colors.light;

/** All your starred messages, newest first; tap to open the chat. */
export default function StarredScreen() {
  const me = useAuth((s) => s.user?.id ?? 0);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: chatKeys.starred, queryFn: async () => (await convApi.starred()).data.messages });

  const unstar = async (id: number) => {
    qc.setQueryData(chatKeys.starred, (list: typeof q.data) => list?.filter((m) => m.id !== id));
    await convApi.star(id, false).catch(() => {});
    qc.invalidateQueries({ queryKey: ['conv-state'] });
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Text style={styles.title}>Starred messages</Text>
        </View>
        {q.isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={q.data ?? []}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="star-outline" size={48} color={c.textSecondary} />
                <Text style={styles.emptyText}>Tap and hold any message, then tap Star to find it here later.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => (item.matchId ? router.push(`/chat/${item.matchId}`) : router.push(`/group/${item.groupId}`))}
                style={styles.card}
                accessibilityRole="button">
                <View style={styles.row}>
                  <Text style={styles.who}>{item.senderId === me ? 'You' : item.senderName}</Text>
                  <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</Text>
                </View>
                <Text style={styles.body} numberOfLines={4}>
                  {preview(item, false)}
                </Text>
                <Pressable onPress={() => unstar(item.id)} hitSlop={10} style={styles.star} accessibilityLabel="Unstar">
                  <Ionicons name="star" size={18} color="#F4B400" />
                </Pressable>
              </Pressable>
            )}
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
  card: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 16, padding: 14, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 28 },
  who: { fontFamily: Fonts.bold, fontSize: 14, color: c.primary },
  date: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
  body: { fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  star: { position: 'absolute', right: 12, top: 12 },
  empty: { alignItems: 'center', gap: 12, marginTop: 80, paddingHorizontal: 30 },
  emptyText: { fontFamily: Fonts.medium, fontSize: 15, color: c.textSecondary, textAlign: 'center' },
});
