import type { Session, SupabaseClient } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { err, ok, type Result } from "../../shared/types/result";
import { updateDisplayName } from "../profile/service";
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
  const { email, password, displayName } = credentials;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    ...(displayName ? { options: { data: { display_name: displayName } } } : {}),
  });
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

/** Apple が初回だけ返す氏名から表示名を作る。日本語の名前は「姓 名」、それ以外は「名 姓」。 */
function formatAppleFullName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  const given = fullName?.givenName?.trim() ?? "";
  const family = fullName?.familyName?.trim() ?? "";
  if (!given && !family) return null;
  const isJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(`${given}${family}`);
  return (isJapanese ? [family, given] : [given, family]).filter(Boolean).join(" ");
}

/**
 * ネイティブの「Appleでサインイン」。Appleにはnonceのハッシュ、SupabaseにはAppleが
 * 返したIDトークンと元のnonceを渡す(リプレイ攻撃対策)。氏名はAppleが初回しか
 * 返さないので、受け取れた時にプロフィールの表示名として保存する(失敗しても
 * ログイン自体は成功扱い)。
 */
export async function signInWithApple(client: SupabaseClient): Promise<Result<Session, AuthError>> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    const { code, message } = (e ?? {}) as { code?: string; message?: string };
    if (code === "ERR_REQUEST_CANCELED") {
      return err({ type: "Cancelled" });
    }
    return err({ type: "Unknown", message: message ?? "apple sign-in failed" });
  }

  if (!credential.identityToken) {
    return err({ type: "Unknown", message: "no identity token returned from apple sign-in" });
  }

  const { data, error } = await client.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error || !data.session) {
    return err(mapAuthError(error?.message ?? "no session returned"));
  }

  const displayName = formatAppleFullName(credential.fullName);
  if (displayName) {
    await updateDisplayName(client, data.session.user.id, displayName);
  }

  return ok(data.session);
}

export type AppleRevocationOutcome = "not-apple" | "revoked" | "failed" | "cancelled";

/**
 * アカウント削除の直前に呼ぶ。Appleでサインインしたユーザーの場合だけ、Appleの確認画面で
 * 本人確認(=新しい認可コードの取得)をしてから、Edge Function経由でAppleのトークンを失効させる
 * (App Storeガイドライン5.1.1(v))。
 * - "cancelled": 確認画面を閉じた(削除を中止すべき)
 * - "failed": 失効に失敗(削除自体は続行してよい)
 * - "not-apple": Appleのユーザーではないので何もしていない
 */
export async function revokeAppleAuthorizationIfNeeded(client: SupabaseClient): Promise<AppleRevocationOutcome> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    return "failed";
  }
  if (!user.identities?.some((identity) => identity.provider === "apple")) {
    return "not-apple";
  }

  let authorizationCode: string | null;
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    authorizationCode = credential.authorizationCode;
  } catch (e) {
    return (e as { code?: string })?.code === "ERR_REQUEST_CANCELED" ? "cancelled" : "failed";
  }
  if (!authorizationCode) {
    return "failed";
  }

  const { error } = await client.functions.invoke("revoke-apple-token", { body: { authorizationCode } });
  return error ? "failed" : "revoked";
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
