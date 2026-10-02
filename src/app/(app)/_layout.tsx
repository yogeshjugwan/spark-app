import { router, Stack } from 'expo-router';

import { MediaViewer } from '@/components/chat/media-viewer';
import { ActionMenuHost } from '@/components/ui/action-menu';

import { configurePaywall } from '@/lib/api';
import { usePush } from '@/lib/push';
import { useChatSocket } from '@/lib/use-chat-socket';

// Any "Spark+ required" answer from the API opens the upgrade screen for that feature.
configurePaywall((feature) => router.push({ pathname: '/premium', params: { feature } }));

export default function AppLayout() {
  useChatSocket();
  usePush();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="chat/[matchId]" />
        <Stack.Screen name="announcements" />
        <Stack.Screen name="call" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="group/[groupId]" />
        <Stack.Screen name="group-info/[groupId]" />
        <Stack.Screen name="new-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
        {/* Full-screen celebration over whatever screen you liked from. */}
        <Stack.Screen name="match" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="group-call" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="starred" />
        <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
        <Stack.Screen name="likes" />
        <Stack.Screen name="media/[kind]/[id]" />
        <Stack.Screen name="stories/[userId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="new-story" options={{ presentation: 'modal' }} />
        <Stack.Screen name="join/[code]" options={{ presentation: 'modal' }} />
      </Stack>
      <MediaViewer />
      <ActionMenuHost />
    </>
  );
}
