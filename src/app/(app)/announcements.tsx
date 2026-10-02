import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { GlassCard } from '@/components/design/glass-card';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { chatApi, chatKeys } from '@/lib/chat-api';

const c = Colors.light;

/** Read-only channel from the Spark team (Figma "Announcements"). */
export default function AnnouncementsScreen() {
  const q = useQuery({ queryKey: chatKeys.announcements, queryFn: async () => (await chatApi.announcements()).data.announcements });
  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Text style={styles.title}>Announcements</Text>
        </View>
        <FlatList
          data={q.data ?? []}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </GlassCard>
          )}
        />
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  title: { fontFamily: Fonts.bold, fontSize: 20, color: c.text },
  list: { padding: Spacing.three, gap: Spacing.three },
  card: { padding: Spacing.three, gap: 6 },
  cardTitle: { fontFamily: Fonts.bold, fontSize: 16, color: c.text },
  body: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 20, color: c.text },
  date: { fontFamily: Fonts.medium, fontSize: 12, color: c.textSecondary },
});
