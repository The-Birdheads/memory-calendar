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

export function usePastEventsByTag(calendarId: string, tagId?: string): UsePastEventsByTagResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HistoryError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listPastEventsByTag(getSupabaseClient(), calendarId, tagId);
    if (result.ok) {
      setEvents(result.value);
      setError(null);
    } else {
      setEvents([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [calendarId, tagId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { events, isLoading, error, refetch };
}
