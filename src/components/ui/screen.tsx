import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { KeyboardAvoider } from '@/components/ui/keyboard-avoider';

// Room for the transparent navigation header (back button) above the content.
const HEADER_SPACE = 48;

/** Glass-background page that scrolls and keeps inputs above the keyboard. */
export function Screen({ children, footer, header = true }: { children: ReactNode; footer?: ReactNode; header?: boolean }) {
  return (
    <AppBackground>
      <SafeAreaView style={[styles.flex, header && { paddingTop: HEADER_SPACE }]} edges={['top', 'bottom']}>
        {/* Android is edge-to-edge (Expo 57), so the window doesn't resize for the keyboard: pad on both platforms. */}
        <KeyboardAvoider style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">
            <View style={styles.content}>{children}</View>
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </KeyboardAvoider>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
});
