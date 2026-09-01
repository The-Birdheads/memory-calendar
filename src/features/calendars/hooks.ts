import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  createCalendar,
  createInvite,
  joinByInvite,
  listMembers,
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
