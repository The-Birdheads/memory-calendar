import type { SupabaseClient } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";

import { getAuthErrorMessageJa, signIn, signInWithGoogle, signOut, signUp } from "../service";

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
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
