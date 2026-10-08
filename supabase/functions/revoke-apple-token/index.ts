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
//   APPLE_CLIENT_ID    (任意)アプリのバンドルID。未設定なら com.thebirdseed.memorycalendar

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { revokeAppleAuthorization } from "../_shared/appleAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DEFAULT_CLIENT_ID = "com.thebirdseed.memorycalendar";

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
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

  const { authorizationCode } = (await req.json().catch(() => ({}))) as { authorizationCode?: string };
  if (!authorizationCode) {
    return json({ revoked: false, reason: "authorizationCode is required" }, 400);
  }

  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) {
    return json({ revoked: false, reason: "apple credentials are not configured" }, 500);
  }

  const result = await revokeAppleAuthorization(
    { teamId, keyId, privateKey, clientId: Deno.env.get("APPLE_CLIENT_ID") ?? DEFAULT_CLIENT_ID },
    authorizationCode
  );
  if (!result.ok) {
    console.error("[revoke-apple-token] failed:", result.reason);
    return json({ revoked: false, reason: result.reason }, 502);
  }

  return json({ revoked: true }, 200);
});
