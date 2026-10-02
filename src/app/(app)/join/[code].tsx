import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { Button } from '@/components/ui/button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { chatKeys, groupExtraApi } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';

const c = Colors.light;

/** Opened from a group invite link (spark://join/<code>): preview, then join. */
export default function JoinGroup() {
  const code = useLocalSearchParams<{ code: string }>().code;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['invite', code], queryFn: async () => (await groupExtraApi.preview(code)).data.group, retry: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    try {
      const g = (await groupExtraApi.join(code)).data.group;
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
      router.replace(`/group/${g.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.root}>
        {q.isLoading ? (
          <ActivityIndicator color={c.primary} />
        ) : q.error ? (
          <>
            <Ionicons name="link-outline" size={48} color={c.textSecondary} />
            <Text style={styles.title}>{q.error.message}</Text>
            <Button title="Close" size="sm" onPress={() => router.back()} />
          </>
        ) : (
          <>
            {q.data?.photoUrl ? (
              <Image source={mediaUrl(q.data.photoUrl)} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, styles.ph]}>
                <Ionicons name="people" size={48} color={c.primary} />
              </View>
            )}
            <Text style={styles.title}>{q.data?.name}</Text>
            <Text style={styles.sub}>Group · {q.data?.memberCount} members</Text>
            {!!q.data?.description && <Text style={styles.desc}>{q.data.description}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button title="Join group" onPress={join} loading={busy} />
            <Button title="Not now" variant="ghost" size="sm" onPress={() => router.back()} />
          </>
        )}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  photo: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#FBE3F1' },
  ph: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Fonts.bold, fontSize: 22, color: c.text, textAlign: 'center' },
  sub: { fontFamily: Fonts.medium, fontSize: 14, color: c.textSecondary },
  desc: { fontFamily: Fonts.medium, fontSize: 15, color: c.text, textAlign: 'center' },
  error: { fontFamily: Fonts.medium, color: c.danger, textAlign: 'center' },
});
