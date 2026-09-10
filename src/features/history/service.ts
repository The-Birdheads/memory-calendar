import type { SupabaseClient } from "@supabase/supabase-js";

import { mapEventRow, type EventRow } from "../events/service";
import type { Event } from "../events/types";
import { err, ok, type Result } from "../../shared/types/result";
import type { HistoryError } from "./types";

export async function listPastEventsByTag(
  client: SupabaseClient,
  tagId?: string,
  calendarIds?: string[]
): Promise<Result<Event[], HistoryError>> {
  const { data, error } = await client.rpc("list_past_events_by_tag", {
    // undefined (caller passed no calendar filter at all) -> null = no
    // filter, show every calendar. An actual [] (the user deliberately
    // deselected every calendar in the filter) must be passed through as
    // [] - it means "show nothing", not "no filter given".
    p_calendar_ids: calendarIds ?? null,
    p_tag_id: tagId ?? null,
  });

  if (error || !data) {
    return err({ type: "Forbidden" });
  }

  return ok((data as EventRow[]).map(mapEventRow));
}
