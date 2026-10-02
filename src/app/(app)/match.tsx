import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Fonts, Gradients, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-store';
import { mediaUrl } from '@/lib/media';

/** "It's a match!" — shown over the current screen when a like is mutual. */
export default function MatchScreen() {
  const { matchId, name, photoUrl } = useLocalSearchParams<{ matchId: string; name: string; photoUrl: string }>();
  const mine = useAuth((s) => s.profile?.photos[0]?.url);

  return (
    <LinearGradient colors={Gradients.hero} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.flex}>
      <SafeAreaView style={styles.content} accessibilityViewIsModal>
        <View style={styles.photos} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Image source={mediaUrl(mine)} style={[styles.photo, styles.left]} contentFit="cover" />
          <Image source={mediaUrl(photoUrl)} style={[styles.photo, styles.right]} contentFit="cover" />
          <View style={styles.heart}>
            <Ionicons name="heart" size={30} color="#E063B2" />
          </View>
        </View>

        <Text style={styles.title} accessibilityRole="header">
          It&apos;s a match!
        </Text>
        <Text style={styles.body}>You and {name} liked each other. Say hi while it&apos;s fresh.</Text>

        <View style={styles.actions}>
          <Button
            title={`Say hi to ${name}`}
            variant="light"
            icon="chatbubble-ellipses"
            onPress={() => {
              router.back();
              router.navigate(matchId ? `/chat/${matchId}` : '/chats');
            }}
          />
          <Button title="Keep browsing" variant="onAccent" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const PHOTO = 150;
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.three },
  photos: { width: PHOTO * 1.75, height: PHOTO * 1.3, marginBottom: Spacing.three },
  photo: {
    position: 'absolute',
    width: PHOTO,
    height: PHOTO * 1.25,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#F6E6F1',
  },
  left: { left: 0, top: 10, transform: [{ rotate: '-8deg' }] },
  right: { right: 0, top: 0, transform: [{ rotate: '8deg' }] },
  heart: {
    position: 'absolute',
    alignSelf: 'center',
    left: PHOTO * 0.875 - 30,
    bottom: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: Fonts.extrabold, fontSize: 38, color: '#fff' },
  body: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: Spacing.one, marginTop: Spacing.three },
});
