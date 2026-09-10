import { useCallback, useEffect, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  attachTagsToEvent,
  createTag,
  deleteTag,
  detachTagFromEvent,
  listTagsForEvent,
  listTagsForEvents,
  listTagTree,
  updateTag,
} from "./service";
import type { CreateTagInput, Tag, TagError, TagTreeNode, UpdateTagInput } from "./types";

export interface UseTagTreeResult {
  tagTree: TagTreeNode[];
  isLoading: boolean;
  error: TagError | null;
  refetch: () => Promise<void>;
}

export function useTagTree(): UseTagTreeResult {
  const [tagTree, setTagTree] = useState<TagTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TagError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listTagTree(getSupabaseClient());
    if (result.ok) {
      setTagTree(result.value);
      setError(null);
    } else {
      setTagTree([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    return subscribeToTableChanges(getSupabaseClient(), "tags-mine", "tags", refetch);
  }, [refetch]);

  return { tagTree, isLoading, error, refetch };
}

export interface UseCreateTagResult {
  createTag: (input: CreateTagInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: TagError | null;
}

export function useCreateTag(): UseCreateTagResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TagError | null>(null);

  const runCreateTag = useCallback(async (input: CreateTagInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createTag(getSupabaseClient(), input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { createTag: runCreateTag, isSubmitting, error };
}

export interface UseEventTagsResult {
  tags: Tag[];
  isLoading: boolean;
  error: TagError | null;
  refetch: () => Promise<void>;
}

export function useEventTags(eventId: string): UseEventTagsResult {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TagError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listTagsForEvent(getSupabaseClient(), eventId);
    if (result.ok) {
      setTags(result.value);
      setError(null);
    } else {
      setTags([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tags, isLoading, error, refetch };
}

export interface UseEventTagsByEventsResult {
  tagsByEventId: Record<string, Tag[]>;
  isLoading: boolean;
  error: TagError | null;
  refetch: () => Promise<void>;
}

/**
 * Batched version of useEventTags, for list screens (e.g. the ToDo tab) that
 * show many events at once - one query for all of them instead of one hook
 * instance (and one query) per event.
 */
export function useEventTagsByEvents(eventIds: string[]): UseEventTagsByEventsResult {
  const [tagsByEventId, setTagsByEventId] = useState<Record<string, Tag[]>>({});
  const [isLoading, setIsLoading] = useState(eventIds.length > 0);
  const [error, setError] = useState<TagError | null>(null);
  // Depend on a stable, order-sensitive key derived from the ids rather than
  // the array reference itself, since callers typically pass a freshly
  // mapped array each render - keying on the array identity would refetch
  // (and re-run this effect) every single render.
  const eventIdsKey = eventIds.join(",");

  const refetch = useCallback(async () => {
    if (eventIds.length === 0) {
      setTagsByEventId({});
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await listTagsForEvents(getSupabaseClient(), eventIds);
    if (result.ok) {
      setTagsByEventId(result.value);
      setError(null);
    } else {
      setTagsByEventId({});
      setError(result.error);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tagsByEventId, isLoading, error, refetch };
}

export interface UseAttachTagsToEventResult {
  attachTagsToEvent: (eventId: string, tagIds: string[]) => Promise<boolean>;
  isSubmitting: boolean;
  error: TagError | null;
}

export function useAttachTagsToEvent(): UseAttachTagsToEventResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TagError | null>(null);

  const runAttachTagsToEvent = useCallback(async (eventId: string, tagIds: string[]) => {
    setIsSubmitting(true);
    setError(null);
    const result = await attachTagsToEvent(getSupabaseClient(), eventId, tagIds);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { attachTagsToEvent: runAttachTagsToEvent, isSubmitting, error };
}

export interface UseDetachTagFromEventResult {
  detachTagFromEvent: (eventId: string, tagId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: TagError | null;
}

export function useDetachTagFromEvent(): UseDetachTagFromEventResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TagError | null>(null);

  const runDetachTagFromEvent = useCallback(async (eventId: string, tagId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await detachTagFromEvent(getSupabaseClient(), eventId, tagId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { detachTagFromEvent: runDetachTagFromEvent, isSubmitting, error };
}

export interface UseUpdateTagResult {
  updateTag: (tagId: string, input: UpdateTagInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: TagError | null;
}

export function useUpdateTag(): UseUpdateTagResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TagError | null>(null);

  const runUpdateTag = useCallback(async (tagId: string, input: UpdateTagInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateTag(getSupabaseClient(), tagId, input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { updateTag: runUpdateTag, isSubmitting, error };
}

export interface UseDeleteTagResult {
  deleteTag: (tagId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: TagError | null;
}

export function useDeleteTag(): UseDeleteTagResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TagError | null>(null);

  const runDeleteTag = useCallback(async (tagId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteTag(getSupabaseClient(), tagId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { deleteTag: runDeleteTag, isSubmitting, error };
}
