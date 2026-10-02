import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LikeButton } from '@/components/discovery/like-button';
import { VoicePlayer } from '@/components/profile/voice-player';
import { Colors, Fonts } from '@/constants/theme';
import { mediaUrl } from '@/lib/media';
import { possessive } from '@/lib/pronoun';
import type { DiscoverProfile } from '@/lib/types';

const SIZE = 78;

/** One item of the Figma "Recommendations" row: round photo, pink bubble, name, "Hear her voice". */
export function RecommendationBubble({ person, onLike, liking }: { person: DiscoverProfile; onLike: () => void; liking: boolean }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.push(`/user/${person.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${person.name}, ${person.age}. View profile`}>
        <View style={styles.ring}>
          <Image source={mediaUrl(person.photos[0]?.url)} style={styles.avatar} contentFit="cover" transition={150} />
        </View>
      </Pressable>
      {/* Beside the photo button, not inside it: web can't nest <button>s. */}
      <View style={styles.badge}>
        <LikeButton liked={person.youLiked} loading={liking} onPress={onLike} size={28} label={person.name} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {person.name}
      </Text>
      {person.voice ? (
        <VoicePlayer uri={mediaUrl(person.voice.url)!} label={`Hear ${possessive(person.gender)} voice`} compact />
      ) : (
        <Text style={styles.meta}>{person.distanceKm ? `${person.distanceKm} km away` : `${person.age}`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE + 22, alignItems: 'center', gap: 6 },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    padding: 3,
    backgroundColor: '#fff',
    shadowColor: '#C24C99',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatar: { flex: 1, borderRadius: SIZE / 2, backgroundColor: '#F6E6F1' },
  badge: { position: 'absolute', top: -2, right: 7 },
  name: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.light.text, marginTop: 2 },
  meta: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.light.textSecondary },
});
