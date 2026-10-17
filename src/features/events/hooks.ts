import { useCallback, useEffect, useRef, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  addEventReminder,
  createEventReminders,
  createEvent,
  deleteEvent,
  getEvent,
  listEventReminders,
  listEventsInRange,
  listEventsInRangeForCalendars,
  removeEventReminder,
  updateEvent,
} from "./service";
import type {
  CreateEventInput,
  DateRange,
  EditScope,
  Event,
  EventError,
  EventReminder,
  EventReminderCustomOffset,
  EventReminderDraft,
  EventReminderKind,
  EventWithTagColor,
  UpdateEventInput,
} from "./types";

export interface UseCreateEventResult {
  createEvent: (input: CreateEventInput) => Promise<Event | null>;
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
      return null;
    }
    return result.value;
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
  events: EventWithTagColor[];
  isLoading: boolean;
  error: EventError | null;
  refetch: () => Promise<void>;
}

export function useEventsInRange(calendarId: string, range: DateRange): UseEventsInRangeResult {
  const [events, setEvents] = useState<EventWithTagColor[]>([]);
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

function eventsRangeCacheKey(calendarIdsKey: string, range: DateRange): string {
  return `${calendarIdsKey}|${range.start}|${range.end}`;
}

/** Same as useEventsInRange but overlays events from several calendars at once
 * (e.g. the Calendar tab's multi-select view).
 *
 * `prefetchRanges` (optional) lets the caller keep nearby ranges warm in the
 * background - e.g. the calendar screen passes the adjacent month's padded
 * range, so swiping there shows its events immediately instead of a fresh
 * loading state (2026-09, the month switch otherwise always felt slow).
 * Prefetched/visited ranges are cached for this hook instance's lifetime
 * (cleared automatically when the component unmounts, and on any realtime
 * change so a stale cached range is never served silently forever). Serving
 * a cached range is "stale-while-revalidate": the cached events show right
 * away with no loading flag, while a fresh fetch still runs in the
 * background to correct it if anything changed.
 */
export function useEventsInRangeForCalendars(
  calendarIds: string[],
  range: DateRange,
  prefetchRanges: DateRange[] = []
): UseEventsInRangeResult {
  const [events, setEvents] = useState<EventWithTagColor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<EventError | null>(null);
  const calendarIdsKey = calendarIds.join(",");
  const cacheRef = useRef(new Map<string, EventWithTagColor[]>());

  const refetch = useCallback(async () => {
    const cacheKey = eventsRangeCacheKey(calendarIdsKey, range);
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setEvents(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const result = await listEventsInRangeForCalendars(getSupabaseClient(), calendarIds, range);
    if (result.ok) {
      cacheRef.current.set(cacheKey, result.value);
      setEvents(result.value);
      setError(null);
    } else {
      if (!cached) setEvents([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [calendarIdsKey, range.start, range.end]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const prefetchRangesKey = prefetchRanges.map((r) => `${r.start}|${r.end}`).join(",");
  useEffect(() => {
    if (calendarIds.length === 0) return;
    prefetchRanges.forEach(async (prefetchRange) => {
      const cacheKey = eventsRangeCacheKey(calendarIdsKey, prefetchRange);
      if (cacheRef.current.has(cacheKey)) return;
      const result = await listEventsInRangeForCalendars(getSupabaseClient(), calendarIds, prefetchRange);
      if (result.ok) {
        cacheRef.current.set(cacheKey, result.value);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefetchRangesKey stands in for prefetchRanges (see calendarIdsKey above); calendarIds is covered by calendarIdsKey.
  }, [calendarIdsKey, prefetchRangesKey]);

  useEffect(() => {
    if (calendarIds.length === 0) return;
    const unsubscribers = calendarIds.map((calendarId) =>
      subscribeToTableChanges(
        getSupabaseClient(),
        `events-overlay-${calendarId}`,
        "events",
        () => {
          // A change could affect any cached/prefetched range, not just the
          // one currently on screen - drop them all rather than serving a
          // stale range next time the caller navigates there.
          cacheRef.current.clear();
          refetch();
        },
        `calendar_id=eq.${calendarId}`
      )
    );
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [calendarIdsKey, refetch]);

  return { events, isLoading, error, refetch };
}

export interface UseEventRemindersResult {
  reminders: EventReminder[];
  isLoading: boolean;
  error: EventError | null;
  refetch: () => Promise<void>;
}

/** The current user's own reminder settings for an event - entirely
 * personal, other members' settings are never fetched or shown. */
export function useEventReminders(eventId: string): UseEventRemindersResult {
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<EventError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listEventReminders(getSupabaseClient(), eventId);
    if (result.ok) {
      setReminders(result.value);
      setError(null);
    } else {
      setReminders([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { reminders, isLoading, error, refetch };
}

export interface UseAddEventReminderResult {
  addEventReminder: (eventId: string, kind: EventReminderKind, custom?: EventReminderCustomOffset) => Promise<boolean>;
  isSubmitting: boolean;
  error: EventError | null;
}

export function useAddEventReminder(): UseAddEventReminderResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<EventError | null>(null);

  const runAddEventReminder = useCallback(
    async (eventId: string, kind: EventReminderKind, custom?: EventReminderCustomOffset) => {
      setIsSubmitting(true);
      setError(null);
      const result = await addEventReminder(getSupabaseClient(), eventId, kind, custom);
      setIsSubmitting(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      return true;
    },
    []
  );

  return { addEventReminder: runAddEventReminder, isSubmitting, error };
}

export interface UseRemoveEventReminderResult {
  removeEventReminder: (reminderId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: EventError | null;
}

export function useRemoveEventReminder(): UseRemoveEventReminderResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<EventError | null>(null);

  const runRemoveEventReminder = useCallback(async (reminderId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await removeEventReminder(getSupabaseClient(), reminderId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { removeEventReminder: runRemoveEventReminder, isSubmitting, error };
}

export interface UseCreateEventRemindersResult {
  createEventReminders: (eventId: string, reminders: EventReminderDraft[]) => Promise<boolean>;
  isSubmitting: boolean;
  error: EventError | null;
}

/** Registers the reminders picked in the create form right after the event exists. */
export function useCreateEventReminders(): UseCreateEventRemindersResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<EventError | null>(null);

  const runCreateEventReminders = useCallback(async (eventId: string, reminders: EventReminderDraft[]) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createEventReminders(getSupabaseClient(), eventId, reminders);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { createEventReminders: runCreateEventReminders, isSubmitting, error };
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
