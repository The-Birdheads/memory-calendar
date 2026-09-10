export interface Event {
  id: string;
  calendarId: string;
  seriesId: string | null;
  title: string;
  location: string | null;
  memo: string | null;
  url: string | null;
  categoryColor: string | null;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  reminderAt: string | null;
  // 作成者/最終更新者が退会した後も予定自体は残るため(アカウント削除時にNULL化される)、nullを許容する
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An event plus the color of its "primary" attached tag (大分類 > 中分類 > 小分類, or null if untagged). */
export interface EventWithTagColor extends Event {
  tagColor: string | null;
  /** 思い出(写真)・コメントの件数 - 日付の予定一覧などで「見た目だけでは
   * 分からない中身がある」ことに気づけるよう件数バッジとして表示する。 */
  photoCount: number;
  commentCount: number;
}

export interface CreateEventInput {
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  isAllDay?: boolean;
  location?: string;
  memo?: string;
  url?: string;
  categoryColor?: string;
  reminderAt?: string;
}

export type EditScope = "this" | "series";

export interface UpdateEventInput {
  title?: string;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  location?: string | null;
  memo?: string | null;
  url?: string | null;
  categoryColor?: string | null;
  reminderAt?: string | null;
}

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface CreateRecurringSeriesInput {
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  recurrenceRule: RecurrenceFrequency;
  recurrenceEndAt: string;
  isAllDay?: boolean;
  location?: string;
  memo?: string;
  categoryColor?: string;
  reminderAt?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

/**
 * 個人単位のリマインド設定(誰に通知するかではなく、自分がいつ通知してほしいか)。
 * 終日予定は on_day/day_before_1/day_before_2(JST9時に通知)、時刻指定の予定は
 * at_start/before_10m/before_1h(開始時刻からの相対時刻)から選ぶ。customは
 * 「N 分/時間/日/週間 前」を自由に指定でき、1件のイベントに複数件追加できる。
 */
export type EventReminderKind =
  | "on_day"
  | "day_before_1"
  | "day_before_2"
  | "at_start"
  | "before_10m"
  | "before_1h"
  | "custom";

export type EventReminderUnit = "minute" | "hour" | "day" | "week";

export interface EventReminder {
  id: string;
  eventId: string;
  userId: string;
  kind: EventReminderKind;
  /** kind "custom" のみ設定される: customValue 個の customUnit 前に通知する。 */
  customValue: number | null;
  customUnit: EventReminderUnit | null;
  remindAt: string;
}

/** "custom" リマインドを追加する際に渡す、N 個の customUnit 前という指定。 */
export interface EventReminderCustomOffset {
  value: number;
  unit: EventReminderUnit;
}

export type EventError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "InvalidDateRange" }
  | { type: "InvalidRecurrenceRange" };
