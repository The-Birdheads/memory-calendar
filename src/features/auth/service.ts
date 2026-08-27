import type { Session, SupabaseClient } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { err, ok, type Result } from "../../shared/types/result";
import type { AuthCredentials, AuthError } from "./types";

export type { AuthCredentials, AuthError } from "./types";

// Web上でOAuthのリダイレクト元タブを閉じてPromiseを解決させるために必要(ネイティブでは無害なno-op)。
WebBrowser.maybeCompleteAuthSession();

function mapAuthError(message: string): AuthError {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return { type: "InvalidCredentials" };
  }
  if (normalized.includes("already registered")) {
    return { type: "EmailAlreadyInUse" };
  }
  return { type: "Unknown", message };
}

export async function signUp(
  client: SupabaseClient,
  credentials: AuthCredentials
): Promise<Result<Session | null, AuthError>> {
  const { data, error } = await client.auth.signUp(credentials);
  if (error) {
    return err(mapAuthError(error.message));
  }
  return ok(data.session);
}

export async function signIn(
  client: SupabaseClient,
  credentials: AuthCredentials
): Promise<Result<Session, AuthError>> {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.session) {
    return err(mapAuthError(error?.message ?? "no session returned"));
  }
  return ok(data.session);
}

function parseAuthTokensFromUrl(url: string): { accessToken: string | null; refreshToken: string | null } {
  const parsed = new URL(url);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const accessToken = parsed.searchParams.get("access_token") ?? hashParams.get("access_token");
  const refreshToken = parsed.searchParams.get("refresh_token") ?? hashParams.get("refresh_token");
  return { accessToken, refreshToken };
}

export async function signInWithGoogle(client: SupabaseClient): Promise<Result<Session, AuthError>> {
  const redirectTo = Linking.createURL("auth-callback");

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return err(mapAuthError(error?.message ?? "failed to start google sign-in"));
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success" || !result.url) {
    return err({ type: "Cancelled" });
  }

  const { accessToken, refreshToken } = parseAuthTokensFromUrl(result.url);
  if (!accessToken || !refreshToken) {
    return err({ type: "Unknown", message: "no tokens returned from google sign-in" });
  }

  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.session) {
    return err(mapAuthError(sessionError?.message ?? "failed to set session"));
  }

  return ok(sessionData.session);
}

export async function signOut(client: SupabaseClient): Promise<Result<void, AuthError>> {
  const { error } = await client.auth.signOut();
  if (error) {
    return err(mapAuthError(error.message));
  }
  return ok(undefined);
}

export function getAuthErrorMessageJa(error: AuthError): string {
  switch (error.type) {
    case "InvalidCredentials":
      return "メールアドレスまたはパスワードが正しくありません";
    case "EmailAlreadyInUse":
      return "このメールアドレスは既に登録されています";
    case "Cancelled":
      return "ログインがキャンセルされました";
    case "Unknown":
    default:
      return "エラーが発生しました。しばらくしてから再度お試しください";
  }
}
