import Constants from "expo-constants";
import { Platform } from "react-native";

import { getSupabaseClient } from "../api/supabaseClient";

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_CONTEXT = 500;

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error("Unknown error");
  }
}

/**
 * アプリ側で捕捉した想定外エラーを client_error_log へ記録する。
 * 記録は fire-and-forget（await 不要）で、失敗してもアプリ動作には一切影響させない。
 * 未認証時は RLS で INSERT が拒否されるため、そのケースは黙って握りつぶす
 * （ログイン画面より手前のエラーは記録されないが、そこは表面積が小さい）。
 */
export async function logClientError(value: unknown, context?: string): Promise<void> {
  try {
    const error = toError(value);
    await getSupabaseClient()
      .from("client_error_log")
      .insert({
        message: error.message.slice(0, MAX_MESSAGE),
        stack: error.stack ? error.stack.slice(0, MAX_STACK) : null,
        context: context ? context.slice(0, MAX_CONTEXT) : null,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? null,
      });
  } catch {
    // ログ記録自体の失敗は無視する（ここで投げると二次被害になる）
  }
}
