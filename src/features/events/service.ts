import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type {
  CreateEventInput,
  CreateRecurringSeriesInput,
  DateRange,
  EditScope,
  Event,
  EventError,
  ReminderTargetsInput,
  UpdateEventInput,
} from "./types";

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
  created_by: string;
  updated_by: string;
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

export async function setReminderTargets(
  client: SupabaseClient,
  eventId: string,
  userIds: ReminderTargetsInput
): Promise<Result<void, EventError>> {
  const { error: deleteError } = await client
    .from("event_reminder_targets")
    .delete()
    .eq("event_id", eventId);

  if (deleteError) {
    return err(mapEventError(deleteError));
  }

  if (userIds === "all" || userIds.length === 0) {
    return ok(undefined);
  }

  const { error: insertError } = await client
    .from("event_reminder_targets")
    .insert(userIds.map((userId) => ({ event_id: eventId, user_id: userId })));

  if (insertError) {
    return err(mapEventError(insertError));
  }

  return ok(undefined);
}

export async function listEventsInRange(
  client: SupabaseClient,
  calendarId: string,
  range: DateRange
): Promise<Result<Event[], EventError>> {
  const { data, error } = await client
    .from("events")
    .select()
    .eq("calendar_id", calendarId)
    .lte("start_at", range.end)
    .gte("end_at", range.start)
    .order("start_at", { ascending: true });

  if (error || !data) {
    return err(mapEventError(error as PostgrestError));
  }

  return ok((data as EventRow[]).map(mapEventRow));
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
