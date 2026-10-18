import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { getAvatarUrls, removeMyAvatar, uploadMyAvatar } from "../service";
import { clearAvatarUrlCache, useAvatarUrls, useRemoveMyAvatar, useUploadMyAvatar } from "../avatarHooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  getAvatarUrls: jest.fn(),
  uploadMyAvatar: jest.fn(),
  removeMyAvatar: jest.fn(),
}));

describe("useAvatarUrls", () => {
  beforeEach(() => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    clearAvatarUrlCache();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("resolves signed urls for the given paths", async () => {
    (getAvatarUrls as jest.Mock).mockResolvedValue({ ok: true, value: { "u1/a.jpg": "https://signed/a" } });

    const { result } = await renderHook(() => useAvatarUrls(["u1/a.jpg"]));

    await waitFor(() => expect(result.current).toEqual({ "u1/a.jpg": "https://signed/a" }));
    expect(getAvatarUrls).toHaveBeenCalledWith({}, ["u1/a.jpg"]);
  });

  it("does nothing (no request) when there are no paths", async () => {
    const { result } = await renderHook(() => useAvatarUrls([]));

    expect(result.current).toEqual({});
    expect(getAvatarUrls).not.toHaveBeenCalled();
  });

  it("asks only once for the same path, de-duplicating repeated and later requests", async () => {
    (getAvatarUrls as jest.Mock).mockResolvedValue({ ok: true, value: { "u1/a.jpg": "https://signed/a" } });

    const first = await renderHook(() => useAvatarUrls(["u1/a.jpg", "u1/a.jpg"]));
    await waitFor(() => expect(first.result.current).toEqual({ "u1/a.jpg": "https://signed/a" }));

    const second = await renderHook(() => useAvatarUrls(["u1/a.jpg"]));
    await waitFor(() => expect(second.result.current).toEqual({ "u1/a.jpg": "https://signed/a" }));

    expect(getAvatarUrls).toHaveBeenCalledTimes(1);
    expect(getAvatarUrls).toHaveBeenCalledWith({}, ["u1/a.jpg"]);
  });

  it("only requests the paths it has not resolved yet", async () => {
    (getAvatarUrls as jest.Mock)
      .mockResolvedValueOnce({ ok: true, value: { "u1/a.jpg": "https://signed/a" } })
      .mockResolvedValueOnce({ ok: true, value: { "u2/b.jpg": "https://signed/b" } });

    const first = await renderHook(() => useAvatarUrls(["u1/a.jpg"]));
    await waitFor(() => expect(first.result.current["u1/a.jpg"]).toBe("https://signed/a"));

    const second = await renderHook(() => useAvatarUrls(["u1/a.jpg", "u2/b.jpg"]));
    await waitFor(() =>
      expect(second.result.current).toEqual({ "u1/a.jpg": "https://signed/a", "u2/b.jpg": "https://signed/b" })
    );

    expect(getAvatarUrls).toHaveBeenLastCalledWith({}, ["u2/b.jpg"]);
  });

  it("leaves the map empty when signing fails", async () => {
    (getAvatarUrls as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useAvatarUrls(["u1/a.jpg"]));

    await waitFor(() => expect(getAvatarUrls).toHaveBeenCalled());
    expect(result.current).toEqual({});
  });
});

describe("useUploadMyAvatar", () => {
  beforeEach(() => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
  });
  afterEach(() => jest.clearAllMocks());

  it("returns the updated profile", async () => {
    const photo = { fileName: "a.jpg", contentType: "image/jpeg", data: "x" as unknown as Blob };
    const profile = { id: "u1", displayName: "たろう", avatarPath: "u1/1.jpg", weekStartsOn: 0 };
    (uploadMyAvatar as jest.Mock).mockResolvedValue({ ok: true, value: profile });

    const { result } = await renderHook(() => useUploadMyAvatar());

    let returned = null;
    await act(async () => {
      returned = await result.current.uploadAvatar("u1", photo, "u1/old.jpg");
    });

    expect(returned).toEqual(profile);
    expect(uploadMyAvatar).toHaveBeenCalledWith({}, "u1", photo, "u1/old.jpg");
  });

  it("returns null and sets the error when it fails", async () => {
    (uploadMyAvatar as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useUploadMyAvatar());

    let returned: unknown = "x";
    await act(async () => {
      returned = await result.current.uploadAvatar("u1", { fileName: "a.jpg", contentType: "image/jpeg", data: "x" as unknown as Blob }, null);
    });

    expect(returned).toBeNull();
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useRemoveMyAvatar", () => {
  beforeEach(() => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
  });
  afterEach(() => jest.clearAllMocks());

  it("returns the updated profile", async () => {
    const profile = { id: "u1", displayName: "たろう", avatarPath: null, weekStartsOn: 0 };
    (removeMyAvatar as jest.Mock).mockResolvedValue({ ok: true, value: profile });

    const { result } = await renderHook(() => useRemoveMyAvatar());

    let returned = null;
    await act(async () => {
      returned = await result.current.removeAvatar("u1", "u1/old.jpg");
    });

    expect(returned).toEqual(profile);
    expect(removeMyAvatar).toHaveBeenCalledWith({}, "u1", "u1/old.jpg");
  });
});
