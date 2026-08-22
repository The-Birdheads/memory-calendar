import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { listMembers, listMyCalendars, removeMember } from "./service";
import type { Calendar, CalendarError, CalendarMember } from "./types";

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
