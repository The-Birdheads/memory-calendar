import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { getMyProfile, updateDisplayName } from "../service";
import { useMyProfile, useUpdateDisplayName } from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  getMyProfile: jest.fn(),
  updateDisplayName: jest.fn(),
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
