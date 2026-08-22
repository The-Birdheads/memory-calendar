import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { err, ok, type Result } from "../../shared/types/result";
import type { NotificationError } from "./types";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

const ANDROID_DEFAULT_CHANNEL_ID = "default";

async function ensureAndroidNotificationChannelAsync(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: "デフォルト",
    importance: Notifications.AndroidImportance.MAX,
  });
}

export async function requestNotificationPermissionsAsync(): Promise<NotificationPermissionStatus> {
  await ensureAndroidNotificationChannelAsync();

  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") {
    return "granted";
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return requested.status as NotificationPermissionStatus;
}

export async function getExpoPushTokenAsync(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    return result.data;
  } catch {
    return null;
  }
}

export async function registerPushToken(
  client: SupabaseClient,
  token: string,
  deviceInfo?: string
): Promise<Result<void, NotificationError>> {
  const { error } = await client
    .from("push_tokens")
    .upsert({ expo_push_token: token, device_info: deviceInfo ?? null }, { onConflict: "expo_push_token" });

  if (error) {
    return err({ type: "Forbidden" });
  }

  return ok(undefined);
}

export async function invalidatePushToken(
  client: SupabaseClient,
  token: string
): Promise<Result<void, NotificationError>> {
  const { error } = await client.from("push_tokens").delete().eq("expo_push_token", token);

  if (error) {
    return err({ type: "Forbidden" });
  }

  return ok(undefined);
}
