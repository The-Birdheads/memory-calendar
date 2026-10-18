import type { SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { AssigneeError } from "./types";

/** 予定に設定されている対象者のユーザーID。 */
export async function listEventAssigneeIds(
  client: SupabaseClient,
  eventId: string
): Promise<Result<string[], AssigneeError>> {
  const { data, error } = await client.from("event_assignees").select("user_id").eq("event_id", eventId);

  if (error || !data) {
    return err({ type: "Forbidden" });
  }

  return ok((data as { user_id: string }[]).map((row) => row.user_id));
}

/**
 * 予定の対象者を、渡したユーザーIDの一覧に揃える。今の設定との差分だけを
 * 登録・削除する(変わらない人の行には触れない)。
 */
export async function setEventAssignees(
  client: SupabaseClient,
  eventId: string,
  userIds: string[]
): Promise<Result<void, AssigneeError>> {
  const wanted = Array.from(new Set(userIds));

  const current = await listEventAssigneeIds(client, eventId);
  if (!current.ok) {
    return current;
  }

  const toRemove = current.value.filter((id) => !wanted.includes(id));
  const toAdd = wanted.filter((id) => !current.value.includes(id));

  if (toRemove.length > 0) {
    const { error } = await client.from("event_assignees").delete().eq("event_id", eventId).in("user_id", toRemove);
    if (error) {
      return err({ type: "Forbidden" });
    }
  }

  if (toAdd.length > 0) {
    const { error } = await client
      .from("event_assignees")
      .insert(toAdd.map((userId) => ({ event_id: eventId, user_id: userId })));
    if (error) {
      return err({ type: "Forbidden" });
    }
  }

  return ok(undefined);
}
