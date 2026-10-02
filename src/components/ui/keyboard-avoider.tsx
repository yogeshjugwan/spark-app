import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View, type ViewProps } from 'react-native';

/**
 * Keeps content (the message box) above the keyboard.
 *
 * React Native's KeyboardAvoidingView measures itself once and trusts the keyboard *height*.
 * With Android edge-to-edge (Expo 57) that height leaves out the navigation bar, and when
 * something above the view appears or disappears (call banner, pinned message) its cached
 * position goes stale — both left the input behind the keyboard. Instead we measure where this
 * view's bottom really is when the keyboard opens and pad by exactly how far the keyboard's top
 * edge overlaps it. (Padding sits inside the view, so it doesn't change the measured bottom.)
 */
export function KeyboardAvoider({ style, children, ...rest }: ViewProps) {
  const ref = useRef<View>(null);
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    let open = false;
    const fit = (keyboardTop: number) =>
      ref.current?.measureInWindow((_x, y, _w, h) => {
        if (open) setPad(Math.max(0, Math.round(y + h - keyboardTop)));
      });
    const show = Keyboard.addListener(showEvt, (e) => {
      open = true;
      fit(e.endCoordinates.screenY);
    });
    // Keyboard height changes (emoji panel, suggestion strip) while open.
    const change = Keyboard.addListener('keyboardDidChangeFrame', (e) => {
      if (open) fit(e.endCoordinates.screenY);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      open = false;
      setPad(0);
    });
    return () => {
      show.remove();
      change.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} style={[style, { paddingBottom: pad }]} {...rest}>
      {children}
    </View>
  );
}
