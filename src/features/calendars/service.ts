import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type {
  Calendar,
  CalendarError,
  CalendarInvite,
  CalendarMember,
  CalendarMembership,
  CreateCalendarInput,
  UpdateCalendarInput,
} from "./types";

interface CalendarRow {
  id: string;
  name: string;
  kind: string;
  color: string;
  created_by: string;
  created_at: string;
}

function mapCalendarRow(row: CalendarRow): Calendar {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === "personal" ? "personal" : "group",
    color: row.color,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

interface CalendarInviteRow {
  id: string;
  calendar_id: string;
  code: string;
  expires_at: string;
  created_by: string;
  created_at: string;
}

function mapCalendarInviteRow(row: CalendarInviteRow): CalendarInvite {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    code: row.code,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

interface CalendarMembershipRow {
  calendar_id: string;
  user_id: string;
  role: CalendarMembership["role"];
  joined_at: string;
  profiles?: { display_name: string | null } | null;
}

function mapCalendarMembershipRow(row: CalendarMembershipRow): CalendarMembership {
  return {
    calendarId: row.calendar_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    displayName: row.profiles?.display_name ?? null,
  };
}

function mapCalendarError(error: PostgrestError): CalendarError {
  if (error.code === "23514") {
    return { type: "ValidationError", field: "name" };
  }
  if (error.code === "A0001") {
    return { type: "NotFound" };
  }
  if (error.code === "A0002") {
    return { type: "InviteExpired" };
  }
  return { type: "Forbidden" };
}

export async function createCalendar(
  client: SupabaseClient,
  input: CreateCalendarInput
): Promise<Result<Calendar, CalendarError>> {
  if (!input.name.trim()) {
    return err({ type: "ValidationError", field: "name" });
  }

  const payload: Record<string, unknown> = { name: input.name, kind: "group" };
  if (input.color !== undefined) payload.color = input.color;

  const { data, error } = await client.from("calendars").insert(payload).select().single();

  if (error || !data) {
    return err(mapCalendarError(error as PostgrestError));
  }

  return ok(mapCalendarRow(data as CalendarRow));
}

export async function getPersonalCalendar(
  client: SupabaseClient
): Promise<Result<Calendar, CalendarError>> {
  const { data, error } = await client.from("calendars").select().eq("kind", "personal").maybeSingle();

  if (error) {
    return err(mapCalendarError(error as PostgrestError));
  }
  if (!data) {
    return err({ type: "NotFound" });
  }

  return ok(mapCalendarRow(data as CalendarRow));
}

export async function updateCalendar(
  client: SupabaseClient,
  calendarId: string,
  input: UpdateCalendarInput
): Promise<Result<Calendar, CalendarError>> {
  if (input.name !== undefined && !input.name.trim()) {
    return err({ type: "ValidationError", field: "name" });
  }

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.color !== undefined) payload.color = input.color;

  const { data, error } = await client
    .from("calendars")
    .update(payload)
    .eq("id", calendarId)
    .select()
    .single();

  if (error || !data) {
    return err(mapCalendarError(error as PostgrestError));
  }

  return ok(mapCalendarRow(data as CalendarRow));
}

export async function createInvite(
  client: SupabaseClient,
  calendarId: string
): Promise<Result<CalendarInvite, CalendarError>> {
  const { data, error } = await client
    .from("calendar_invites")
    .insert({ calendar_id: calendarId })
    .select()
    .single();

  if (error || !data) {
    return err(mapCalendarError(error as PostgrestError));
  }

  return ok(mapCalendarInviteRow(data as CalendarInviteRow));
}

export async function joinByInvite(
  client: SupabaseClient,
  inviteCode: string
): Promise<Result<CalendarMembership, CalendarError>> {
  const { data, error } = await client
    .rpc("join_by_invite", { p_code: inviteCode })
    .single();

  if (error || !data) {
    return err(mapCalendarError(error as PostgrestError));
  }

  return ok(mapCalendarMembershipRow(data as CalendarMembershipRow));
}

/** Leaves a group calendar the caller belongs to. Removes only the caller's
 * own membership if other members remain, or deletes the whole calendar
 * (cascading to its events, members, etc.) if the caller was the only one.
 * Returns true when the calendar itself was deleted, false when the caller
 * just left it. Personal calendars can't be targeted (server-enforced). */
export async function leaveOrDeleteCalendar(
  client: SupabaseClient,
  calendarId: string
): Promise<Result<boolean, CalendarError>> {
  const { data, error } = await client.rpc("leave_or_delete_calendar", { p_calendar_id: calendarId });

  if (error || data === null || data === undefined) {
    return err(mapCalendarError(error as PostgrestError));
  }

  return ok(data as boolean);
}

export async function listMyCalendars(
  client: SupabaseClient
): Promise<Result<Calendar[], CalendarError>> {
  const { data, error } = await client.from("calendars").select();

  if (error || !data) {
    return err(mapCalendarError(error as PostgrestError));
  }

  const calendars = (data as CalendarRow[]).map(mapCalendarRow);
  // The personal calendar always sorts first, so it reads as "always there"
  // wherever the list is rendered (switcher chips, settings, etc.).
  calendars.sort((a, b) => (a.kind === "personal" ? -1 : b.kind === "personal" ? 1 : 0));

  return ok(calendars);
}

export async function listMembers(
  client: SupabaseClient,
  calendarId: string
): Promise<Result<CalendarMember[], CalendarError>> {
  const { data, error } = await client
    .from("calendar_members")
    .select("*, profiles(display_name)")
    .eq("calendar_id", calendarId);

  if (error || !data) {
    return err(mapCalendarError(error as PostgrestError));
  }

  return ok((data as CalendarMembershipRow[]).map(mapCalendarMembershipRow));
}

export async function removeMember(
  client: SupabaseClient,
  calendarId: string,
  userId: string
): Promise<Result<void, CalendarError>> {
  const { error } = await client
    .from("calendar_members")
    .delete()
    .eq("calendar_id", calendarId)
    .eq("user_id", userId);

  if (error) {
    return err(mapCalendarError(error));
  }

  return ok(undefined);
}

export function getCalendarErrorMessageJa(error: CalendarError): string {
  switch (error.type) {
    case "NotFound":
      return "カレンダーが見つかりません";
    case "Forbidden":
      return "この操作を行う権限がありません";
    case "InviteExpired":
      return "招待コードが無効か、有効期限が切れています";
    case "ValidationError":
      if (error.field === "name") {
        return "カレンダー名を入力してください";
      }
      return "入力内容を確認してください";
    default:
      return "エラーが発生しました。しばらくしてから再度お試しください";
  }
}
