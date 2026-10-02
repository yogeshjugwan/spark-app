import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LikeButton } from "@/components/discovery/like-button";
import { Fonts, Radius } from "@/constants/theme";
import { mediaUrl } from "@/lib/media";
import type { DiscoverProfile } from "@/lib/types";

/** Compact like count like the Figma tiles ("♡ 1900", "45.9k"). */
export function formatCount(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/** A photo tile in the Figma "Explore" masonry grid. */
export function ExploreTile({
  person,
  height,
  onLike,
  liking,
}: {
  person: DiscoverProfile;
  height: number;
  onLike: () => void;
  liking: boolean;
}) {
  // The like button sits beside the card button (not inside it): web can't nest <button>s.
  return (
    <View style={[styles.tile, { height }]}>
      <Pressable
        onPress={() => router.push(`/user/${person.id}`)}
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          { opacity: pressed ? 0.92 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${person.name}, ${person.age}${person.distanceKm ? `, ${person.distanceKm} kilometres away` : ""}. ${person.likeCount} likes. View profile`}
      >
        <Image
          source={mediaUrl(person.photos[0]?.url)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
        <LinearGradient
          colors={["rgba(20,12,30,0)", "rgba(20,12,30,0.7)"]}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}, {person.age}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="heart-outline" size={12} color="#fff" />
            <Text style={styles.meta}>{formatCount(person.likeCount)}</Text>
            {person.distanceKm !== null && (
              <Text style={styles.meta}>· {person.distanceKm} km</Text>
            )}
          </View>
        </View>
      </Pressable>
      <View style={styles.like}>
        <LikeButton
          liked={person.youLiked}
          loading={liking}
          onPress={onLike}
          size={30}
          label={person.name}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: "#EADCF0",
  },
  like: { position: "absolute", top: 10, right: 10 },
  info: { position: "absolute", left: 12, right: 12, bottom: 10, gap: 2 },
  name: { fontFamily: Fonts.bold, fontSize: 15, color: "#fff" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: "rgba(255,255,255,0.92)",
  },
});
