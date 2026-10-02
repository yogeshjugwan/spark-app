import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ScreenCapture from 'expo-screen-capture';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Fonts } from '@/constants/theme';
import { AppModal, useFrameSize } from '@/components/ui/web-frame';

export interface ViewerItem {
  key: string;
  type: 'image' | 'video';
  uri: string;
  caption?: string | null;
  title?: string;
  subtitle?: string;
}
interface ViewerState {
  items: ViewerItem[];
  index: number;
  /** View-once: no swiping, screenshots blocked, closes for good. */
  once: boolean;
}
const useViewer = create<ViewerState>(() => ({ items: [], index: 0, once: false }));

/** Open photos/videos full screen (tap a chat photo, the gallery, a view-once message…). */
export function openViewer(items: ViewerItem[], index = 0, once = false) {
  useViewer.setState({ items, index: Math.max(0, index), once });
}
const close = () => useViewer.setState({ items: [], index: 0, once: false });


/** Pinch to zoom, double-tap to zoom in/out, pan while zoomed. */
function ZoomableImage({ uri, onZoomChange }: { uri: string; onZoomChange: (zoomed: boolean) => void }) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(5, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value <= 1.01) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
    })
    .runOnJS(true)
    .onFinalize(() => onZoomChange(saved.value > 1.01));
  const pan = Gesture.Pan()
    .averageTouches(true)
    .minPointers(1)
    .onStart(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1.01) return;
      tx.value = sx.value + e.translationX;
      ty.value = sy.value + e.translationY;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd(() => {
      const zoomIn = saved.value <= 1.01;
      scale.value = withTiming(zoomIn ? 2.5 : 1);
      saved.value = zoomIn ? 2.5 : 1;
      tx.value = withTiming(0);
      ty.value = withTiming(0);
      onZoomChange(zoomIn);
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[styles.page, style]}>
        <Image source={uri} style={styles.full} contentFit="contain" accessibilityLabel="Photo, pinch to zoom" />
      </Animated.View>
    </GestureDetector>
  );
}

function VideoPage({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return (
    <View style={styles.page}>
      <VideoView player={player} style={styles.full} nativeControls contentFit="contain" />
    </View>
  );
}

export function MediaViewer() {
  // Viewer pages are the app's width (the centred column on wide web screens).
  const { width: W, height: H } = useFrameSize();
  const { items, index, once } = useViewer();
  const [current, setCurrent] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const open = items.length > 0;
  // Reset the page when a new set is opened (derived-state pattern, no effect needed).
  const [openedWith, setOpenedWith] = useState<ViewerItem[] | null>(null);
  if (openedWith !== items) {
    setOpenedWith(items);
    setCurrent(index);
    setZoomed(false);
  }

  useEffect(() => {
    if (!open || !once) return;
    ScreenCapture.preventScreenCaptureAsync('view-once').catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('view-once').catch(() => {});
    };
  }, [open, once]);

  if (!open) return null;
  const item = items[current] ?? items[0];
  return (
    <AppModal visible animationType="fade" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <FlatList
          data={items}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed && !once && items.length > 1}
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
          keyExtractor={(i) => i.key}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / W))}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: it, index: i }) => (
            <View style={{ width: W, height: H }}>{it.type === 'video' ? <VideoPage uri={it.uri} active={i === current} /> : <ZoomableImage uri={it.uri} onZoomChange={setZoomed} />}</View>
          )}
        />
        <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
          <Pressable onPress={close} hitSlop={12} style={styles.btn} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            {!!item.title && <Text style={styles.title}>{item.title}</Text>}
            {!!item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
          </View>
          {once ? (
            <View style={styles.onceBadge}>
              <Text style={styles.onceText}>1</Text>
            </View>
          ) : (
            items.length > 1 && (
              <Text style={styles.subtitle}>
                {current + 1} / {items.length}
              </Text>
            )
          )}
        </SafeAreaView>
        {!!item.caption && (
          <SafeAreaView edges={['bottom']} style={styles.captionWrap} pointerEvents="none">
            <Text style={styles.caption}>{item.caption}</Text>
          </SafeAreaView>
        )}
      </GestureHandlerRootView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  page: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', height: '100%' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.35)' },
  btn: { padding: 4 },
  title: { fontFamily: Fonts.bold, fontSize: 16, color: '#fff' },
  subtitle: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  onceBadge: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  onceText: { fontFamily: Fonts.bold, fontSize: 12, color: '#fff' },
  captionWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.45)' },
  caption: { fontFamily: Fonts.medium, fontSize: 15, color: '#fff', textAlign: 'center' },
});
