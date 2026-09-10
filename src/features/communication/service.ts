import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { CommunicationError, EventComment, EventReaction } from "./types";

interface EventCommentRow {
  id: string;
  event_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
}

function mapEventCommentRow(row: EventCommentRow): EventComment {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

interface EventReactionRow {
  id: string;
  event_id: string;
  user_id: string;
  stamp_type: string;
  created_at: string;
}

function mapEventReactionRow(row: EventReactionRow): EventReaction {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    stampType: row.stamp_type,
    createdAt: row.created_at,
  };
}

function mapCommunicationError(error: PostgrestError): CommunicationError {
  return { type: "Forbidden" };
}

export async function postComment(
  client: SupabaseClient,
  eventId: string,
  body: string
): Promise<Result<EventComment, CommunicationError>> {
  if (!body.trim()) {
    return err({ type: "ValidationError", field: "body" });
  }

  const { data, error } = await client
    .from("event_comments")
    .insert({ event_id: eventId, body })
    .select()
    .single();

  if (error || !data) {
    return err(mapCommunicationError(error as PostgrestError));
  }

  return ok(mapEventCommentRow(data as EventCommentRow));
}

export async function listComments(
  client: SupabaseClient,
  eventId: string
): Promise<Result<EventComment[], CommunicationError>> {
  const { data, error } = await client
    .from("event_comments")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return err(mapCommunicationError(error as PostgrestError));
  }

  return ok((data as EventCommentRow[]).map(mapEventCommentRow));
}

export async function deleteComment(
  client: SupabaseClient,
  commentId: string
): Promise<Result<void, CommunicationError>> {
  const { error } = await client.from("event_comments").delete().eq("id", commentId);

  if (error) {
    return err(mapCommunicationError(error));
  }

  return ok(undefined);
}

/**
 * A user may have at most one active reaction per event. Pressing a stamp:
 * - with no existing reaction: adds it.
 * - with an existing reaction of the SAME stamp: removes it (toggle off).
 * - with an existing reaction of a DIFFERENT stamp: switches to the new one.
 * The caller passes in the current user's existing reaction (if any, already
 * available from the fetched reactions list) so this stays a single request.
 */
export async function toggleReaction(
  client: SupabaseClient,
  eventId: string,
  stampType: string,
  currentReaction: EventReaction | null
): Promise<Result<EventReaction | null, CommunicationError>> {
  if (currentReaction && currentReaction.stampType === stampType) {
    const { error } = await client.from("event_reactions").delete().eq("id", currentReaction.id);

    if (error) {
      return err(mapCommunicationError(error));
    }

    return ok(null);
  }

  if (currentReaction) {
    const { data, error } = await client
      .from("event_reactions")
      .update({ stamp_type: stampType })
      .eq("id", currentReaction.id)
      .select()
      .single();

    if (error || !data) {
      return err(mapCommunicationError(error as PostgrestError));
    }

    return ok(mapEventReactionRow(data as EventReactionRow));
  }

  const { data, error } = await client
    .from("event_reactions")
    .insert({ event_id: eventId, stamp_type: stampType })
    .select()
    .single();

  if (error || !data) {
    return err(mapCommunicationError(error as PostgrestError));
  }

  return ok(mapEventReactionRow(data as EventReactionRow));
}

export async function listReactions(
  client: SupabaseClient,
  eventId: string
): Promise<Result<EventReaction[], CommunicationError>> {
  const { data, error } = await client
    .from("event_reactions")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return err(mapCommunicationError(error as PostgrestError));
  }

  return ok((data as EventReactionRow[]).map(mapEventReactionRow));
}
