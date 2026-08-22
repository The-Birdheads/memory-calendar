import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { CreateTagInput, Tag, TagError, TagTreeNode, UpdateTagInput } from "./types";

interface TagRow {
  id: string;
  calendar_id: string;
  parent_id: string | null;
  level: Tag["level"];
  name: string;
  color: string;
  created_at: string;
}

function mapTagRow(row: TagRow): Tag {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    parentId: row.parent_id,
    level: row.level,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

function mapTagError(error: PostgrestError): TagError {
  if (error.code === "23514" || error.code === "A0004") {
    return { type: "InvalidHierarchy" };
  }
  return { type: "Forbidden" };
}

function buildTagTree(tags: Tag[]): TagTreeNode[] {
  const nodeById = new Map<string, TagTreeNode>();
  tags.forEach((tag) => nodeById.set(tag.id, { ...tag, children: [] }));

  const roots: TagTreeNode[] = [];
  tags.forEach((tag) => {
    const node = nodeById.get(tag.id) as TagTreeNode;
    const parent = tag.parentId ? nodeById.get(tag.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export async function createTag(
  client: SupabaseClient,
  input: CreateTagInput
): Promise<Result<Tag, TagError>> {
  const parentId = input.parentId ?? null;

  if (input.level === "major" && parentId !== null) {
    return err({ type: "InvalidHierarchy" });
  }
  if (input.level !== "major" && parentId === null) {
    return err({ type: "InvalidHierarchy" });
  }

  const { data, error } = await client
    .from("tags")
    .insert({
      calendar_id: input.calendarId,
      name: input.name,
      color: input.color,
      level: input.level,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error || !data) {
    return err(mapTagError(error as PostgrestError));
  }

  return ok(mapTagRow(data as TagRow));
}

export async function updateTag(
  client: SupabaseClient,
  tagId: string,
  input: UpdateTagInput
): Promise<Result<Tag, TagError>> {
  if (input.level !== undefined && input.parentId !== undefined) {
    if (input.level === "major" && input.parentId !== null) {
      return err({ type: "InvalidHierarchy" });
    }
    if (input.level !== "major" && input.parentId === null) {
      return err({ type: "InvalidHierarchy" });
    }
  }

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.color !== undefined) payload.color = input.color;
  if (input.level !== undefined) payload.level = input.level;
  if (input.parentId !== undefined) payload.parent_id = input.parentId;

  const { data, error } = await client
    .from("tags")
    .update(payload)
    .eq("id", tagId)
    .select()
    .single();

  if (error || !data) {
    return err(mapTagError(error as PostgrestError));
  }

  return ok(mapTagRow(data as TagRow));
}

export async function listTagTree(
  client: SupabaseClient,
  calendarId: string
): Promise<Result<TagTreeNode[], TagError>> {
  const { data, error } = await client
    .from("tags")
    .select()
    .eq("calendar_id", calendarId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return err(mapTagError(error as PostgrestError));
  }

  return ok(buildTagTree((data as TagRow[]).map(mapTagRow)));
}

export async function attachTagsToEvent(
  client: SupabaseClient,
  eventId: string,
  tagIds: string[]
): Promise<Result<void, TagError>> {
  if (tagIds.length === 0) {
    return ok(undefined);
  }

  const { error } = await client
    .from("event_tags")
    .insert(tagIds.map((tagId) => ({ event_id: eventId, tag_id: tagId })));

  if (error) {
    return err(mapTagError(error));
  }

  return ok(undefined);
}

export async function listTagsForEvent(
  client: SupabaseClient,
  eventId: string
): Promise<Result<Tag[], TagError>> {
  const { data, error } = await client.from("event_tags").select("tags(*)").eq("event_id", eventId);

  if (error || !data) {
    return err(mapTagError(error as PostgrestError));
  }

  return ok((data as unknown as { tags: TagRow }[]).map((row) => mapTagRow(row.tags)));
}

export async function deleteTag(
  client: SupabaseClient,
  tagId: string
): Promise<Result<void, TagError>> {
  const { error } = await client.from("tags").delete().eq("id", tagId);

  if (error) {
    return err(mapTagError(error));
  }

  return ok(undefined);
}
