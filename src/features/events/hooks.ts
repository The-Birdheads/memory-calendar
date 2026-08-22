import { useCallback, useEffect, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { createEvent, deleteEvent, getEvent, listEventsInRange, setReminderTargets, updateEvent } from "./service";
import type {
  CreateEventInput,
  DateRange,
  EditScope,
  Event,
  EventError,
  ReminderTargetsInput,
  UpdateEventInput,
} from "./types";

export interface UseCreateEventResult {
  createEvent: (input: CreateEventInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: EventError | null;
}

export function useCreateEvent(): UseCreateEventResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<EventError | null>(null);

  const runCreateEvent = useCallback(async (input: CreateEventInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createEvent(getSupabaseClient(), input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { createEvent: runCreateEvent, isSubmitting, error };
}

export interface UseUpdateEventResult {
  updateEvent: (eventId: string, input: UpdateEventInput, scope?: EditScope) => Promise<boolean>;
  isSubmitting: boolean;
  error: EventError | null;
}

export function useUpdateEvent(): UseUpdateEventResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<EventError | null>(null);

  const runUpdateEvent = useCallback(
    async (eventId: string, input: UpdateEventInput, scope: EditScope = "this") => {
      setIsSubmitting(true);
      setError(null);
      const result = await updateEvent(getSupabaseClient(), eventId, input, scope);
      setIsSubmitting(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      return true;
    },
    []
  );

  return { updateEvent: runUpdateEvent, isSubmitting, error };
}

export interface UseDeleteEventResult {
  deleteEvent: (eventId: string, scope?: EditScope) => Promise<boolean>;
  isSubmitting: boolean;
  error: EventError | null;
}

export function useDeleteEvent(): UseDeleteEventResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<EventError | null>(null);

  const runDeleteEvent = useCallback(async (eventId: string, scope: EditScope = "this") => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteEvent(getSupabaseClient(), eventId, scope);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { deleteEvent: runDeleteEvent, isSubmitting, error };
}

export interface UseEventsInRangeResult {
  events: Event[];
  isLoading: boolean;
  error: EventError | null;
  refetch: () => Promise<void>;
}

export function useEventsInRange(calendarId: string, range: DateRange): UseEventsInRangeResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<EventError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listEventsInRange(getSupabaseClient(), calendarId, range);
    if (result.ok) {
      setEvents(result.value);
      setError(null);
    } else {
      setEvents([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [calendarId, range.start, range.end]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    return subscribeToTableChanges(
      getSupabaseClient(),
      `events-${calendarId}`,
      "events",
      refetch,
      `calendar_id=eq.${calendarId}`
    );
  }, [calendarId, refetch]);

  return { events, isLoading, error, refetch };
}

export interface UseSetReminderTargetsResult {
  setReminderTargets: (eventId: string, userIds: ReminderTargetsInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: EventError | null;
}

export function useSetReminderTargets(): UseSetReminderTargetsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<EventError | null>(null);

  const runSetReminderTargets = useCallback(async (eventId: string, userIds: ReminderTargetsInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await setReminderTargets(getSupabaseClient(), eventId, userIds);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { setReminderTargets: runSetReminderTargets, isSubmitting, error };
}

export interface UseEventResult {
  event: Event | null;
  isLoading: boolean;
  error: EventError | null;
  refetch: () => Promise<void>;
}

export function useEvent(eventId: string): UseEventResult {
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<EventError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await getEvent(getSupabaseClient(), eventId);
    if (result.ok) {
      setEvent(result.value);
      setError(null);
    } else {
      setEvent(null);
      setError(result.error);
    }
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { event, isLoading, error, refetch };
}
