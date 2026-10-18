import AsyncStorage from "@react-native-async-storage/async-storage";

import { hasCompletedOnboarding, markOnboardingCompleted } from "../onboardingStorage";

describe("onboardingStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("has not completed onboarding for a user who has never seen it", async () => {
    expect(await hasCompletedOnboarding("user-1")).toBe(false);
  });

  it("remembers that a user completed onboarding", async () => {
    await markOnboardingCompleted("user-1");

    expect(await hasCompletedOnboarding("user-1")).toBe(true);
  });

  it("keeps the flag per user, so a different account on the same device still sees it", async () => {
    await markOnboardingCompleted("user-1");

    expect(await hasCompletedOnboarding("user-2")).toBe(false);
  });

  it("treats a storage read failure as completed, so a broken storage never traps the user in the tutorial", async () => {
    const getItem = jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));

    expect(await hasCompletedOnboarding("user-1")).toBe(true);
    getItem.mockRestore();
  });

  it("does not throw when saving fails", async () => {
    const setItem = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk"));

    await expect(markOnboardingCompleted("user-1")).resolves.toBeUndefined();
    setItem.mockRestore();
  });
});
