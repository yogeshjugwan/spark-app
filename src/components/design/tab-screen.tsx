import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/design/app-background';
import { TAB_BAR_HEIGHT } from '@/components/design/glass-tab-bar';

/** Glass background + top safe area, with space kept clear for the floating tab bar. */
export function TabScreen({ children }: { children: ReactNode }) {
  return (
    <AppBackground>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={[styles.flex, { paddingBottom: TAB_BAR_HEIGHT }]}>{children}</View>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
