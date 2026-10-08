import type { SupabaseClient } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";

import { updateDisplayName } from "../../profile/service";
import {
  getAuthErrorMessageJa,
  revokeAppleAuthorizationIfNeeded,
  signIn,
  signInWithApple,
  signInWithGoogle,
  signOut,
  signUp,
} from "../service";

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "raw-nonce"),
  digestStringAsync: jest.fn(async () => "hashed-nonce"),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

jest.mock("../../profile/service", () => ({
  updateDisplayName: jest.fn(),
}));

jest.mock("expo-linking", () => ({
  createURL: jest.fn(() => "memorycalendar://auth-callback"),
}));

function createMockClient(authOverrides: Record<string, jest.Mock> = {}): SupabaseClient {
  return {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signInWithOAuth: jest.fn(),
      signInWithIdToken: jest.fn(),
      setSession: jest.fn(),
      ...authOverrides,
    },
  } as unknown as SupabaseClient;
}

describe("signUp", () => {
  it("returns the created session on success", async () => {
    const session = { user: { id: "u1" } };
    const client = createMockClient({
      signUp: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    });

    const result = await signUp(client, { email: "a@example.com", password: "password123" });

    expect(result).toEqual({ ok: true, value: session });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "password123",
    });
  });

  it("maps an already-registered error", async () => {
    const client = createMockClient({
      signUp: jest.fn().mockResolvedValue({
        data: { session: null },
        error: { message: "User already registered" },
      }),
    });

    const result = await signUp(client, { email: "a@example.com", password: "password123" });

    expect(result).toEqual({ ok: false, error: { type: "EmailAlreadyInUse" } });
  });

  it("passes the display name through as signup metadata when provided", async () => {
    const session = { user: { id: "u1" } };
    const client = createMockClient({
      signUp: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    });

    await signUp(client, { email: "a@example.com", password: "password123", displayName: "たろう" });

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "password123",
      options: { data: { display_name: "たろう" } },
    });
  });
});

describe("signIn", () => {
  it("returns the session on success", async () => {
    const session = { user: { id: "u1" } };
    const client = createMockClient({
      signInWithPassword: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    });

    const result = await signIn(client, { email: "a@example.com", password: "password123" });

    expect(result).toEqual({ ok: true, value: session });
  });

  it("maps an invalid credentials error", async () => {
    const client = createMockClient({
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid login credentials" },
      }),
    });

    const result = await signIn(client, { email: "a@example.com", password: "wrong" });

    expect(result).toEqual({ ok: false, error: { type: "InvalidCredentials" } });
  });
});

describe("signOut", () => {
  it("succeeds when Supabase returns no error", async () => {
    const client = createMockClient({ signOut: jest.fn().mockResolvedValue({ error: null }) });

    const result = await signOut(client);

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns an Unknown error when Supabase sign-out fails", async () => {
    const client = createMockClient({
      signOut: jest.fn().mockResolvedValue({ error: { message: "network down" } }),
    });

    const result = await signOut(client);

    expect(result).toEqual({ ok: false, error: { type: "Unknown", message: "network down" } });
  });
});

describe("signInWithApple", () => {
  const SESSION = { user: { id: "u1" } };

  beforeEach(() => {
    (updateDisplayName as jest.Mock).mockResolvedValue({ ok: true, value: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function appleReturns(credential: Record<string, unknown>) {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: "apple-id-token",
      fullName: null,
      ...credential,
    });
  }

  it("asks Apple for name+email with a hashed nonce, then signs in to Supabase with the identity token and the raw nonce", async () => {
    appleReturns({});
    const client = createMockClient({
      signInWithIdToken: jest.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
    });

    const result = await signInWithApple(client);

    expect(result).toEqual({ ok: true, value: SESSION });
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: "hashed-nonce",
    });
    expect(client.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "raw-nonce",
    });
  });

  it("returns Cancelled when the user dismisses the Apple sheet", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });
    const client = createMockClient();

    const result = await signInWithApple(client);

    expect(result).toEqual({ ok: false, error: { type: "Cancelled" } });
    expect(client.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("returns Unknown when Apple fails for another reason", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: "ERR_REQUEST_FAILED", message: "boom" });

    const result = await signInWithApple(createMockClient());

    expect(result).toEqual({ ok: false, error: { type: "Unknown", message: "boom" } });
  });

  it("returns Unknown when Apple returns no identity token", async () => {
    appleReturns({ identityToken: null });
    const client = createMockClient();

    const result = await signInWithApple(client);

    expect(result.ok).toBe(false);
    expect(client.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("returns the mapped error when Supabase rejects the token", async () => {
    appleReturns({});
    const client = createMockClient({
      signInWithIdToken: jest.fn().mockResolvedValue({ data: { session: null }, error: { message: "Invalid token" } }),
    });

    const result = await signInWithApple(client);

    expect(result).toEqual({ ok: false, error: { type: "Unknown", message: "Invalid token" } });
  });

  it("saves the name Apple provides (first sign-in only) as the profile display name, family name first for Japanese names", async () => {
    appleReturns({ fullName: { givenName: "太郎", familyName: "山田" } });
    const client = createMockClient({
      signInWithIdToken: jest.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
    });

    await signInWithApple(client);

    expect(updateDisplayName).toHaveBeenCalledWith(client, "u1", "山田 太郎");
  });

  it("puts the given name first for non-Japanese names", async () => {
    appleReturns({ fullName: { givenName: "John", familyName: "Doe" } });
    const client = createMockClient({
      signInWithIdToken: jest.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
    });

    await signInWithApple(client);

    expect(updateDisplayName).toHaveBeenCalledWith(client, "u1", "John Doe");
  });

  it("does not touch the profile when Apple provides no name (every sign-in after the first)", async () => {
    appleReturns({ fullName: { givenName: null, familyName: null } });
    const client = createMockClient({
      signInWithIdToken: jest.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
    });

    await signInWithApple(client);

    expect(updateDisplayName).not.toHaveBeenCalled();
  });

  it("still signs in successfully when saving the display name fails", async () => {
    appleReturns({ fullName: { givenName: "太郎", familyName: "山田" } });
    (updateDisplayName as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Unknown", message: "x" } });
    const client = createMockClient({
      signInWithIdToken: jest.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
    });

    const result = await signInWithApple(client);

    expect(result).toEqual({ ok: true, value: SESSION });
  });
});

describe("revokeAppleAuthorizationIfNeeded", () => {
  const APPLE_USER = { identities: [{ provider: "apple" }] };
  const EMAIL_USER = { identities: [{ provider: "email" }] };

  afterEach(() => {
    jest.clearAllMocks();
  });

  function clientFor(user: unknown, invoke = jest.fn().mockResolvedValue({ data: { revoked: true }, error: null })) {
    return {
      client: {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
        functions: { invoke },
      } as unknown as SupabaseClient,
      invoke,
    };
  }

  it("does nothing for users who didn't sign in with Apple (no Apple prompt, no function call)", async () => {
    const { client, invoke } = clientFor(EMAIL_USER);

    const result = await revokeAppleAuthorizationIfNeeded(client);

    expect(result).toBe("not-apple");
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("re-confirms with Apple for an Apple user, then sends the fresh authorization code to the revoke function", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ authorizationCode: "code-123" });
    const { client, invoke } = clientFor(APPLE_USER);

    const result = await revokeAppleAuthorizationIfNeeded(client);

    expect(result).toBe("revoked");
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({ requestedScopes: [] });
    expect(invoke).toHaveBeenCalledWith("revoke-apple-token", { body: { authorizationCode: "code-123" } });
  });

  it("returns cancelled (and calls nothing) when the user dismisses Apple's confirmation sheet", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });
    const { client, invoke } = clientFor(APPLE_USER);

    const result = await revokeAppleAuthorizationIfNeeded(client);

    expect(result).toBe("cancelled");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns failed when Apple's sheet fails for another reason", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({ code: "ERR_REQUEST_FAILED" });
    const { client, invoke } = clientFor(APPLE_USER);

    expect(await revokeAppleAuthorizationIfNeeded(client)).toBe("failed");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns failed when Apple returns no authorization code", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ authorizationCode: null });
    const { client, invoke } = clientFor(APPLE_USER);

    expect(await revokeAppleAuthorizationIfNeeded(client)).toBe("failed");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns failed when the revoke function reports an error", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ authorizationCode: "code-123" });
    const { client } = clientFor(APPLE_USER, jest.fn().mockResolvedValue({ data: null, error: { message: "502" } }));

    expect(await revokeAppleAuthorizationIfNeeded(client)).toBe("failed");
  });

  it("returns failed when the signed-in user can't be determined", async () => {
    const client = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "no session" } }) },
      functions: { invoke: jest.fn() },
    } as unknown as SupabaseClient;

    expect(await revokeAppleAuthorizationIfNeeded(client)).toBe("failed");
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
});

describe("signInWithGoogle", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("opens the Google OAuth URL and sets the session from the callback tokens", async () => {
    const session = { user: { id: "u1" } };
    const client = createMockClient({
      signInWithOAuth: jest.fn().mockResolvedValue({
        data: { url: "https://accounts.google.com/o/oauth2/auth?..." },
        error: null,
      }),
      setSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "memorycalendar://auth-callback#access_token=at-1&refresh_token=rt-1",
    });

    const result = await signInWithGoogle(client);

    expect(result).toEqual({ ok: true, value: session });
    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "memorycalendar://auth-callback", skipBrowserRedirect: true },
    });
    expect(client.auth.setSession).toHaveBeenCalledWith({
      access_token: "at-1",
      refresh_token: "rt-1",
    });
  });

  it("returns a Cancelled error when the user dismisses the browser", async () => {
    const client = createMockClient({
      signInWithOAuth: jest.fn().mockResolvedValue({
        data: { url: "https://accounts.google.com/o/oauth2/auth?..." },
        error: null,
      }),
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: "dismiss" });

    const result = await signInWithGoogle(client);

    expect(result).toEqual({ ok: false, error: { type: "Cancelled" } });
  });

  it("returns an error when starting the OAuth flow fails", async () => {
    const client = createMockClient({
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: null }, error: { message: "provider not enabled" } }),
    });

    const result = await signInWithGoogle(client);

    expect(result).toEqual({ ok: false, error: { type: "Unknown", message: "provider not enabled" } });
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it("returns an error when the callback URL has no tokens", async () => {
    const client = createMockClient({
      signInWithOAuth: jest.fn().mockResolvedValue({
        data: { url: "https://accounts.google.com/o/oauth2/auth?..." },
        error: null,
      }),
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "memorycalendar://auth-callback#error=access_denied",
    });

    const result = await signInWithGoogle(client);

    expect(result.ok).toBe(false);
  });
});

describe("getAuthErrorMessageJa", () => {
  it("returns a Japanese message for each known error type", () => {
    expect(getAuthErrorMessageJa({ type: "InvalidCredentials" })).toContain("正しくありません");
    expect(getAuthErrorMessageJa({ type: "EmailAlreadyInUse" })).toContain("登録されています");
    expect(getAuthErrorMessageJa({ type: "Cancelled" })).toContain("キャンセル");
    expect(getAuthErrorMessageJa({ type: "Unknown", message: "x" })).toContain(
      "エラーが発生しました"
    );
  });
});
