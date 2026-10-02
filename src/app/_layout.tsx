import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { WebFrame } from '@/components/ui/web-frame';
import { useAuth } from '@/lib/auth-store';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Screens draw their own glass background, so navigation containers stay transparent.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    primary: Colors.light.primary,
  },
};

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const onboarding = useAuth((s) => s.onboarding);
  const hydrate = useAuth((s) => s.hydrate);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError; // fall back to system fonts rather than hang

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ready = status !== 'loading' && fontsReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Keep the splash screen up until fonts load and we know whether someone is logged in.
  if (!ready) return null;

  const signedIn = status === 'signedIn';

  return (
    // Gesture root: swipe-to-reply and other gesture-handler gestures need it at the top.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <StatusBar style="dark" />
          <WebFrame>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={signedIn && !onboarding}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && onboarding}>
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
          </WebFrame>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
