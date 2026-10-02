import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;

export interface MenuItem {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  /** Shown on the right, e.g. the current value ("7 days"). */
  value?: string;
  checked?: boolean;
  onPress: () => void;
}
const useMenu = create<{ title?: string; items: MenuItem[] }>(() => ({ items: [] }));

/** Bottom-sheet menu with any number of options (Android alerts only show three buttons). */
export function showMenu(items: MenuItem[], title?: string) {
  useMenu.setState({ items, title });
}
const close = () => useMenu.setState({ items: [], title: undefined });

export function ActionMenuHost() {
  const { items, title } = useMenu();
  return (
    <AppModal visible={items.length > 0} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close menu">
        <SafeAreaView edges={['bottom']} style={styles.wrap}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {!!title && <Text style={styles.title}>{title}</Text>}
            <ScrollView style={{ maxHeight: 520 }}>
              {items.map((it) => (
                <Pressable
                  key={it.label}
                  onPress={() => {
                    close();
                    // Let the sheet close before opening anything else (another menu, a modal).
                    setTimeout(it.onPress, 50);
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F8EDF4' }]}
                  accessibilityRole="button"
                  accessibilityState={it.checked !== undefined ? { checked: it.checked } : undefined}>
                  {it.icon && <Ionicons name={it.icon} size={21} color={it.danger ? c.danger : c.text} />}
                  <Text style={[styles.label, it.danger && { color: c.danger }]}>{it.label}</Text>
                  {!!it.value && <Text style={styles.value}>{it.value}</Text>}
                  {it.checked && <Ionicons name="checkmark" size={20} color={c.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,10,25,0.35)', justifyContent: 'flex-end' },
  wrap: { padding: Spacing.three },
  sheet: { backgroundColor: '#FFF7FB', borderRadius: 24, paddingVertical: Spacing.two, overflow: 'hidden' },
  title: { fontFamily: Fonts.bold, fontSize: 16, color: c.text, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.four, paddingVertical: 14, borderRadius: Radius.md },
  label: { flex: 1, fontFamily: Fonts.semibold, fontSize: 16, color: c.text },
  value: { fontFamily: Fonts.medium, fontSize: 14, color: c.textSecondary },
});
