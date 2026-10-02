import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icon per route name: [inactive, active]. */
export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['compass-outline', 'compass'],
  featured: ['ribbon-outline', 'ribbon'],
  chats: ['chatbubble-ellipses-outline', 'chatbubble-ellipses'],
  profile: ['person-outline', 'person'],
};

const c = Colors.light;
export const TAB_BAR_HEIGHT = 68;

/**
 * Frosted bottom bar from the Figma frames: the active tab lifts into a white
 * circle above the bar; every tab shows its name under the icon.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
        {Platform.OS === 'ios' && <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
      </View>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const [idle, active] = TAB_ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.tab}>
              {focused ? (
                <View style={styles.activeWrap}>
                  <View style={styles.activeBubble}>
                    <Ionicons name={active} size={24} color={c.primary} />
                  </View>
                  <Text style={[styles.label, styles.labelActive]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name={idle} size={23} color={c.primary} style={styles.idleIcon} />
                  <Text style={styles.label} numberOfLines={1}>
                    {label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  clip: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  tint: { backgroundColor: Platform.OS === 'ios' ? 'rgba(247,214,236,0.55)' : 'rgba(249,222,240,0.92)' },
  row: { height: TAB_BAR_HEIGHT, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  idleIcon: { opacity: 0.85 },
  activeWrap: { alignItems: 'center', marginTop: -30 },
  activeBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(247,214,236,0.9)',
    shadowColor: '#C24C99',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { marginTop: 3, fontFamily: Fonts.medium, fontSize: 11, color: c.textSecondary },
  labelActive: { marginTop: 4, fontFamily: Fonts.bold, color: c.primary },
});
