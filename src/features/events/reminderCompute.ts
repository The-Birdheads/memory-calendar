import { toJstDateKey } from "../../shared/utils/formatDateTime";
import type { EventReminderCustomOffset, EventReminderKind, EventReminderUnit } from "./types";

/**
 * Client-side mirror of the DB's `compute_event_reminder_at` SQL function
 * (see `supabase/migrations/20260906030000_event_reminders_custom_offset.sql`)
 * - 当日/前日等はJST 9時、それ以外は予定開始時刻からの単純な差分。予定の
 * event_remindersはこの計算をDBトリガーで行い、クライアントからは
 * kind/custom_value/custom_unitしか送らない(remind_atは常にサーバー側で
 * 再計算される)が、ToDoのリマインドは1件だけの絶対時刻(`todos.reminder_at`)
 * をクライアントから直接保存する設計なので、同じ計算式をこちらでも
 * 再現しておく必要がある(2026-09、ToDoのリマインドを予定と同じ選択式
 * UIにする際に追加)。
 */
const UNIT_MS: Record<EventReminderUnit, number> = {
  minute: 60_000,
  hour: 60 * 60_000,
  day: 24 * 60 * 60_000,
  week: 7 * 24 * 60 * 60_000,
};

/** "YYYY-MM-DD"(JST基準の日付) と日数オフセットから、シフト後の日付を同じ形式で返す。 */
function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 与えられたJST日付("YYYY-MM-DD")のJST9:00を表すUTC ISO文字列。 */
function jstNineAmIso(dateKey: string): string {
  return new Date(`${dateKey}T09:00:00+09:00`).toISOString();
}

export function computeEventReminderAt(
  kind: EventReminderKind,
  eventStartAt: string,
  custom?: EventReminderCustomOffset
): string {
  const startDateKey = toJstDateKey(eventStartAt);

  switch (kind) {
    case "on_day":
      return jstNineAmIso(startDateKey);
    case "day_before_1":
      return jstNineAmIso(shiftDateKey(startDateKey, -1));
    case "day_before_2":
      return jstNineAmIso(shiftDateKey(startDateKey, -2));
    case "at_start":
      return new Date(eventStartAt).toISOString();
    case "before_10m":
      return new Date(new Date(eventStartAt).getTime() - 10 * UNIT_MS.minute).toISOString();
    case "before_1h":
      return new Date(new Date(eventStartAt).getTime() - UNIT_MS.hour).toISOString();
    case "custom": {
      if (!custom) return new Date(eventStartAt).toISOString();
      return new Date(new Date(eventStartAt).getTime() - custom.value * UNIT_MS[custom.unit]).toISOString();
    }
  }
}
