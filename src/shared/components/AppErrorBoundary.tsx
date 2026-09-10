import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { logClientError } from "../errors/errorLog";

export interface AppErrorBoundaryProps {
  /** 投げられたエラー。 */
  error: Error;
  /** ルートコンポーネントを再レンダリングして復帰を試みる。 */
  retry: () => Promise<void>;
}

/**
 * expo-router の `ErrorBoundary` として使う画面全体のフォールバック。
 * レンダリング中の想定外エラーで白画面/レッドボックスにせず、日本語の案内と
 * 「再読み込み」ボタンを出す。表示時にエラーを client_error_log へ記録する。
 * `app/_layout.tsx` から `ErrorBoundary` としてエクスポートする。
 */
export function AppErrorBoundary({ error, retry }: AppErrorBoundaryProps) {
  useEffect(() => {
    void logClientError(error, "render");
  }, [error]);

  return (
    <View style={styles.container} testID="app-error-boundary">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>問題が発生しました</Text>
        <Text style={styles.body}>
          予期しないエラーが発生しました。お手数ですが、再読み込みをお試しください。繰り返し発生する場合は時間をおいて再度お試しください。
        </Text>
        <TouchableOpacity
          testID="app-error-boundary-retry"
          style={styles.button}
          onPress={() => {
            void retry();
          }}
        >
          <Text style={styles.buttonText}>再読み込み</Text>
        </TouchableOpacity>
        {__DEV__ ? (
          <Text style={styles.devDetail} testID="app-error-boundary-detail">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: "#444",
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#2f6fed",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  devDetail: {
    marginTop: 16,
    fontSize: 11,
    color: "#999",
    fontFamily: "Courier",
  },
});
