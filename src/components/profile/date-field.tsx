import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { AppModal } from '@/components/ui/web-frame';

const c = Colors.light;

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Birthday field: a pill that opens the native date picker. Value is YYYY-MM-DD. */
export function DateField({
  label,
  value,
  onChange,
  error,
  maxDate,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string) => void;
  error?: string;
  maxDate: Date;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? fromIso(value) : new Date(maxDate.getFullYear() - 7, 0, 1));

  const shown = value
    ? fromIso(value).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Select your birthday';

  // Android shows its own dialog; iOS shows a spinner in a bottom sheet.
  const onAndroidPick = (_: unknown, d: Date) => {
    setOpen(false);
    setDraft(d);
    onChange(toIso(d));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        style={[styles.field, { borderColor: error ? c.danger : c.borderStrong }]}>
        <Ionicons name="calendar-outline" size={19} color={c.textSecondary} />
        <Text style={[styles.value, !value && { color: c.textSecondary }]}>{shown}</Text>
        <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft}
          mode="date"
          maximumDate={maxDate}
          minimumDate={new Date(1920, 0, 1)}
          onValueChange={onAndroidPick}
          onDismiss={() => setOpen(false)}
        />
      )}

      {Platform.OS === 'ios' && (
        <AppModal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              maximumDate={maxDate}
              minimumDate={new Date(1920, 0, 1)}
              onValueChange={(_, d) => setDraft(d)}
              textColor={c.text}
            />
            <Button
              title="Done"
              onPress={() => {
                onChange(toIso(draft));
                setOpen(false);
              }}
            />
          </View>
        </AppModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: Fonts.semibold, fontSize: 14, color: c.text, marginLeft: 4 },
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  value: { flex: 1, fontFamily: Fonts.medium, fontSize: 16, color: c.text },
  error: { fontFamily: Fonts.medium, fontSize: 13, color: c.danger, marginLeft: 4 },
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { backgroundColor: '#fff', padding: Spacing.three, paddingBottom: Spacing.five, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
