import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export const unstable_settings = { initialRouteName: 'start' };

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        title: '',
        headerTransparent: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: Colors.light.text,
      }}>
      <Stack.Screen name="start" options={{ headerShown: false }} />
      {/* First step: no back button (there's nowhere to go back to). */}
      <Stack.Screen name="basics" options={{ headerBackVisible: false }} />
      <Stack.Screen name="interested" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="about" />
      <Stack.Screen name="voice" />
    </Stack>
  );
}
