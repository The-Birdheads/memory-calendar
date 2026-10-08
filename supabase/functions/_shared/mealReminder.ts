// 献立の通知(朝食/昼食/夕食/間食の時間に、その日の献立を知らせる)の判定と文面。
// Deno固有のAPIは使わない純粋な関数だけにして、jestからも検証できるようにしている。
// 時刻はすべてJST(アプリ全体がJST前提)で扱う。

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

export const MEAL_SLOT_LABELS_JA: Record<MealSlot, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

/** meal_notification_settings の1行(ユーザー単位)。時刻はPostgresのtime("HH:MM:SS")でJST。 */
export interface MealNotificationSettingsRow {
  user_id: string;
  enabled: boolean;
  breakfast_enabled: boolean;
  breakfast_time: string;
  lunch_enabled: boolean;
  lunch_time: string;
  dinner_enabled: boolean;
  dinner_time: string;
  snack_enabled: boolean;
  snack_time: string;
}

/**
 * 設定時刻から何分以内なら「配信対象」とするか。毎分起動のcronが多少遅れても
 * 取りこぼさないための余裕(二重配信は notification_log の一意制約で防ぐ)。
 */
export const DELIVERY_WINDOW_MINUTES = 10;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 現在のJSTの日付("YYYY-MM-DD")と、0:00からの経過分。 */
export function jstClock(now: Date): { dateKey: string; minutes: number } {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return {
    dateKey: jst.toISOString().slice(0, 10),
    minutes: jst.getUTCHours() * 60 + jst.getUTCMinutes(),
  };
}

/** "08:00:00" / "18:05" を0:00からの分に変換する。 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** いまこの瞬間(JSTの経過分)に、通知を出すべき食事の時間帯。マスターがオフなら空。 */
export function dueMealSlots(settings: MealNotificationSettingsRow, nowMinutes: number): MealSlot[] {
  if (!settings.enabled) return [];
  return MEAL_SLOTS.filter((slot) => {
    if (!settings[`${slot}_enabled`]) return false;
    const elapsed = nowMinutes - timeToMinutes(settings[`${slot}_time`]);
    return elapsed >= 0 && elapsed < DELIVERY_WINDOW_MINUTES;
  });
}

/** 例: 「朝食の時間です!献立はコーンフレーク、牛乳の予定です」 */
export function buildMealReminderMessage(slot: MealSlot, titles: string[]): string {
  return `${MEAL_SLOT_LABELS_JA[slot]}の時間です！献立は${titles.join("、")}の予定です`;
}
