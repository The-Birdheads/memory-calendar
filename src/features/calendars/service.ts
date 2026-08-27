import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type {
  Calendar,
  CalendarError,
  CalendarInvite,
  CalendarMember,
  CalendarMembership,
  CreateCalendarInput,
} from "./types";

interface CalendarRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

function mapCalendarRow(row: CalendarRow): Calendar {
  return {
    id: row.id,
    name: row.name,
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

  const { data, error } = await client
    .from("calendars")
    .insert({ name: input.name })
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

export async function listMyCalendars(
  client: SupabaseClient
): Promise<Result<Calendar[], CalendarError>> {
  const { data, error } = await client.from("calendars").select();

  if (error || !data) {
    return err(mapCalendarError(error as PostgrestError));
  }

  return ok((data as CalendarRow[]).map(mapCalendarRow));
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
