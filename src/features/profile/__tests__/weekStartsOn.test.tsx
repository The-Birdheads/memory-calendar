import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";

import { readCachedWeekStartsOn, saveCachedWeekStartsOn, useWeekStartsOn } from "../weekStartsOn";
import type { Profile } from "../types";

function profileWith(weekStartsOn: 0 | 1): Profile {
  return { id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn };
}

describe("weekStartsOn cache", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("has nothing cached for a user who never loaded the setting", async () => {
    expect(await readCachedWeekStartsOn("user-1")).toBeNull();
  });

  it("remembers the setting per user", async () => {
    await saveCachedWeekStartsOn("user-1", 1);

    expect(await readCachedWeekStartsOn("user-1")).toBe(1);
    expect(await readCachedWeekStartsOn("user-2")).toBeNull();
  });
});

describe("useWeekStartsOn", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("uses the profile's setting once it is loaded", async () => {
    const { result } = await renderHook(() => useWeekStartsOn("user-1", profileWith(1)));

    expect(result.current).toBe(1);
  });

  it("defaults to Sunday when nothing is known yet", async () => {
    const { result } = await renderHook(() => useWeekStartsOn("user-1", null));

    expect(result.current).toBe(0);
  });

  it("uses the last known setting while the profile has not loaded (regression: Monday-start users briefly/sometimes saw Sunday)", async () => {
    await saveCachedWeekStartsOn("user-1", 1);

    const { result } = await renderHook(() => useWeekStartsOn("user-1", null));

    await waitFor(() => expect(result.current).toBe(1));
  });

  it("keeps the last known setting when the profile is gone again after a failed refetch", async () => {
    const { result, rerender } = await renderHook(
      (props: { profile: Profile | null }) => useWeekStartsOn("user-1", props.profile),
      { initialProps: { profile: profileWith(1) as Profile | null } }
    );
    expect(result.current).toBe(1);

    await rerender({ profile: null });

    expect(result.current).toBe(1);
  });

  it("remembers the profile's setting for the next launch, and follows a change", async () => {
    const { rerender } = await renderHook(
      (props: { profile: Profile | null }) => useWeekStartsOn("user-1", props.profile),
      { initialProps: { profile: profileWith(1) as Profile | null } }
    );
    await waitFor(async () => expect(await readCachedWeekStartsOn("user-1")).toBe(1));

    await rerender({ profile: profileWith(0) });

    await waitFor(async () => expect(await readCachedWeekStartsOn("user-1")).toBe(0));
  });

  it("does not leak another user's setting", async () => {
    await saveCachedWeekStartsOn("user-1", 1);

    const { result } = await renderHook(() => useWeekStartsOn("user-2", null));

    expect(result.current).toBe(0);
  });
});

// spyOn(...).mockRestore() は AsyncStorage のモック関数の実装を空にしてしまうので、この確認は最後に置く。
describe("weekStartsOn cache failures", () => {
  it("returns null when reading fails, and does not throw when saving fails", async () => {
    const getItem = jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));
    expect(await readCachedWeekStartsOn("user-1")).toBeNull();
    getItem.mockRestore();

    const setItem = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk"));
    await expect(saveCachedWeekStartsOn("user-1", 1)).resolves.toBeUndefined();
    setItem.mockRestore();
  });
});
