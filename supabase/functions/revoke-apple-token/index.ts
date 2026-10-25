// RevokeAppleToken: 「Appleでサインイン」したユーザーがアカウントを削除する際に、Apple側の
// トークンを失効させるEdge Function(App Storeガイドライン5.1.1(v)対応)。
// アプリが削除直前にAppleの確認画面で取得した認可コードを受け取り、Appleのトークンに交換して失効させる。
// 呼び出しにはログイン中ユーザーのJWTが必要(verify_jwt=true)。さらに本人がAppleでサインインした
// ユーザー(identitiesにappleを持つ)であることも確認する。
//
// 必要なシークレット(`supabase secrets set ...`):
//   APPLE_TEAM_ID      Apple Developer の Team ID
//   APPLE_KEY_ID       「Sign in with Apple」を有効にした Key の Key ID
//   APPLE_PRIVATE_KEY  その Key の秘密鍵(.p8 の中身)
//   APPLE_CLIENT_ID    (任意)clientId を指定しないリクエストに使うバンドルID。未設定なら
//                      com.thebirdseed.memorycalendar
//
// リクエストボディ: { authorizationCode: string, clientId?: string }
//   clientId は、認可コードを取得したアプリのバンドルID(Appleの失効はアプリ単位)。
//   Habitas(com.morikuma.habitas)からも呼ばれるため指定できる。許可リストにあるものだけ受け付ける。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveAppleClientId, revokeAppleAuthorization } from "../_shared/appleAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DEFAULT_CLIENT_ID = "com.thebirdseed.memorycalendar";

// Habitas(Capacitor の WebView)からも呼ばれる。WebView の fetch は CORS の対象で、
// 事前確認(OPTIONS)に応答しないとリクエストが送られない(React Native の Memory Calendar は対象外)。
// 認証は Authorization ヘッダーの JWT で行うため、Origin は制限しない。
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ revoked: false, reason: "method not allowed" }, 405);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ revoked: false, reason: "unauthorized" }, 401);
  }
  if (!user.identities?.some((identity) => identity.provider === "apple")) {
    return json({ revoked: false, reason: "not an apple user" }, 400);
  }

  const { authorizationCode, clientId: requestedClientId } = (await req.json().catch(() => ({}))) as {
    authorizationCode?: string;
    clientId?: string;
  };
  if (!authorizationCode) {
    return json({ revoked: false, reason: "authorizationCode is required" }, 400);
  }
  const clientId = resolveAppleClientId(requestedClientId, Deno.env.get("APPLE_CLIENT_ID") ?? DEFAULT_CLIENT_ID);
  if (!clientId) {
    return json({ revoked: false, reason: "unsupported clientId" }, 400);
  }

  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) {
    return json({ revoked: false, reason: "apple credentials are not configured" }, 500);
  }

  const result = await revokeAppleAuthorization(
    { teamId, keyId, privateKey, clientId },
    authorizationCode
  );
  if (!result.ok) {
    console.error("[revoke-apple-token] failed:", result.reason);
    return json({ revoked: false, reason: result.reason }, 502);
  }

  return json({ revoked: true }, 200);
});
