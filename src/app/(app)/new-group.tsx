import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { EmptyState } from '@/components/design/empty-state';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { chatKeys, groupApi } from '@/lib/chat-api';
import { discoveryApi } from '@/lib/discovery-api';
import { mediaUrl } from '@/lib/media';
import { discoveryKeys } from '@/lib/use-discovery';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';

const c = Colors.light;

/**
 * Create a group, or (with ?groupId=) add people to one. Only your matches are listed —
 * the server enforces the same rule.
 */
export default function NewGroupScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = params.groupId ? Number(params.groupId) : null;
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const matches = useQuery({ queryKey: discoveryKeys.matches, queryFn: async () => (await discoveryApi.matches()).data.matches });
  const group = useQuery({
    queryKey: [...chatKeys.groupThread(groupId ?? 0), 'details'],
    enabled: groupId != null,
    queryFn: async () => (await groupApi.details(groupId!)).data.group,
  });
  const already = new Set(group.data?.members.map((m) => m.id) ?? []);
  const people = (matches.data ?? []).filter((m) => !already.has(m.user.id));

  const save = useMutation({
    mutationFn: async () => {
      const ids = [...picked];
      return groupId ? groupApi.addMembers(groupId, ids) : groupApi.create(name.trim(), ids);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
      qc.invalidateQueries({ queryKey: chatKeys.groupThread(r.data.group.id) });
      if (groupId) router.back();
      else router.replace(`/group/${r.data.group.id}`);
    },
  });

  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const min = groupId ? 1 : 2;
  const ready = picked.size >= min && (groupId || name.trim().length > 0);

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
          <Text style={styles.title}>{groupId ? 'Add people' : 'New group'}</Text>
        </View>

        <KeyboardAvoider style={styles.flex}>
          {!groupId && (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Group name"
              placeholderTextColor={c.textSecondary}
              maxLength={60}
              style={styles.name}
              accessibilityLabel="Group name"
              returnKeyType="done"
            />
          )}
          <Text style={styles.hint}>{groupId ? 'Pick matches to add.' : 'Pick at least 2 of your matches. Only people you’ve matched with can be added.'}</Text>

          {matches.isLoading ? (
            <ActivityIndicator color={c.primary} style={styles.flex} />
          ) : people.length === 0 ? (
            <EmptyState icon="people-outline" title="No one to add" body={groupId ? 'All your matches are already here.' : 'Match with people first, then start a group.'} />
          ) : (
            <FlatList
              data={people}
              keyExtractor={(m) => String(m.user.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const on = picked.has(item.user.id);
                return (
                  <Pressable
                    onPress={() => toggle(item.user.id)}
                    style={styles.row}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={item.user.name}>
                    <Image source={mediaUrl(item.user.photoUrl)} style={styles.avatar} contentFit="cover" />
                    <Text style={styles.person}>{item.user.name}</Text>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? c.primary : c.textSecondary} />
                  </Pressable>
                );
              }}
            />
          )}

          <View style={styles.footer}>
            <FormMessage message={save.error?.message ?? null} />
            <Button
              title={groupId ? `Add ${picked.size || ''}`.trim() : `Create group${picked.size ? ` (${picked.size + 1})` : ''}`}
              disabled={!ready}
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
          </View>
        </KeyboardAvoider>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  title: { fontFamily: Fonts.bold, fontSize: 20, color: c.text },
  name: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.85)',
    fontFamily: Fonts.semibold,
    fontSize: 16,
    color: c.text,
  },
  hint: { marginHorizontal: Spacing.three, marginVertical: Spacing.three, fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F6E6F1' },
  person: { flex: 1, fontFamily: Fonts.bold, fontSize: 16, color: c.text },
  footer: { padding: Spacing.three, gap: Spacing.two },
});
