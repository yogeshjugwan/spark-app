import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { chatApi, chatKeys, type ChatMessage, type GiftCode } from '@/lib/chat-api';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;

/** Figma gift sheet: coins badge, rose/chocolate/ring, custom message, Request Image/Video. */
export function GiftPanel({
  visible,
  matchId,
  name,
  onClose,
  onSent,
}: {
  visible: boolean;
  matchId: number;
  name: string;
  onClose: () => void;
  onSent: (m: ChatMessage) => void;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<GiftCode | null>(null);
  const [note, setNote] = useState('');
  const wallet = useQuery({ queryKey: chatKeys.wallet, queryFn: async () => (await chatApi.wallet()).data, enabled: visible });

  const done = (m: ChatMessage) => {
    setPicked(null);
    setNote('');
    onSent(m);
  };
  const gift = useMutation({
    mutationFn: () => chatApi.sendGift(matchId, picked!, note.trim() || undefined),
    onSuccess: (r) => {
      qc.setQueryData(chatKeys.wallet, r.data.wallet);
      done(r.data.message);
    },
  });
  const request = useMutation({ mutationFn: (kind: 'image' | 'video') => chatApi.sendRequest(matchId, kind), onSuccess: (r) => done(r.data.message) });

  const coins = wallet.data?.coins;
  const price = wallet.data?.gifts.find((g) => g.code === picked)?.price ?? 0;
  const short = picked != null && coins != null && coins < price;

  return (
    <AppModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close gifts" />
      <KeyboardAvoider>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Send {name} a gift</Text>
            <View style={styles.coins} accessibilityLabel={`${coins ?? 0} coins`}>
              <Text style={styles.coinIcon}>🪙</Text>
              <Text style={styles.coinText}>{coins ?? '…'}</Text>
            </View>
          </View>

          <View style={styles.gifts}>
            {(wallet.data?.gifts ?? []).map((g) => (
              <Pressable
                key={g.code}
                onPress={() => setPicked(g.code)}
                style={[styles.gift, picked === g.code && styles.giftOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: picked === g.code }}
                accessibilityLabel={`${g.label}, ${g.price} coins`}>
                <Text style={styles.emoji}>{g.emoji}</Text>
                <Text style={styles.giftLabel}>{g.label}</Text>
                <Text style={styles.price}>🪙 {g.price}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a message (optional)"
            placeholderTextColor={c.textSecondary}
            maxLength={200}
            style={styles.note}
            accessibilityLabel="Gift message"
          />
          <FormMessage message={short ? `You need ${price - (coins ?? 0)} more coins for this gift.` : (gift.error?.message ?? request.error?.message ?? null)} />
          <Button title={picked ? `Send for ${price} coins` : 'Pick a gift'} disabled={!picked || short} loading={gift.isPending} onPress={() => gift.mutate()} />

          <View style={styles.divider} />
          <View style={styles.requests}>
            <Pressable style={styles.request} onPress={() => request.mutate('image')} disabled={request.isPending} accessibilityRole="button">
              <Ionicons name="camera-outline" size={20} color={c.primary} />
              <Text style={styles.requestText}>Request Image</Text>
            </Pressable>
            <Pressable style={styles.request} onPress={() => request.mutate('video')} disabled={request.isPending} accessibilityRole="button">
              <Ionicons name="videocam-outline" size={20} color={c.primary} />
              <Text style={styles.requestText}>Request Video</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoider>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,10,25,0.35)' },
  sheet: { backgroundColor: '#FFF7FB', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.three, gap: Spacing.three },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#E9C9DD' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontFamily: Fonts.bold, fontSize: 18, color: c.text },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: '#FFF1C9' },
  coinIcon: { fontSize: 14 },
  coinText: { fontFamily: Fonts.bold, fontSize: 14, color: '#8A6400' },
  gifts: { flexDirection: 'row', gap: Spacing.two },
  gift: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: 20, borderWidth: 1.5, borderColor: '#F3D9EA', backgroundColor: '#fff' },
  giftOn: { borderColor: c.primary, backgroundColor: '#FDEAF5' },
  emoji: { fontSize: 36 },
  giftLabel: { fontFamily: Fonts.bold, fontSize: 13, color: c.text },
  price: { fontFamily: Fonts.semibold, fontSize: 12, color: c.textSecondary },
  note: { height: 46, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: '#fff', fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong },
  requests: { flexDirection: 'row', gap: Spacing.two },
  request: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: Radius.pill, borderWidth: 1, borderColor: c.primary },
  requestText: { fontFamily: Fonts.bold, fontSize: 14, color: c.primary },
});
