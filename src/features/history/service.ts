import type { SupabaseClient } from "@supabase/supabase-js";

import { mapEventRow, type EventRow } from "../events/service";
import type { Event } from "../events/types";
import { err, ok, type Result } from "../../shared/types/result";
import type { HistoryError } from "./types";

export async function listPastEventsByTag(
  client: SupabaseClient,
  calendarId: string,
  tagId?: string
): Promise<Result<Event[], HistoryError>> {
  const { data, error } = await client.rpc("list_past_events_by_tag", {
    p_calendar_id: calendarId,
    p_tag_id: tagId ?? null,
  });

  if (error || !data) {
    return err({ type: "Forbidden" });
  }

  return ok((data as EventRow[]).map(mapEventRow));
}
