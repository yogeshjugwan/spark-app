import { Stack } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        title: '',
        headerTransparent: true, // let the glass background run under the header
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: Colors.light.text,
        headerTitleStyle: { fontFamily: Fonts.bold },
      }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="guest" options={{ headerShown: false }} />
    </Stack>
  );
}
