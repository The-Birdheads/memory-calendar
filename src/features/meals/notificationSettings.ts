import type { SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { MealSlot } from "./types";

export const NOTIFICATION_MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export interface MealSlotNotification {
  enabled: boolean;
  /** "HH:MM"(JSTの時刻) */
  time: string;
}

/** 献立の通知設定(ユーザー単位)。enabled が「予定に登録した献立の通知」のマスタースイッチ。 */
export interface MealNotificationSettings {
  enabled: boolean;
  slots: Record<MealSlot, MealSlotNotification>;
}

export type MealNotificationSettingsError = { type: "LoadFailed" } | { type: "SaveFailed" };

/** 未設定のユーザーの初期値: 通知はオフ、オンにした時の時刻は朝8:00・昼12:00・夕18:00・間食15:00。 */
export const DEFAULT_MEAL_NOTIFICATION_SETTINGS: MealNotificationSettings = {
  enabled: false,
  slots: {
    breakfast: { enabled: true, time: "08:00" },
    lunch: { enabled: true, time: "12:00" },
    dinner: { enabled: true, time: "18:00" },
    snack: { enabled: true, time: "15:00" },
  },
};

type SettingsRow = { user_id: string; enabled: boolean } & Record<`${MealSlot}_enabled`, boolean> &
  Record<`${MealSlot}_time`, string>;

/** Postgresのtime("08:00:00")から秒を落として"HH:MM"にする。 */
function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

function mapRow(row: SettingsRow): MealNotificationSettings {
  const slot = (key: MealSlot): MealSlotNotification => ({
    enabled: row[`${key}_enabled`],
    time: trimSeconds(row[`${key}_time`]),
  });
  return {
    enabled: row.enabled,
    slots: { breakfast: slot("breakfast"), lunch: slot("lunch"), dinner: slot("dinner"), snack: slot("snack") },
  };
}

export async function getMealNotificationSettings(
  client: SupabaseClient,
  userId: string
): Promise<Result<MealNotificationSettings, MealNotificationSettingsError>> {
  const { data, error } = await client
    .from("meal_notification_settings")
    .select()
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return err({ type: "LoadFailed" });
  }
  return ok(data ? mapRow(data as SettingsRow) : DEFAULT_MEAL_NOTIFICATION_SETTINGS);
}

/** 設定を保存する(行がなければ作成、あれば更新)。 */
export async function saveMealNotificationSettings(
  client: SupabaseClient,
  userId: string,
  settings: MealNotificationSettings
): Promise<Result<MealNotificationSettings, MealNotificationSettingsError>> {
  const { data, error } = await client
    .from("meal_notification_settings")
    .upsert(
      {
        user_id: userId,
        enabled: settings.enabled,
        breakfast_enabled: settings.slots.breakfast.enabled,
        breakfast_time: settings.slots.breakfast.time,
        lunch_enabled: settings.slots.lunch.enabled,
        lunch_time: settings.slots.lunch.time,
        dinner_enabled: settings.slots.dinner.enabled,
        dinner_time: settings.slots.dinner.time,
        snack_enabled: settings.slots.snack.enabled,
        snack_time: settings.slots.snack.time,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error || !data) {
    return err({ type: "SaveFailed" });
  }
  return ok(mapRow(data as SettingsRow));
}

/** "HH:MM" をネイティブの時刻ピッカー用のDate(今日のその時刻)にする。 */
export function timeStringToDate(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** ピッカーが返したDateの、端末の壁時計の時:分を "HH:MM" にする。 */
export function dateToTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
