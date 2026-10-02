import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { disappearMenu, muteMenu } from '@/components/chat/chat-menu';
import { showMenu } from '@/components/ui/action-menu';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { GlassCard } from '@/components/design/glass-card';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { chatKeys, convApi, disappearLabel, groupApi, groupExtraApi, type GroupMember } from '@/lib/chat-api';
import { mediaUrl } from '@/lib/media';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';

const c = Colors.light;

/** Members, rename, add/remove (admins), and leave. */
export default function GroupInfoScreen() {
  const groupId = Number(useLocalSearchParams<{ groupId: string }>().groupId);
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const conv = { kind: 'group' as const, id: groupId };
  const st = useQuery({ queryKey: chatKeys.state(conv), queryFn: async () => (await convApi.state(conv)).data });

  const q = useQuery({ queryKey: [...chatKeys.groupThread(groupId), 'details'], queryFn: async () => (await groupApi.details(groupId)).data.group });
  const g = q.data;
  const admin = g?.myRole === 'admin';

  const refresh = () => {
    qc.invalidateQueries({ queryKey: chatKeys.groupThread(groupId) });
    qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
    qc.invalidateQueries({ queryKey: chatKeys.state(conv) });
  };
  const info = useMutation({
    mutationFn: (b: Parameters<typeof groupExtraApi.info>[1]) => groupExtraApi.info(groupId, b),
    onSuccess: () => {
      setDescDraft(null);
      refresh();
    },
  });
  const role = useMutation({ mutationFn: (v: { userId: number; role: 'admin' | 'member' }) => groupExtraApi.role(groupId, v.userId, v.role), onSuccess: refresh });
  const invite = useMutation({ mutationFn: (enabled: boolean) => groupExtraApi.invite(groupId, enabled), onSuccess: refresh });
  const photo = useMutation({
    mutationFn: async () => {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
      if (res.canceled || !res.assets[0]) return;
      await groupExtraApi.photo(groupId, { uri: res.assets[0].uri, name: 'group.jpg', type: 'image/jpeg' });
    },
    onSuccess: refresh,
  });
  const link = g?.inviteCode ? Linking.createURL(`/join/${g.inviteCode}`) : null;
  const linkMenu = () =>
    showMenu(
      [
        { label: 'Share link', icon: 'share-social-outline', onPress: () => Share.share({ message: `Join my Spark group “${g?.name}”: ${link}` }) },
        { label: 'Copy link', icon: 'copy-outline', onPress: () => Clipboard.setStringAsync(link ?? '') },
        { label: 'Reset link', icon: 'refresh', onPress: () => invite.mutate(true) },
        { label: 'Turn off link', icon: 'close-circle-outline', danger: true, onPress: () => invite.mutate(false) },
      ],
      'Invite link',
    );
  const rename = useMutation({
    mutationFn: (name: string) => groupApi.rename(groupId, name),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (userId: number) => groupApi.removeMember(groupId, userId), onSuccess: refresh });
  const leave = useMutation({
    mutationFn: () => groupApi.removeMember(groupId, me!),
    onSuccess: () => {
      qc.removeQueries({ queryKey: chatKeys.groupThread(groupId) });
      qc.invalidateQueries({ queryKey: chatKeys.list, exact: true });
      router.dismissTo('/chats');
    },
  });

  const memberMenu = (m: GroupMember) => {
    if (m.id === me) return;
    showMenu(
      [
        { label: 'View profile', icon: 'person-circle-outline', onPress: () => router.push(`/user/${m.id}`) },
        ...(admin
          ? [
              m.role === 'admin'
                ? { label: 'Dismiss as admin', icon: 'shield-outline' as const, onPress: () => role.mutate({ userId: m.id, role: 'member' }) }
                : { label: 'Make group admin', icon: 'shield-checkmark-outline' as const, onPress: () => role.mutate({ userId: m.id, role: 'admin' }) },
              { label: 'Remove from group', icon: 'person-remove-outline' as const, danger: true, onPress: () => remove.mutate(m.id) },
            ]
          : []),
      ],
      m.name,
    );
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Text style={styles.title}>Group info</Text>
        </View>

        {!g ? (
          <ActivityIndicator color={c.primary} style={styles.flex} />
        ) : (
          <KeyboardAvoider style={styles.flex}>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.hero}>
                <Pressable onPress={() => admin && photo.mutate()} disabled={!admin} accessibilityRole={admin ? 'button' : undefined} accessibilityLabel={admin ? 'Change group photo' : 'Group photo'}>
                  {g.photoUrl ? (
                    <Image source={mediaUrl(g.photoUrl)} style={styles.bigAvatar} contentFit="cover" />
                  ) : (
                    <View style={styles.bigAvatar}>
                      <Ionicons name="people" size={40} color={c.primary} />
                    </View>
                  )}
                  {admin && (
                    <View style={styles.camBadge}>
                      {photo.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}
                    </View>
                  )}
                </Pressable>
                {editing != null ? (
                  <View style={styles.renameRow}>
                    <TextInput value={editing} onChangeText={setEditing} maxLength={60} autoFocus style={styles.renameInput} accessibilityLabel="Group name" />
                    <Button title="Save" size="sm" disabled={!editing.trim()} loading={rename.isPending} onPress={() => rename.mutate(editing.trim())} />
                  </View>
                ) : (
                  <Pressable onPress={() => admin && setEditing(g.name)} disabled={!admin} accessibilityRole={admin ? 'button' : undefined} accessibilityHint={admin ? 'Rename group' : undefined}>
                    <Text style={styles.groupName}>
                      {g.name} {admin && <Ionicons name="pencil" size={16} color={c.textSecondary} />}
                    </Text>
                  </Pressable>
                )}
                <Text style={styles.count}>{g.members.length} people</Text>
              </View>

              <GlassCard style={styles.card}>
                {descDraft != null ? (
                  <View style={{ gap: 8, paddingVertical: 6 }}>
                    <TextInput value={descDraft} onChangeText={setDescDraft} maxLength={500} multiline autoFocus placeholder="Add group description" style={styles.descInput} />
                    <Button title="Save" size="sm" loading={info.isPending} onPress={() => info.mutate({ description: descDraft.trim() || null })} />
                  </View>
                ) : (
                  <Pressable onPress={() => admin && setDescDraft(g.description ?? '')} disabled={!admin} style={styles.row} accessibilityRole={admin ? 'button' : undefined}>
                    <Text style={[styles.desc, !g.description && { color: c.primary }]}>{g.description || (admin ? 'Add group description' : 'No description')}</Text>
                  </Pressable>
                )}
              </GlassCard>

              <GlassCard style={styles.card}>
                <Pressable onPress={() => router.push({ pathname: '/media/[kind]/[id]', params: { kind: 'group', id: String(groupId) } })} style={styles.row} accessibilityRole="button">
                  <Ionicons name="images-outline" size={22} color={c.text} />
                  <Text style={styles.person}>Media, links and docs</Text>
                  <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
                </Pressable>
                <Pressable onPress={() => router.push('/starred')} style={styles.row} accessibilityRole="button">
                  <Ionicons name="star-outline" size={22} color={c.text} />
                  <Text style={styles.person}>Starred messages</Text>
                  <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
                </Pressable>
                <Pressable onPress={() => muteMenu(qc, conv, st.data?.prefs.mutedUntil ?? null)} style={styles.row} accessibilityRole="button">
                  <Ionicons name="notifications-off-outline" size={22} color={c.text} />
                  <Text style={styles.person}>Mute notifications</Text>
                  <Text style={styles.value}>{st.data?.prefs.mutedUntil && new Date(st.data.prefs.mutedUntil) > new Date() ? 'On' : 'Off'}</Text>
                </Pressable>
                <Pressable onPress={() => (admin ? disappearMenu(qc, conv, g.disappearSec) : undefined)} disabled={!admin} style={styles.row} accessibilityRole="button">
                  <Ionicons name="timer-outline" size={22} color={c.text} />
                  <Text style={styles.person}>Disappearing messages</Text>
                  <Text style={styles.value}>{disappearLabel(g.disappearSec)}</Text>
                </Pressable>
              </GlassCard>

              {admin && (
                <GlassCard style={styles.card}>
                  <View style={styles.row}>
                    <Ionicons name="megaphone-outline" size={22} color={c.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.person}>Only admins can send</Text>
                      <Text style={styles.value}>Turn the group into announcements</Text>
                    </View>
                    <Switch value={g.adminsOnly} onValueChange={(v) => info.mutate({ adminsOnly: v })} trackColor={{ true: c.primary }} />
                  </View>
                  <Pressable onPress={() => (link ? linkMenu() : invite.mutate(true))} style={styles.row} accessibilityRole="button">
                    <Ionicons name="link-outline" size={22} color={c.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.person}>Invite via link</Text>
                      <Text style={styles.value} numberOfLines={1}>
                        {link ?? 'Create a link anyone can use to join'}
                      </Text>
                    </View>
                    {invite.isPending && <ActivityIndicator color={c.primary} />}
                  </Pressable>
                </GlassCard>
              )}

              <GlassCard style={styles.card}>
                {admin && (
                  <Pressable onPress={() => router.push(`/new-group?groupId=${groupId}`)} style={styles.row} accessibilityRole="button">
                    <View style={[styles.avatar, styles.addIcon]}>
                      <Ionicons name="person-add" size={20} color="#fff" />
                    </View>
                    <Text style={[styles.person, { color: c.primary }]}>Add people</Text>
                  </Pressable>
                )}
                {g.members.map((m) => (
                  <Pressable key={m.id} onPress={() => memberMenu(m)} style={styles.row} accessibilityRole="button" accessibilityLabel={`${m.name}${m.role === 'admin' ? ', admin' : ''}`}>
                    <Image source={mediaUrl(m.photoUrl)} style={styles.avatar} contentFit="cover" />
                    <Text style={styles.person}>{m.id === me ? 'You' : m.name}</Text>
                    {m.role === 'admin' && <Text style={styles.badge}>Admin</Text>}
                  </Pressable>
                ))}
              </GlassCard>

              <FormMessage message={rename.error?.message ?? remove.error?.message ?? leave.error?.message ?? info.error?.message ?? role.error?.message ?? invite.error?.message ?? photo.error?.message ?? null} />
              <Button
                title="Leave group"
                variant="ghost"
                loading={leave.isPending}
                onPress={() =>
                  Alert.alert(`Leave ${g.name}?`, 'You won’t get new messages from this group.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => leave.mutate() },
                  ])
                }
              />
            </ScrollView>
          </KeyboardAvoider>
        )}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  title: { fontFamily: Fonts.bold, fontSize: 20, color: c.text },
  body: { padding: Spacing.three, gap: Spacing.three },
  hero: { alignItems: 'center', gap: 6 },
  bigAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FBE3F1', alignItems: 'center', justifyContent: 'center' },
  groupName: { fontFamily: Fonts.extrabold, fontSize: 22, color: c.text, textAlign: 'center' },
  count: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'stretch' },
  renameInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: '#fff',
    fontFamily: Fonts.semibold,
    fontSize: 16,
    color: c.text,
  },
  card: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F6E6F1' },
  addIcon: { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  person: { flex: 1, fontFamily: Fonts.bold, fontSize: 15, color: c.text },
  camBadge: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  desc: { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  descInput: { minHeight: 70, borderRadius: Radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: '#fff', padding: 10, fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  value: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary },
  badge: { fontFamily: Fonts.bold, fontSize: 11, color: c.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: '#FBE3F1' },
});
