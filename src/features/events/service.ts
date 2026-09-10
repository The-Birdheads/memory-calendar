import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type {
  CreateEventInput,
  CreateRecurringSeriesInput,
  DateRange,
  EditScope,
  Event,
  EventError,
  EventReminder,
  EventReminderCustomOffset,
  EventReminderKind,
  EventReminderUnit,
  EventWithTagColor,
  UpdateEventInput,
} from "./types";

const DEFAULT_ALL_DAY_REMINDER_KINDS: EventReminderKind[] = ["on_day", "day_before_1"];
const DEFAULT_TIMED_REMINDER_KINDS: EventReminderKind[] = ["before_10m"];

const TAG_LEVEL_PRIORITY = ["major", "mid", "minor"];

interface EventTagJoinRow {
  tags: { color: string; level: string } | null;
}

/** PostgRESTの埋め込みリソースに`count`を付けると`[{ count: N }]`という
 * 1要素配列で返ってくる(実データではなく件数だけを取りたい時の書き方)。 */
interface CountJoinRow {
  count: number;
}

function extractCount(rows: CountJoinRow[] | null | undefined): number {
  return rows?.[0]?.count ?? 0;
}

function pickPrimaryTagColor(eventTags: EventTagJoinRow[]): string | null {
  const tags = eventTags.map((row) => row.tags).filter((tag): tag is { color: string; level: string } => tag !== null);
  if (tags.length === 0) return null;

  for (const level of TAG_LEVEL_PRIORITY) {
    const match = tags.find((tag) => tag.level === level);
    if (match) return match.color;
  }
  return tags[0].color;
}

export interface EventRow {
  id: string;
  calendar_id: string;
  series_id: string | null;
  title: string;
  location: string | null;
  memo: string | null;
  url?: string | null;
  category_color: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  reminder_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    seriesId: row.series_id,
    title: row.title,
    location: row.location,
    memo: row.memo,
    url: row.url ?? null,
    categoryColor: row.category_color,
    startAt: row.start_at,
    endAt: row.end_at,
    isAllDay: row.is_all_day,
    reminderAt: row.reminder_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEventError(error: PostgrestError): EventError {
  if (error.code === "23514") {
    return { type: "InvalidDateRange" };
  }
  if (error.code === "PGRST116") {
    return { type: "NotFound" };
  }
  if (error.code === "A0003") {
    return { type: "InvalidRecurrenceRange" };
  }
  return { type: "Forbidden" };
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function createEvent(
  client: SupabaseClient,
  input: CreateEventInput
): Promise<Result<Event, EventError>> {
  const { data, error } = await client
    .from("events")
    .insert({
      calendar_id: input.calendarId,
      title: input.title,
      start_at: input.startAt,
      end_at: input.endAt,
      is_all_day: input.isAllDay ?? false,
      location: input.location ?? null,
      memo: input.memo ?? null,
      url: input.url ?? null,
      category_color: input.categoryColor ?? null,
      reminder_at: input.reminderAt ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok(mapEventRow(data as EventRow));
}

async function resolveSeriesId(
  client: SupabaseClient,
  eventId: string
): Promise<Result<string | null, EventError>> {
  const { data, error } = await client
    .from("events")
    .select("series_id")
    .eq("id", eventId)
    .single();

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok((data as { series_id: string | null }).series_id);
}

function buildUpdatePayload(input: UpdateEventInput, scope: EditScope): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (scope === "this") {
    if (input.startAt !== undefined) payload.start_at = input.startAt;
    if (input.endAt !== undefined) payload.end_at = input.endAt;
  }
  if (input.isAllDay !== undefined) payload.is_all_day = input.isAllDay;
  if (input.location !== undefined) payload.location = input.location;
  if (input.memo !== undefined) payload.memo = input.memo;
  if (input.url !== undefined) payload.url = input.url;
  if (input.categoryColor !== undefined) payload.category_color = input.categoryColor;
  if (input.reminderAt !== undefined) payload.reminder_at = input.reminderAt;
  return payload;
}

export async function updateEvent(
  client: SupabaseClient,
  eventId: string,
  input: UpdateEventInput,
  scope: EditScope = "this"
): Promise<Result<Event | Event[], EventError>> {
  if (input.startAt && input.endAt && input.endAt < input.startAt) {
    return err({ type: "InvalidDateRange" });
  }

  const payload = buildUpdatePayload(input, scope);

  if (scope === "series") {
    const seriesIdResult = await resolveSeriesId(client, eventId);
    if (!seriesIdResult.ok) {
      return seriesIdResult;
    }

    const { data, error } = await client
      .from("events")
      .update(payload)
      .eq("series_id", seriesIdResult.value)
      .select();

    if (error || !data) {
      return err(mapEventError(error as PostgrestError));
    }

    return ok((data as EventRow[]).map(mapEventRow));
  }

  const { data, error } = await client
    .from("events")
    .update(payload)
    .eq("id", eventId)
    .select()
    .single();

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok(mapEventRow(data as EventRow));
}

export async function deleteEvent(
  client: SupabaseClient,
  eventId: string,
  scope: EditScope = "this"
): Promise<Result<void, EventError>> {
  if (scope === "series") {
    const seriesIdResult = await resolveSeriesId(client, eventId);
    if (!seriesIdResult.ok) {
      return seriesIdResult;
    }

    const { error } = await client.from("events").delete().eq("series_id", seriesIdResult.value);

    if (error) {
      return err(mapEventError(error));
    }

    return ok(undefined);
  }

  const { error } = await client.from("events").delete().eq("id", eventId);

  if (error) {
    return err(mapEventError(error));
  }

  return ok(undefined);
}

export async function createRecurringSeries(
  client: SupabaseClient,
  input: CreateRecurringSeriesInput
): Promise<Result<Event[], EventError>> {
  if (input.endAt < input.startAt) {
    return err({ type: "InvalidDateRange" });
  }

  if (!input.recurrenceEndAt) {
    return err({ type: "InvalidRecurrenceRange" });
  }

  const startAtMs = new Date(input.startAt).getTime();
  const recurrenceEndAtMs = new Date(input.recurrenceEndAt).getTime();
  if (recurrenceEndAtMs - startAtMs > ONE_YEAR_MS) {
    return err({ type: "InvalidRecurrenceRange" });
  }

  const { data, error } = await client.rpc("create_recurring_series", {
    p_calendar_id: input.calendarId,
    p_title: input.title,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_recurrence_rule: input.recurrenceRule,
    p_recurrence_end_at: input.recurrenceEndAt,
    p_is_all_day: input.isAllDay ?? false,
    p_location: input.location ?? null,
    p_memo: input.memo ?? null,
    p_category_color: input.categoryColor ?? null,
    p_reminder_at: input.reminderAt ?? null,
  });

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok((data as EventRow[]).map(mapEventRow));
}

interface EventReminderRow {
  id: string;
  event_id: string;
  user_id: string;
  kind: EventReminderKind;
  custom_value: number | null;
  custom_unit: EventReminderUnit | null;
  remind_at: string;
}

function mapEventReminderRow(row: EventReminderRow): EventReminder {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    kind: row.kind,
    customValue: row.custom_value,
    customUnit: row.custom_unit,
    remindAt: row.remind_at,
  };
}

/** Lists the CURRENT user's own reminder settings for an event (RLS already
 * scopes rows to the caller - reminders are entirely personal, other
 * members' settings are never visible). */
export async function listEventReminders(
  client: SupabaseClient,
  eventId: string
): Promise<Result<EventReminder[], EventError>> {
  const { data, error } = await client.from("event_reminders").select("*").eq("event_id", eventId);

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok((data as EventReminderRow[]).map(mapEventReminderRow));
}

/** Adds one of the caller's own reminders for an event. Non-custom kinds are
 * limited to one row per user per event, so any existing row of the same
 * kind is cleared first (a re-check effectively replaces it). "custom"
 * (an arbitrary N分/時間/日/週間前 offset) has no such limit - several can
 * coexist - so it is inserted directly without clearing anything. */
export async function addEventReminder(
  client: SupabaseClient,
  eventId: string,
  kind: EventReminderKind,
  custom?: EventReminderCustomOffset
): Promise<Result<void, EventError>> {
  if (kind !== "custom") {
    const { error: deleteError } = await client
      .from("event_reminders")
      .delete()
      .eq("event_id", eventId)
      .eq("kind", kind);

    if (deleteError) {
      return err(mapEventError(deleteError));
    }
  }

  const { error: insertError } = await client.from("event_reminders").insert({
    event_id: eventId,
    kind,
    custom_value: kind === "custom" ? (custom?.value ?? null) : null,
    custom_unit: kind === "custom" ? (custom?.unit ?? null) : null,
  });

  if (insertError) {
    return err(mapEventError(insertError));
  }

  return ok(undefined);
}

/** Removes a single reminder by its own row id - needed (rather than by
 * event+kind) because several "custom" reminders can exist for the same
 * event/user, so kind alone can't identify which one to remove. */
export async function removeEventReminder(
  client: SupabaseClient,
  reminderId: string
): Promise<Result<void, EventError>> {
  const { error } = await client.from("event_reminders").delete().eq("id", reminderId);

  if (error) {
    return err(mapEventError(error));
  }

  return ok(undefined);
}

/** Seeds the caller's default reminders right after creating an event, so a
 * reminder fires even if they never open the event again to configure one
 * (当日+1日前 for all-day events, 10分前 for timed events). */
export async function createDefaultEventReminders(
  client: SupabaseClient,
  eventId: string,
  isAllDay: boolean
): Promise<Result<void, EventError>> {
  const kinds = isAllDay ? DEFAULT_ALL_DAY_REMINDER_KINDS : DEFAULT_TIMED_REMINDER_KINDS;

  const { error } = await client
    .from("event_reminders")
    .insert(kinds.map((kind) => ({ event_id: eventId, kind })));

  if (error) {
    return err(mapEventError(error));
  }

  return ok(undefined);
}

// 一覧系クエリで毎回使う埋め込みセレクト - タグ色に加えて、写真/コメントの
// 件数バッジ用に件数だけをそれぞれ埋め込む(中身は取らない、軽量な集計)。
const EVENT_LIST_SELECT =
  "*, event_tags(tags(color, level)), event_photos(count), event_comments(count)";

interface EventListRow extends EventRow {
  event_tags: EventTagJoinRow[];
  event_photos: CountJoinRow[];
  event_comments: CountJoinRow[];
}

function mapEventRowsWithTagColor(data: EventListRow[]): EventWithTagColor[] {
  return data.map((row) => ({
    ...mapEventRow(row),
    tagColor: pickPrimaryTagColor(row.event_tags ?? []),
    photoCount: extractCount(row.event_photos),
    commentCount: extractCount(row.event_comments),
  }));
}

export async function listEventsInRange(
  client: SupabaseClient,
  calendarId: string,
  range: DateRange
): Promise<Result<EventWithTagColor[], EventError>> {
  const { data, error } = await client
    .from("events")
    .select(EVENT_LIST_SELECT)
    .eq("calendar_id", calendarId)
    .lte("start_at", range.end)
    .gte("end_at", range.start)
    .order("start_at", { ascending: true });

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok(mapEventRowsWithTagColor(data as EventListRow[]));
}

/** Same as listEventsInRange but overlays events from several calendars at once
 * (e.g. the Calendar tab's multi-select view), merged into one ordered list. */
export async function listEventsInRangeForCalendars(
  client: SupabaseClient,
  calendarIds: string[],
  range: DateRange
): Promise<Result<EventWithTagColor[], EventError>> {
  if (calendarIds.length === 0) {
    return ok([]);
  }

  const { data, error } = await client
    .from("events")
    .select(EVENT_LIST_SELECT)
    .in("calendar_id", calendarIds)
    .lte("start_at", range.end)
    .gte("end_at", range.start)
    .order("start_at", { ascending: true });

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok(mapEventRowsWithTagColor(data as EventListRow[]));
}

export async function getEvent(
  client: SupabaseClient,
  eventId: string
): Promise<Result<Event, EventError>> {
  const { data, error } = await client.from("events").select().eq("id", eventId).single();

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok(mapEventRow(data as EventRow));
}

export function getEventErrorMessageJa(error: EventError): string {
  switch (error.type) {
    case "NotFound":
      return "予定が見つかりません";
    case "Forbidden":
      return "この操作を行う権限がありません";
    case "InvalidDateRange":
      return "終了日時は開始日時より後に設定してください";
    case "InvalidRecurrenceRange":
      return "繰り返しの終了日は開始日から1年以内で指定してください";
    default:
      return "エラーが発生しました。しばらくしてから再度お試しください";
  }
}
