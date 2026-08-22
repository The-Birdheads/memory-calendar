import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthErrorMessageJa, signIn, signOut, signUp } from "../service";

function createMockClient(authOverrides: Record<string, jest.Mock> = {}): SupabaseClient {
  return {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
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

describe("getAuthErrorMessageJa", () => {
  it("returns a Japanese message for each known error type", () => {
    expect(getAuthErrorMessageJa({ type: "InvalidCredentials" })).toContain("正しくありません");
    expect(getAuthErrorMessageJa({ type: "EmailAlreadyInUse" })).toContain("登録されています");
    expect(getAuthErrorMessageJa({ type: "Unknown", message: "x" })).toContain(
      "エラーが発生しました"
    );
  });
});
