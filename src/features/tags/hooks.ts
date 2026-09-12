import { useCallback, useEffect, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  attachTagsToEvent,
  attachTagsToEvents,
  createTag,
  deleteTag,
  detachTagFromEvent,
  listTagsForEvent,
  listTagsForEvents,
  listTagTree,
  removeAllTagsFromEvents,
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

export interface UseAttachTagsToEventsResult {
  attachTagsToEvents: (tagIds: string[], eventIds: string[]) => Promise<boolean>;
  isSubmitting: boolean;
  error: TagError | null;
}

/** まとめて付与 - 動線①(振り返り年表)②(カレンダー一覧)共通で使う一括付与。 */
export function useAttachTagsToEvents(): UseAttachTagsToEventsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TagError | null>(null);

  const runAttachTagsToEvents = useCallback(async (tagIds: string[], eventIds: string[]) => {
    setIsSubmitting(true);
    setError(null);
    const result = await attachTagsToEvents(getSupabaseClient(), tagIds, eventIds);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { attachTagsToEvents: runAttachTagsToEvents, isSubmitting, error };
}

export interface UseRemoveAllTagsFromEventsResult {
  removeAllTagsFromEvents: (eventIds: string[]) => Promise<boolean>;
  isSubmitting: boolean;
  error: TagError | null;
}

/** まとめて削除 - 動線①②共通で使う、選択された予定からタグを全て外す一括削除。 */
export function useRemoveAllTagsFromEvents(): UseRemoveAllTagsFromEventsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TagError | null>(null);

  const runRemoveAllTagsFromEvents = useCallback(async (eventIds: string[]) => {
    setIsSubmitting(true);
    setError(null);
    const result = await removeAllTagsFromEvents(getSupabaseClient(), eventIds);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { removeAllTagsFromEvents: runRemoveAllTagsFromEvents, isSubmitting, error };
}

export type BulkTagSelectionMode = "assign" | "remove";

export interface UseBulkTagSelectionResult {
  isActive: boolean;
  mode: BulkTagSelectionMode;
  selectedTagIds: string[];
  selectedEventIds: string[];
  activate: () => void;
  deactivate: () => void;
  switchToRemoveMode: () => void;
  switchToAssignMode: () => void;
  toggleTag: (tagId: string) => void;
  toggleEvent: (eventId: string) => void;
  clearSelectedEvents: () => void;
}

/**
 * まとめてタグ付与/削除の選択状態一式。振り返り(年表)・カレンダー(一覧)
 * どちらのタグアイコンからも同じ流れ(モード切り替え・タグ/予定の複数選択)
 * になるので、画面側の実装を共通化するためにここに切り出す。
 */
export function useBulkTagSelection(): UseBulkTagSelectionResult {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<BulkTagSelectionMode>("assign");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  const activate = useCallback(() => {
    setMode("assign");
    setSelectedTagIds(new Set());
    setSelectedEventIds(new Set());
    setIsActive(true);
  }, []);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setMode("assign");
    setSelectedTagIds(new Set());
    setSelectedEventIds(new Set());
  }, []);

  // 「まとめて削除」モードはタグを選ばない操作なので、切り替え時にタグの
  // 選択はクリアする(逆方向は残しておいて構わない - 誤操作防止のため
  // 「まとめて削除」に切り替えた後で戻ってきた場合のみ選び直させる)。
  const switchToRemoveMode = useCallback(() => {
    setMode("remove");
    setSelectedTagIds(new Set());
  }, []);

  const switchToAssignMode = useCallback(() => {
    setMode("assign");
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const toggleEvent = useCallback((eventId: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const clearSelectedEvents = useCallback(() => {
    setSelectedEventIds(new Set());
  }, []);

  return {
    isActive,
    mode,
    selectedTagIds: Array.from(selectedTagIds),
    selectedEventIds: Array.from(selectedEventIds),
    activate,
    deactivate,
    switchToRemoveMode,
    switchToAssignMode,
    toggleTag,
    toggleEvent,
    clearSelectedEvents,
  };
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
