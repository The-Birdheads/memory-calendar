import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { AuthCredentials, AuthError } from "./types";

export type { AuthCredentials, AuthError } from "./types";

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
    case "Unknown":
    default:
      return "エラーが発生しました。しばらくしてから再度お試しください";
  }
}
