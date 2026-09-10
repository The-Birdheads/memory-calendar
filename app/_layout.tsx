import { Stack } from "expo-router";

import { AppErrorBoundary } from "../src/shared/components/AppErrorBoundary";
import { installGlobalErrorHandler } from "../src/shared/errors/globalHandler";
import { useRegisterPushToken } from "../src/features/notifications/hooks";

// レンダリング外の未捕捉JSエラーもモジュール読み込み時に拾えるよう、早めに仕込む。
installGlobalErrorHandler();

// expo-router がレイアウト配下の想定外エラーのフォールバックとして使う。
export function ErrorBoundary(props: React.ComponentProps<typeof AppErrorBoundary>) {
  return <AppErrorBoundary {...props} />;
}

export default function RootLayout() {
  useRegisterPushToken();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" options={{ headerBackTitle: "" }} />
    </Stack>
  );
}
