import type { ReactNode } from 'react';
import { Modal, Platform, StyleSheet, useWindowDimensions, View, type ModalProps } from 'react-native';

/** Widest the app gets on web (tablet / desktop): a centred phone column, like a mobile web app. */
export const FRAME_MAX = 480;
const isWeb = Platform.OS === 'web';

/** Usable width/height: the window on phones, the centred column on wide web screens. */
export function useFrameSize() {
  const { width, height } = useWindowDimensions();
  return { width: isWeb ? Math.min(width, FRAME_MAX) : width, height };
}

/** Centres the whole app in a phone-width column on wide web screens (no-op on phones). */
export function WebFrame({ children }: { children: ReactNode }) {
  if (!isWeb) return <>{children}</>;
  return (
    <View style={styles.page}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

/** Modal that stays inside the app column on web instead of stretching across a desktop screen. */
export function AppModal({ children, ...props }: ModalProps) {
  if (!isWeb) return <Modal {...props}>{children}</Modal>;
  return (
    <Modal {...props}>
      <View style={[styles.modalPage, props.transparent && styles.modalDim]}>
        <View style={styles.column}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: '#E9DDEA' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: FRAME_MAX,
    overflow: 'hidden',
    // Soft card edge on desktop so the column reads as "the app".
    boxShadow: '0 0 40px rgba(120, 40, 100, 0.18)',
  },
  modalPage: { flex: 1, alignItems: 'center' },
  modalDim: { backgroundColor: 'rgba(30,10,25,0.25)' },
});
