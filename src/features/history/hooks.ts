import { useCallback, useEffect, useState } from "react";

import type { Event } from "../events/types";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { listPastEventsByTag } from "./service";
import type { HistoryError } from "./types";

export interface UsePastEventsByTagResult {
  events: Event[];
  isLoading: boolean;
  error: HistoryError | null;
  refetch: () => Promise<void>;
}

export function usePastEventsByTag(tagId?: string, calendarIds?: string[]): UsePastEventsByTagResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HistoryError | null>(null);
  const calendarIdsKey = calendarIds?.join(",") ?? "";

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listPastEventsByTag(getSupabaseClient(), tagId, calendarIds);
    if (result.ok) {
      setEvents(result.value);
      setError(null);
    } else {
      setEvents([]);
      setError(result.error);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId, calendarIdsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { events, isLoading, error, refetch };
}
