import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { revokeAppleAuthorizationIfNeeded } from "../../auth/service";
import { deleteOwnAccount, getMyProfile, updateDisplayName } from "../service";
import { useDeleteAccount, useMyProfile, useUpdateDisplayName } from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../../auth/service", () => ({
  revokeAppleAuthorizationIfNeeded: jest.fn(),
}));

jest.mock("../service", () => ({
  getMyProfile: jest.fn(),
  updateDisplayName: jest.fn(),
  deleteOwnAccount: jest.fn(),
}));

describe("useMyProfile", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the caller's profile on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const profile = { id: "user-1", displayName: "たろう", avatarUrl: null };
    (getMyProfile as jest.Mock).mockResolvedValue({ ok: true, value: profile });

    const { result } = await renderHook(() => useMyProfile("user-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profile).toEqual(profile);
    expect(getMyProfile).toHaveBeenCalledWith({}, "user-1");
  });

  it("keeps a null profile and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (getMyProfile as jest.Mock).mockResolvedValue({ ok: false, error: { type: "NotFound" } });

    const { result } = await renderHook(() => useMyProfile("user-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toEqual({ type: "NotFound" });
  });

  it("refetches when this user's own profile row changes elsewhere (regression: switching 週の開始曜日 in settings didn't update the calendar screen's own useMyProfile instance)", async () => {
    const channel = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = { channel: jest.fn(() => channel) };
    (getSupabaseClient as jest.Mock).mockReturnValue(client);
    (getMyProfile as jest.Mock).mockResolvedValue({
      ok: true,
      value: { id: "user-1", displayName: "たろう", avatarUrl: null, weekStartsOn: 0 },
    });

    await renderHook(() => useMyProfile("user-1"));

    await waitFor(() => expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^my-profile-user-1-/)));
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles", filter: "id=eq.user-1" },
      expect.any(Function)
    );

    const onChange = channel.on.mock.calls[0][2];
    (getMyProfile as jest.Mock).mockClear();
    await act(async () => {
      await onChange();
    });

    expect(getMyProfile).toHaveBeenCalledWith(client, "user-1");
  });
});

describe("useUpdateDisplayName", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the updated profile and clears the error on success", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const profile = { id: "user-1", displayName: "新しい名前", avatarUrl: null };
    (updateDisplayName as jest.Mock).mockResolvedValue({ ok: true, value: profile });

    const { result } = await renderHook(() => useUpdateDisplayName());
    let updated: unknown = undefined;
    await act(async () => {
      updated = await result.current.updateDisplayName("user-1", "新しい名前");
    });

    expect(updated).toEqual(profile);
    expect(result.current.error).toBeNull();
    expect(updateDisplayName).toHaveBeenCalledWith({}, "user-1", "新しい名前");
  });

  it("returns null and sets the error on failure", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateDisplayName as jest.Mock).mockResolvedValue({
      ok: false,
      error: { type: "ValidationError", field: "displayName" },
    });

    const { result } = await renderHook(() => useUpdateDisplayName());
    let updated: unknown = undefined;
    await act(async () => {
      updated = await result.current.updateDisplayName("user-1", "");
    });

    expect(updated).toBeNull();
    expect(result.current.error).toEqual({ type: "ValidationError", field: "displayName" });
  });
});

describe("useDeleteAccount", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    (revokeAppleAuthorizationIfNeeded as jest.Mock).mockResolvedValue("not-apple");
  });

  async function runDelete() {
    const { result } = await renderHook(() => useDeleteAccount());
    let succeeded: boolean | undefined = undefined;
    await act(async () => {
      succeeded = await result.current.deleteAccount();
    });
    return { result, succeeded };
  }

  it("revokes the Apple authorization first (for Apple users), then deletes the account", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (revokeAppleAuthorizationIfNeeded as jest.Mock).mockResolvedValue("revoked");
    (deleteOwnAccount as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { succeeded } = await runDelete();

    expect(succeeded).toBe(true);
    const revokeOrder = (revokeAppleAuthorizationIfNeeded as jest.Mock).mock.invocationCallOrder[0];
    const deleteOrder = (deleteOwnAccount as jest.Mock).mock.invocationCallOrder[0];
    expect(revokeOrder).toBeLessThan(deleteOrder);
  });

  it("aborts without deleting anything (and without an error message) when the user cancels Apple's confirmation", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (revokeAppleAuthorizationIfNeeded as jest.Mock).mockResolvedValue("cancelled");

    const { result, succeeded } = await runDelete();

    expect(succeeded).toBe(false);
    expect(deleteOwnAccount).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("still deletes the account when revoking the Apple token fails (deletion must always remain possible)", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (revokeAppleAuthorizationIfNeeded as jest.Mock).mockResolvedValue("failed");
    (deleteOwnAccount as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { succeeded } = await runDelete();

    expect(succeeded).toBe(true);
    expect(deleteOwnAccount).toHaveBeenCalled();
  });

  it("returns true and clears the error on success", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteOwnAccount as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDeleteAccount());
    let succeeded: boolean | undefined = undefined;
    await act(async () => {
      succeeded = await result.current.deleteAccount();
    });

    expect(succeeded).toBe(true);
    expect(result.current.error).toBeNull();
    expect(deleteOwnAccount).toHaveBeenCalledWith({});
  });

  it("returns false and sets the error on failure", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteOwnAccount as jest.Mock).mockResolvedValue({ ok: false, error: { type: "DeleteFailed" } });

    const { result } = await renderHook(() => useDeleteAccount());
    let succeeded: boolean | undefined = undefined;
    await act(async () => {
      succeeded = await result.current.deleteAccount();
    });

    expect(succeeded).toBe(false);
    expect(result.current.error).toEqual({ type: "DeleteFailed" });
  });
});
