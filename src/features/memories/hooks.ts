import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  attachPhoto,
  detachPhoto,
  getPhotoUrl,
  listEventIdsWithPhotos,
  listMemoriesTimeline,
  listPhotosForEvent,
  setPhotoThumbnail,
} from "./service";
import type { EventPhoto, MemoryEntry, MemoryError, MemoryFilter, PhotoUploadInput } from "./types";

export interface UseAttachPhotoResult {
  attachPhoto: (eventId: string, photo: PhotoUploadInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: MemoryError | null;
}

export function useAttachPhoto(): UseAttachPhotoResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MemoryError | null>(null);

  const runAttachPhoto = useCallback(async (eventId: string, photo: PhotoUploadInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await attachPhoto(getSupabaseClient(), eventId, photo);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { attachPhoto: runAttachPhoto, isSubmitting, error };
}

export interface UseDetachPhotoResult {
  detachPhoto: (photoId: string, storagePath: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: MemoryError | null;
}

export function useDetachPhoto(): UseDetachPhotoResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MemoryError | null>(null);

  const runDetachPhoto = useCallback(async (photoId: string, storagePath: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await detachPhoto(getSupabaseClient(), photoId, storagePath);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { detachPhoto: runDetachPhoto, isSubmitting, error };
}

export interface UseSetPhotoThumbnailResult {
  setPhotoThumbnail: (eventId: string, photoId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: MemoryError | null;
}

export function useSetPhotoThumbnail(): UseSetPhotoThumbnailResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MemoryError | null>(null);

  const runSetPhotoThumbnail = useCallback(async (eventId: string, photoId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await setPhotoThumbnail(getSupabaseClient(), eventId, photoId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { setPhotoThumbnail: runSetPhotoThumbnail, isSubmitting, error };
}

export type EventPhotoWithUrl = EventPhoto & { url: string | null };

export interface UseEventPhotosResult {
  photos: EventPhotoWithUrl[];
  isLoading: boolean;
  error: MemoryError | null;
  refetch: () => Promise<void>;
}

export function useEventPhotos(eventId: string): UseEventPhotosResult {
  const [photos, setPhotos] = useState<EventPhotoWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<MemoryError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const client = getSupabaseClient();
    const result = await listPhotosForEvent(client, eventId);
    if (!result.ok) {
      setPhotos([]);
      setError(result.error);
      setIsLoading(false);
      return;
    }

    const withUrls = await Promise.all(
      result.value.map(async (photo) => {
        const urlResult = await getPhotoUrl(client, photo.storagePath);
        return { ...photo, url: urlResult.ok ? urlResult.value : null };
      })
    );
    setPhotos(withUrls);
    setError(null);
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { photos, isLoading, error, refetch };
}

export interface UseEventIdsWithPhotosResult {
  eventIdsWithPhotos: Set<string>;
  isLoading: boolean;
  error: MemoryError | null;
  refetch: () => Promise<void>;
}

/**
 * Batched "does this event have any photos" presence check, for list screens
 * (e.g. the history tab's timeline) that show many events at once.
 */
export function useEventIdsWithPhotos(eventIds: string[]): UseEventIdsWithPhotosResult {
  const [eventIdsWithPhotos, setEventIdsWithPhotos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(eventIds.length > 0);
  const [error, setError] = useState<MemoryError | null>(null);
  // See useEventTagsByEvents (tags feature) for why this keys off a derived
  // string instead of the array reference itself.
  const eventIdsKey = eventIds.join(",");

  const refetch = useCallback(async () => {
    if (eventIds.length === 0) {
      setEventIdsWithPhotos(new Set());
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await listEventIdsWithPhotos(getSupabaseClient(), eventIds);
    if (result.ok) {
      setEventIdsWithPhotos(result.value);
      setError(null);
    } else {
      setEventIdsWithPhotos(new Set());
      setError(result.error);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { eventIdsWithPhotos, isLoading, error, refetch };
}


export type MemoryEntryWithThumbnail = MemoryEntry & { thumbnailUrl: string | null };

export interface UseMemoriesTimelineResult {
  entries: MemoryEntryWithThumbnail[];
  isLoading: boolean;
  error: MemoryError | null;
  refetch: () => Promise<void>;
}

export function useMemoriesTimeline(
  calendarIds: string[],
  filter?: MemoryFilter
): UseMemoriesTimelineResult {
  const [entries, setEntries] = useState<MemoryEntryWithThumbnail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<MemoryError | null>(null);
  const year = filter?.year;
  const month = filter?.month;
  const calendarIdsKey = calendarIds.join(",");

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const client = getSupabaseClient();
    const result = await listMemoriesTimeline(
      client,
      calendarIds,
      year !== undefined || month !== undefined ? { year, month } : undefined
    );
    if (!result.ok) {
      setEntries([]);
      setError(result.error);
      setIsLoading(false);
      return;
    }

    const withThumbnails = await Promise.all(
      result.value.map(async (entry) => {
        const urlResult = await getPhotoUrl(client, entry.thumbnailStoragePath);
        return { ...entry, thumbnailUrl: urlResult.ok ? urlResult.value : null };
      })
    );
    setEntries(withThumbnails);
    setError(null);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarIdsKey, year, month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { entries, isLoading, error, refetch };
}
