import { TestIds } from "react-native-google-mobile-ads";

import { getBannerUnitId } from "../adConfig";

const globalWithDev = globalThis as unknown as { __DEV__: boolean };

describe("getBannerUnitId", () => {
  const originalDev = globalWithDev.__DEV__;
  const originalEnv = process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID;

  afterEach(() => {
    globalWithDev.__DEV__ = originalDev;
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID;
    else process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID = originalEnv;
  });

  it("uses Google's test banner unit in development builds, whatever the env says", () => {
    globalWithDev.__DEV__ = true;
    process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID = "ca-app-pub-1111111111111111/2222222222";

    expect(getBannerUnitId()).toBe(TestIds.BANNER);
  });

  it("uses the configured production banner unit in release builds", () => {
    globalWithDev.__DEV__ = false;
    process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID = "ca-app-pub-1111111111111111/2222222222";

    expect(getBannerUnitId()).toBe("ca-app-pub-1111111111111111/2222222222");
  });

  it("shows no ads (null) in a release build without a unit id, instead of falling back to test ads", () => {
    globalWithDev.__DEV__ = false;
    delete process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID;

    expect(getBannerUnitId()).toBeNull();
  });

  it("treats a blank unit id as not configured", () => {
    globalWithDev.__DEV__ = false;
    process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID = "   ";

    expect(getBannerUnitId()).toBeNull();
  });
});
