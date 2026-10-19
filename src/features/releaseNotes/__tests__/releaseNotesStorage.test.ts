import AsyncStorage from "@react-native-async-storage/async-storage";

import { getLastSeenReleaseVersion, markReleaseNotesSeen } from "../releaseNotesStorage";

describe("releaseNotesStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("has no record for a user who has never seen any release notes", async () => {
    expect(await getLastSeenReleaseVersion("user-1")).toBeNull();
  });

  it("remembers the last version a user saw", async () => {
    await markReleaseNotesSeen("user-1", "1.0.1");

    expect(await getLastSeenReleaseVersion("user-1")).toBe("1.0.1");
  });

  it("keeps the record per user", async () => {
    await markReleaseNotesSeen("user-1", "1.0.1");

    expect(await getLastSeenReleaseVersion("user-2")).toBeNull();
  });

  it("reports unknown on a read failure, so a broken storage never keeps showing the notes", async () => {
    const getItem = jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));

    expect(await getLastSeenReleaseVersion("user-1")).toBe("unknown");
    getItem.mockRestore();
  });

  it("does not throw when saving fails", async () => {
    const setItem = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk"));

    await expect(markReleaseNotesSeen("user-1", "1.0.1")).resolves.toBeUndefined();
    setItem.mockRestore();
  });
});
