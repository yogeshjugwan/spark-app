import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormMessage } from '@/components/ui/form-message';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { mediaUrl } from '@/lib/media';
import { useProfileMutations } from '@/lib/use-profile';
import type { Photo } from '@/lib/types';

const c = Colors.light;
const GAP = 10;

/**
 * 3×2 grid of photo slots. Tap an empty slot to add; tap a photo to make it the
 * main one or delete it. Uploads go straight to the API.
 */
export function PhotoGrid({ photos, min = 2, max = 6 }: { photos: Photo[]; min?: number; max?: number }) {
  const { addPhoto, deletePhoto, reorderPhotos } = useProfileMutations();
  const [error, setError] = useState<string | null>(null);
  // Tile size from the measured grid width (percent width + aspectRatio is unreliable in a wrapping row).
  const [gridWidth, setGridWidth] = useState(0);
  const tileW = gridWidth ? (gridWidth - GAP * 2) / 3 : 0;
  const tile = { width: tileW, height: tileW * 1.25 };

  const pick = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Allow photo access in Settings to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    addPhoto.mutate(
      { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' },
      { onError: (e) => setError(e.message) },
    );
  };

  const manage = (photo: Photo, index: number) => {
    const canDelete = photos.length > min;
    Alert.alert('Photo', undefined, [
      ...(index > 0
        ? [
            {
              text: 'Make main photo',
              onPress: () => reorderPhotos.mutate([photo.id, ...photos.filter((p) => p.id !== photo.id).map((p) => p.id)]),
            },
          ]
        : []),
      {
        text: canDelete ? 'Delete' : `Keep at least ${min} photos`,
        style: 'destructive' as const,
        onPress: canDelete ? () => deletePhoto.mutate(photo.id, { onError: (e) => setError(e.message) }) : undefined,
      },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const busy = addPhoto.isPending || deletePhoto.isPending || reorderPhotos.isPending;
  const slots = Array.from({ length: max }, (_, i) => photos[i] ?? null);

  return (
    <View style={styles.wrap}>
      <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {slots.map((photo, i) => {
          const isNext = !photo && i === photos.length;
          if (photo) {
            return (
              <Pressable
                key={photo.id}
                style={[styles.slot, tile]}
                onPress={() => manage(photo, i)}
                accessibilityRole="button"
                accessibilityLabel={i === 0 ? 'Main photo. Tap for options' : `Photo ${i + 1}. Tap for options`}>
                <Image source={mediaUrl(photo.url)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                {i === 0 && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainText}>Main</Text>
                  </View>
                )}
                <View style={styles.more}>
                  <Ionicons name="ellipsis-horizontal" size={14} color={c.text} />
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={`empty-${i}`}
              style={[styles.slot, tile, styles.empty, i < min && styles.required]}
              onPress={isNext && !busy ? pick : undefined}
              disabled={!isNext || busy}
              accessibilityRole="button"
              accessibilityLabel={isNext ? 'Add photo' : 'Empty photo slot'}>
              {isNext && addPhoto.isPending ? (
                <ActivityIndicator color={c.primary} />
              ) : (
                <View style={[styles.plus, !isNext && { opacity: 0.35 }]}>
                  <Ionicons name="add" size={22} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {photos.length < min
          ? `Add at least ${min} photos (${photos.length}/${min}). Clear photos of your face work best.`
          : `${photos.length}/${max} photos · Tap a photo to make it your main one or remove it.`}
      </Text>
      <FormMessage message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  slot: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#F6E6F1',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.pinkSoft,
  },
  required: { borderColor: c.primary },
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  mainBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: c.primary,
  },
  mainText: { fontFamily: Fonts.bold, fontSize: 11, color: '#fff' },
  more: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontFamily: Fonts.medium, fontSize: 13, color: c.textSecondary, lineHeight: 18 },
});
