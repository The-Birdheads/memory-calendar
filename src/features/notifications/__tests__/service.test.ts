import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";

import {
  getExpoPushTokenAsync,
  invalidatePushToken,
  registerPushToken,
  requestNotificationPermissionsAsync,
} from "../service";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: 5 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "test-project-id" } } } },
}));

describe("requestNotificationPermissionsAsync", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Platform.OS = originalOS;
  });

  it("returns 'granted' without prompting again when already granted", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });

    const result = await requestNotificationPermissionsAsync();

    expect(result).toBe("granted");
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission when not already granted and returns the resulting status", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    const result = await requestNotificationPermissionsAsync();

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    expect(result).toBe("denied");
  });

  it("creates an Android notification channel before checking permissions on Android", async () => {
    Platform.OS = "android";
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });

    await requestNotificationPermissionsAsync();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ importance: Notifications.AndroidImportance.MAX })
    );
  });

  it("does not create a notification channel on iOS", async () => {
    Platform.OS = "ios";
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });

    await requestNotificationPermissionsAsync();

    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe("getExpoPushTokenAsync", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the token using the configured EAS project id", async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: "ExponentPushToken[abc]" });

    const token = await getExpoPushTokenAsync();

    expect(token).toBe("ExponentPushToken[abc]");
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "test-project-id" });
  });

  it("returns null when fetching the token fails", async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error("no device"));

    const token = await getExpoPushTokenAsync();

    expect(token).toBeNull();
  });
});

describe("registerPushToken", () => {
  it("upserts the token into push_tokens on success", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const client = {
      from: jest.fn().mockReturnValue({ upsert }),
    } as unknown as SupabaseClient;

    const result = await registerPushToken(client, "ExponentPushToken[abc]", "iPhone 15");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("push_tokens");
    expect(upsert).toHaveBeenCalledWith(
      { expo_push_token: "ExponentPushToken[abc]", device_info: "iPhone 15" },
      { onConflict: "expo_push_token" }
    );
  });

  it("maps a Supabase error to Forbidden", async () => {
    const upsert = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ upsert }),
    } as unknown as SupabaseClient;

    const result = await registerPushToken(client, "ExponentPushToken[abc]");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("invalidatePushToken", () => {
  it("deletes the row matching the given token", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await invalidatePushToken(client, "ExponentPushToken[abc]");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("push_tokens");
    expect(eq).toHaveBeenCalledWith("expo_push_token", "ExponentPushToken[abc]");
  });

  it("maps a Supabase error to Forbidden", async () => {
    const eq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await invalidatePushToken(client, "ExponentPushToken[abc]");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
