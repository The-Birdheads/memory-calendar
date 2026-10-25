// Sign in with Apple のトークン失効(アカウント削除時にAppleへ連携解除を通知する)用の共通処理。
// Appleのガイドライン5.1.1(v)により、Appleでサインインしたユーザーがアカウントを削除する際は、
// Apple側のトークンも失効させる必要がある。
// Deno固有のAPIは使わず(WebCrypto/fetchのみ)、jestからも検証できるようにしている。

const APPLE_AUDIENCE = "https://appleid.apple.com";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const CLIENT_SECRET_TTL_SECONDS = 300;

export interface AppleCredentials {
  /** Apple Developer の Team ID。 */
  teamId: string;
  /** 「Sign in with Apple」を有効にした Key の Key ID。 */
  keyId: string;
  /** ネイティブアプリの場合はバンドルID。 */
  clientId: string;
  /** その Key の秘密鍵(.p8 の中身、PEM形式)。 */
  privateKey: string;
}

/**
 * 失効を依頼できるアプリ(Sign in with Apple の client_id = バンドルID)。
 * Habitas と Memory Calendar は同じ Supabase アカウントを共有しており、どちらのアプリからも
 * アカウント削除時にこの関数を呼ぶ。任意のIDを受け付けないよう、許可リストで検証する。
 */
export const ALLOWED_APPLE_CLIENT_IDS = ["com.thebirdseed.memorycalendar", "com.morikuma.habitas"] as const;

/**
 * リクエストで指定された client_id を検証して返す。未指定なら fallback(環境変数、無ければ既定)を使う。
 * 許可リストにも fallback にも無ければ null。
 */
export function resolveAppleClientId(requested: string | undefined | null, fallback: string): string | null {
  const clientId = requested || fallback;
  const allowed: readonly string[] = [...ALLOWED_APPLE_CLIENT_IDS, fallback];
  return allowed.includes(clientId) ? clientId : null;
}

export type AppleRevokeResult = { ok: true } | { ok: false; reason: string };

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function pemToPkcs8(pem: string): ArrayBuffer {
  // シークレットとして1行で保存された場合の「\n」(バックスラッシュ+n)も許容する。
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** AppleのAPIに渡す client_secret(ES256で署名したJWT、有効5分)を作る。 */
export async function createAppleClientSecret(
  credentials: AppleCredentials,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const header = { alg: "ES256", kid: credentials.keyId, typ: "JWT" };
  const payload = {
    iss: credentials.teamId,
    iat: nowSeconds,
    exp: nowSeconds + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: credentials.clientId,
  };
  const signingInput = `${base64UrlEncode(utf8(JSON.stringify(header)))}.${base64UrlEncode(utf8(JSON.stringify(payload)))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(credentials.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  // WebCryptoのECDSA署名は、JWSが求める生の r||s 形式で返る。
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(signingInput));

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/**
 * ネイティブのサインインで得た認可コードをAppleのトークンに交換し、そのトークンを失効させる。
 * 失敗は例外ではなく結果で返す(呼び出し側がアカウント削除自体は続行できるように)。
 */
export async function revokeAppleAuthorization(
  credentials: AppleCredentials,
  authorizationCode: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  nowSeconds?: number
): Promise<AppleRevokeResult> {
  try {
    const clientSecret = await createAppleClientSecret(credentials, nowSeconds);
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    const tokenResponse = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers,
      body: formBody({
        client_id: credentials.clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) {
      return { ok: false, reason: `token exchange failed (${tokenResponse.status})` };
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) {
      return { ok: false, reason: "no token returned from apple" };
    }

    const revokeResponse = await fetchImpl(REVOKE_URL, {
      method: "POST",
      headers,
      body: formBody({
        client_id: credentials.clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
      }),
    });
    if (!revokeResponse.ok) {
      return { ok: false, reason: `revoke failed (${revokeResponse.status})` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "unexpected error" };
  }
}
