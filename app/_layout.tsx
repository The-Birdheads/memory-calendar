import { Stack } from "expo-router";

import { useRegisterPushToken } from "../src/features/notifications/hooks";

export default function RootLayout() {
  useRegisterPushToken();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
