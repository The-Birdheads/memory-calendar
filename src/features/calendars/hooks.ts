import { useCallback, useEffect, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  createCalendar,
  createInvite,
  getPersonalCalendar,
  joinByInvite,
  leaveOrDeleteCalendar,
  listMembers,
  listMembersForCalendars,
  listMyCalendars,
  removeMember,
  updateCalendar,
} from "./service";
import type {
  Calendar,
  CalendarError,
  CalendarInvite,
  CalendarMember,
  CreateCalendarInput,
  UpdateCalendarInput,
} from "./types";

export interface UseCreateCalendarResult {
  createCalendar: (input: CreateCalendarInput) => Promise<Calendar | null>;
  isSubmitting: boolean;
  error: CalendarError | null;
}

export function useCreateCalendar(): UseCreateCalendarResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CalendarError | null>(null);

  const runCreateCalendar = useCallback(async (input: CreateCalendarInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createCalendar(getSupabaseClient(), input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { createCalendar: runCreateCalendar, isSubmitting, error };
}

export interface UseUpdateCalendarResult {
  updateCalendar: (calendarId: string, input: UpdateCalendarInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: CalendarError | null;
}

export function useUpdateCalendar(): UseUpdateCalendarResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CalendarError | null>(null);

  const runUpdateCalendar = useCallback(async (calendarId: string, input: UpdateCalendarInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateCalendar(getSupabaseClient(), calendarId, input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { updateCalendar: runUpdateCalendar, isSubmitting, error };
}

export interface UseCreateInviteResult {
  createInvite: (calendarId: string) => Promise<CalendarInvite | null>;
  isSubmitting: boolean;
  error: CalendarError | null;
}

export function useCreateInvite(): UseCreateInviteResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CalendarError | null>(null);

  const runCreateInvite = useCallback(async (calendarId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createInvite(getSupabaseClient(), calendarId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { createInvite: runCreateInvite, isSubmitting, error };
}

export interface UseJoinByInviteResult {
  joinByInvite: (inviteCode: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: CalendarError | null;
}

export function useJoinByInvite(): UseJoinByInviteResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CalendarError | null>(null);

  const runJoinByInvite = useCallback(async (inviteCode: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await joinByInvite(getSupabaseClient(), inviteCode);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { joinByInvite: runJoinByInvite, isSubmitting, error };
}

export interface UseMyCalendarsResult {
  calendars: Calendar[];
  isLoading: boolean;
  error: CalendarError | null;
  refetch: () => Promise<void>;
}

export function useMyCalendars(): UseMyCalendarsResult {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<CalendarError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listMyCalendars(getSupabaseClient());
    if (result.ok) {
      setCalendars(result.value);
      setError(null);
    } else {
      setCalendars([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { calendars, isLoading, error, refetch };
}

export interface UsePersonalCalendarResult {
  calendar: Calendar | null;
  isLoading: boolean;
  error: CalendarError | null;
  refetch: () => Promise<void>;
}

export function usePersonalCalendar(): UsePersonalCalendarResult {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<CalendarError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await getPersonalCalendar(getSupabaseClient());
    if (result.ok) {
      setCalendar(result.value);
      setError(null);
    } else {
      setCalendar(null);
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { calendar, isLoading, error, refetch };
}

export interface UseCalendarMembersResult {
  members: CalendarMember[];
  isLoading: boolean;
  error: CalendarError | null;
  refetch: () => Promise<void>;
}

export function useCalendarMembers(calendarId: string): UseCalendarMembersResult {
  const [members, setMembers] = useState<CalendarMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<CalendarError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listMembers(getSupabaseClient(), calendarId);
    if (result.ok) {
      setMembers(result.value);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }, [calendarId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // メンバーの追加/削除だけでなく、メンバーの表示名(プロフィール設定で
  // 変更可能)が変わった時も「◯◯さんが追加」等の表示に反映されるよう、
  // profilesテーブルの変更も購読する(calendar_id列を持たないため絞り込み
  // なしで購読する - 2026-09、名前を変更しても画面を開き直すまで反映
  // されなかった不具合の修正)。
  useEffect(() => {
    const unsubscribeMembers = subscribeToTableChanges(
      getSupabaseClient(),
      `calendar-members-${calendarId}`,
      "calendar_members",
      refetch,
      `calendar_id=eq.${calendarId}`
    );
    const unsubscribeProfiles = subscribeToTableChanges(
      getSupabaseClient(),
      "calendar-members-profiles",
      "profiles",
      refetch
    );
    return () => {
      unsubscribeMembers();
      unsubscribeProfiles();
    };
  }, [calendarId, refetch]);

  return { members, isLoading, error, refetch };
}

export interface UseCalendarMembersByCalendarsResult {
  members: CalendarMember[];
  isLoading: boolean;
  error: CalendarError | null;
  refetch: () => Promise<void>;
}

/** Same as useCalendarMembers but across several calendars at once - for
 * screens (like the meal tab) that show items from more than one calendar
 * and need to resolve a creator's display name regardless of which one. */
export function useCalendarMembersByCalendars(calendarIds: string[]): UseCalendarMembersByCalendarsResult {
  const [members, setMembers] = useState<CalendarMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<CalendarError | null>(null);
  const calendarIdsKey = calendarIds.join(",");

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listMembersForCalendars(getSupabaseClient(), calendarIds);
    if (result.ok) {
      setMembers(result.value);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calendarIdsKey stands in for calendarIds.
  }, [calendarIdsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // useCalendarMembers同様、メンバーの追加/削除に加え表示名の変更も反映する。
  useEffect(() => {
    if (calendarIds.length === 0) return;
    const unsubscribeMembers = calendarIds.map((calendarId) =>
      subscribeToTableChanges(
        getSupabaseClient(),
        `calendar-members-by-calendars-${calendarId}`,
        "calendar_members",
        refetch,
        `calendar_id=eq.${calendarId}`
      )
    );
    const unsubscribeProfiles = subscribeToTableChanges(
      getSupabaseClient(),
      "calendar-members-by-calendars-profiles",
      "profiles",
      refetch
    );
    return () => {
      unsubscribeMembers.forEach((unsubscribe) => unsubscribe());
      unsubscribeProfiles();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calendarIdsKey stands in for calendarIds (see refetch above).
  }, [calendarIdsKey, refetch]);

  return { members, isLoading, error, refetch };
}

export interface UseRemoveMemberResult {
  removeMember: (calendarId: string, userId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: CalendarError | null;
}

export function useRemoveMember(): UseRemoveMemberResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CalendarError | null>(null);

  const runRemoveMember = useCallback(async (calendarId: string, userId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await removeMember(getSupabaseClient(), calendarId, userId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { removeMember: runRemoveMember, isSubmitting, error };
}

export interface UseLeaveOrDeleteCalendarResult {
  leaveOrDeleteCalendar: (calendarId: string) => Promise<boolean | null>;
  isSubmitting: boolean;
  error: CalendarError | null;
}

export function useLeaveOrDeleteCalendar(): UseLeaveOrDeleteCalendarResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CalendarError | null>(null);

  const runLeaveOrDeleteCalendar = useCallback(async (calendarId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await leaveOrDeleteCalendar(getSupabaseClient(), calendarId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { leaveOrDeleteCalendar: runLeaveOrDeleteCalendar, isSubmitting, error };
}
