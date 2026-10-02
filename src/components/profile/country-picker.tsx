import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { COUNTRIES, countryName, flagEmoji } from '@/lib/countries';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;

/** Nationality field + searchable full-screen list. Shown as a flag on cards. */
export function CountryPicker({ value, onChange }: { value: string | null; onChange: (code: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRIES.filter(([code, name]) => name.toLowerCase().includes(q) || code.toLowerCase() === q) : COUNTRIES;
  }, [query]);

  const shown = value ? `${flagEmoji(value)}  ${countryName(value)}` : 'Select your nationality';

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Nationality (optional)</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Nationality: ${shown}`} style={styles.field}>
        {!value && <Ionicons name="flag-outline" size={19} color={c.textSecondary} />}
        <Text style={[styles.value, !value && { color: c.textSecondary }]}>{shown}</Text>
        <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
      </Pressable>

      <AppModal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <AppBackground>
          <SafeAreaView style={styles.flex}>
            <View style={styles.header}>
              <Text style={styles.title}>Nationality</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={26} color={c.text} />
              </Pressable>
            </View>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={c.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search countries"
                placeholderTextColor={c.textSecondary}
                style={styles.searchInput}
                autoCorrect={false}
                accessibilityLabel="Search countries"
              />
            </View>
            <FlatList
              data={list}
              keyExtractor={([code]) => code}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listPad}
              ListHeaderComponent={
                value ? (
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      onChange(null);
                      setOpen(false);
                    }}>
                    <Text style={[styles.rowText, { color: c.danger }]}>Clear nationality</Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item: [code, name] }) => (
                <Pressable
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityState={{ selected: value === code }}
                  onPress={() => {
                    onChange(code);
                    setQuery('');
                    setOpen(false);
                  }}>
                  <Text style={styles.flag}>{flagEmoji(code)}</Text>
                  <Text style={styles.rowText}>{name}</Text>
                  {value === code && <Ionicons name="checkmark" size={20} color={c.primary} />}
                </Pressable>
              )}
            />
          </SafeAreaView>
        </AppBackground>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 6 },
  label: { fontFamily: Fonts.semibold, fontSize: 14, color: c.text, marginLeft: 4 },
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  value: { flex: 1, fontFamily: Fonts.medium, fontSize: 16, color: c.text },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three },
  title: { fontFamily: Fonts.bold, fontSize: 22, color: c.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingHorizontal: 16,
    height: 46,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: c.text },
  listPad: { padding: Spacing.three, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12, paddingHorizontal: 6 },
  flag: { fontSize: 24 },
  rowText: { flex: 1, fontFamily: Fonts.semibold, fontSize: 16, color: c.text },
});
