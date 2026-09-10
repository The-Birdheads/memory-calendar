import { logClientError } from "./errorLog";

/** React Native がグローバルに用意しているエラーハンドラの型。 */
interface ErrorUtilsLike {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
}

function getErrorUtils(): ErrorUtilsLike | undefined {
  return (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
}

let installed = false;

/**
 * Reactのレンダリング外で発生した未捕捉のJSエラー（イベントハンドラ内の非同期例外など、
 * expo-routerのErrorBoundaryが拾えないもの）を client_error_log に記録してから、
 * RN標準のハンドラ（本番ではネイティブのエラー処理、開発ではレッドボックス）に委譲する。
 * アプリ起動時に1度だけ呼ぶ。
 */
export function installGlobalErrorHandler(): void {
  if (installed) return;
  const errorUtils = getErrorUtils();
  if (!errorUtils) return;

  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void logClientError(error, isFatal ? "global:fatal" : "global");
    previous(error, isFatal);
  });
  installed = true;
}
