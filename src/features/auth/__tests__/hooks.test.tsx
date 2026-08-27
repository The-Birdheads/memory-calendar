import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { getExpoPushTokenAsync, invalidatePushToken } from "../../notifications/service";
import { signIn, signInWithGoogle, signOut, signUp } from "../service";
import { useAuthActions, useAuthSession } from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

jest.mock("../../notifications/service", () => ({
  getExpoPushTokenAsync: jest.fn(),
  invalidatePushToken: jest.fn(),
}));

describe("useAuthSession", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the persisted session on mount", async () => {
    const session = { user: { id: "u1" } };
    const unsubscribe = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session } }),
        onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe } } }),
      },
    });

    const { result } = await renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toEqual(session);
  });

  it("has no session and is not loading when no session is persisted", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: jest
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      },
    });

    const { result } = await renderHook(() => useAuthSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it("updates the session when the auth state changes", async () => {
    let authStateCallback: (event: string, session: unknown) => void = () => {};
    (getSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
      },
    });

    const { result } = await renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newSession = { user: { id: "u2" } };
    await act(async () => {
      authStateCallback("SIGNED_IN", newSession);
    });

    expect(result.current.session).toEqual(newSession);
  });

  it("unsubscribes from auth state changes on unmount", async () => {
    const unsubscribe = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe } } }),
      },
    });

    const { unmount } = await renderHook(() => useAuthSession());
    await unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("useAuthActions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and keeps error null when sign-in succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signIn as jest.Mock).mockResolvedValue({ ok: true, value: { user: { id: "u1" } } });

    const { result } = await renderHook(() => useAuthActions());

    let success = false;
    await act(async () => {
      success = await result.current.signIn({ email: "a@example.com", password: "pw" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(signIn).toHaveBeenCalledWith({}, { email: "a@example.com", password: "pw" });
  });

  it("returns false and sets the error when sign-in fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signIn as jest.Mock).mockResolvedValue({ ok: false, error: { type: "InvalidCredentials" } });

    const { result } = await renderHook(() => useAuthActions());

    let success = true;
    await act(async () => {
      success = await result.current.signIn({ email: "a@example.com", password: "wrong" });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "InvalidCredentials" });
  });

  it("calls signUp for account creation", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signUp as jest.Mock).mockResolvedValue({ ok: true, value: null });

    const { result } = await renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signUp({ email: "new@example.com", password: "pw123456" });
    });

    expect(signUp).toHaveBeenCalledWith({}, { email: "new@example.com", password: "pw123456" });
  });

  it("calls signOut and reports success", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signOut as jest.Mock).mockResolvedValue({ ok: true, value: undefined });
    (getExpoPushTokenAsync as jest.Mock).mockResolvedValue(null);

    const { result } = await renderHook(() => useAuthActions());

    let success = false;
    await act(async () => {
      success = await result.current.signOut();
    });

    expect(success).toBe(true);
    expect(signOut).toHaveBeenCalledWith({});
  });

  it("invalidates the current device's push token before signing out", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signOut as jest.Mock).mockResolvedValue({ ok: true, value: undefined });
    (getExpoPushTokenAsync as jest.Mock).mockResolvedValue("ExponentPushToken[abc]");
    (invalidatePushToken as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signOut();
    });

    expect(invalidatePushToken).toHaveBeenCalledWith({}, "ExponentPushToken[abc]");
  });

  it("still signs out even when push token invalidation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signOut as jest.Mock).mockResolvedValue({ ok: true, value: undefined });
    (getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error("no token"));

    const { result } = await renderHook(() => useAuthActions());

    let success = false;
    await act(async () => {
      success = await result.current.signOut();
    });

    expect(success).toBe(true);
    expect(signOut).toHaveBeenCalledWith({});
  });

  it("returns true and keeps error null when Google sign-in succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signInWithGoogle as jest.Mock).mockResolvedValue({ ok: true, value: { user: { id: "u1" } } });

    const { result } = await renderHook(() => useAuthActions());

    let success = false;
    await act(async () => {
      success = await result.current.signInWithGoogle();
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(signInWithGoogle).toHaveBeenCalledWith({});
  });

  it("returns false and sets the error when Google sign-in fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (signInWithGoogle as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Cancelled" } });

    const { result } = await renderHook(() => useAuthActions());

    let success = true;
    await act(async () => {
      success = await result.current.signInWithGoogle();
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Cancelled" });
  });
});
