/**
 * @jest-environment node
 */
import { generateKeyPairSync, verify } from "node:crypto";

import { createAppleClientSecret, resolveAppleClientId, revokeAppleAuthorization } from "../appleAuth";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const CREDENTIALS = {
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  clientId: "com.thebirdseed.memorycalendar",
  privateKey: PRIVATE_KEY_PEM,
};

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

describe("createAppleClientSecret", () => {
  it("builds an ES256 JWT with Apple's required header and claims", async () => {
    const jwt = await createAppleClientSecret(CREDENTIALS, 1_800_000_000);

    const [header, payload] = jwt.split(".");
    expect(decodeSegment(header)).toEqual({ alg: "ES256", kid: "KEY1234567", typ: "JWT" });
    expect(decodeSegment(payload)).toEqual({
      iss: "TEAM123456",
      iat: 1_800_000_000,
      exp: 1_800_000_300,
      aud: "https://appleid.apple.com",
      sub: "com.thebirdseed.memorycalendar",
    });
  });

  it("signs it so the matching public key verifies the signature (raw r||s, as JWS requires)", async () => {
    const jwt = await createAppleClientSecret(CREDENTIALS, 1_800_000_000);

    const [header, payload, signature] = jwt.split(".");
    const valid = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url")
    );
    expect(valid).toBe(true);
  });

  it("accepts a PEM whose newlines were stored as literal \\n (how multi-line secrets are often saved)", async () => {
    const escaped = PRIVATE_KEY_PEM.replace(/\n/g, "\\n");

    const jwt = await createAppleClientSecret({ ...CREDENTIALS, privateKey: escaped }, 1_800_000_000);

    expect(jwt.split(".")).toHaveLength(3);
  });
});

describe("revokeAppleAuthorization", () => {
  function jsonResponse(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
  }

  it("exchanges the authorization code for tokens, then revokes the refresh token", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "at", refresh_token: "rt" }))
      .mockResolvedValueOnce(jsonResponse({}));

    const result = await revokeAppleAuthorization(CREDENTIALS, "auth-code-1", fetchImpl, 1_800_000_000);

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0];
    expect(tokenUrl).toBe("https://appleid.apple.com/auth/token");
    const tokenBody = new URLSearchParams(tokenInit.body);
    expect(tokenBody.get("grant_type")).toBe("authorization_code");
    expect(tokenBody.get("code")).toBe("auth-code-1");
    expect(tokenBody.get("client_id")).toBe("com.thebirdseed.memorycalendar");
    expect(tokenBody.get("client_secret")?.split(".")).toHaveLength(3);
    expect(tokenInit.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const [revokeUrl, revokeInit] = fetchImpl.mock.calls[1];
    expect(revokeUrl).toBe("https://appleid.apple.com/auth/revoke");
    const revokeBody = new URLSearchParams(revokeInit.body);
    expect(revokeBody.get("token")).toBe("rt");
    expect(revokeBody.get("token_type_hint")).toBe("refresh_token");
    expect(revokeBody.get("client_id")).toBe("com.thebirdseed.memorycalendar");
  });

  it("falls back to revoking the access token when no refresh token is returned", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "at" }))
      .mockResolvedValueOnce(jsonResponse({}));

    const result = await revokeAppleAuthorization(CREDENTIALS, "auth-code-1", fetchImpl, 1_800_000_000);

    expect(result).toEqual({ ok: true });
    const revokeBody = new URLSearchParams(fetchImpl.mock.calls[1][1].body);
    expect(revokeBody.get("token")).toBe("at");
    expect(revokeBody.get("token_type_hint")).toBe("access_token");
  });

  it("fails without calling revoke when the code exchange is rejected (e.g. a used/expired code)", async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(jsonResponse({ error: "invalid_grant" }, 400));

    const result = await revokeAppleAuthorization(CREDENTIALS, "bad-code", fetchImpl, 1_800_000_000);

    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails when Apple rejects the revoke call", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "at", refresh_token: "rt" }))
      .mockResolvedValueOnce(jsonResponse({ error: "invalid_client" }, 400));

    const result = await revokeAppleAuthorization(CREDENTIALS, "auth-code-1", fetchImpl, 1_800_000_000);

    expect(result.ok).toBe(false);
  });

  it("fails (rather than throwing) when the network call itself throws", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));

    const result = await revokeAppleAuthorization(CREDENTIALS, "auth-code-1", fetchImpl, 1_800_000_000);

    expect(result.ok).toBe(false);
  });
});

describe("resolveAppleClientId", () => {
  const FALLBACK = "com.thebirdseed.memorycalendar";

  it("uses the fallback when no clientId is requested", () => {
    expect(resolveAppleClientId(undefined, FALLBACK)).toBe(FALLBACK);
    expect(resolveAppleClientId(null, FALLBACK)).toBe(FALLBACK);
    expect(resolveAppleClientId("", FALLBACK)).toBe(FALLBACK);
  });

  it("accepts each app that shares the account (Memory Calendar and Habitas)", () => {
    expect(resolveAppleClientId("com.thebirdseed.memorycalendar", FALLBACK)).toBe("com.thebirdseed.memorycalendar");
    expect(resolveAppleClientId("com.morikuma.habitas", FALLBACK)).toBe("com.morikuma.habitas");
  });

  it("accepts the configured fallback (e.g. an APPLE_CLIENT_ID override)", () => {
    expect(resolveAppleClientId("com.example.override", "com.example.override")).toBe("com.example.override");
  });

  it("rejects any other client id", () => {
    expect(resolveAppleClientId("com.evil.app", FALLBACK)).toBeNull();
  });
});
