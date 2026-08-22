import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  addReflection,
  attachPhoto,
  getPhotoUrl,
  listMemoriesTimeline,
  listPhotosForEvent,
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

export interface UseAddReflectionResult {
  addReflection: (eventId: string, body: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: MemoryError | null;
}

export function useAddReflection(): UseAddReflectionResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MemoryError | null>(null);

  const runAddReflection = useCallback(async (eventId: string, body: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await addReflection(getSupabaseClient(), eventId, body);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { addReflection: runAddReflection, isSubmitting, error };
}

export type MemoryEntryWithThumbnail = MemoryEntry & { thumbnailUrl: string | null };

export interface UseMemoriesTimelineResult {
  entries: MemoryEntryWithThumbnail[];
  isLoading: boolean;
  error: MemoryError | null;
  refetch: () => Promise<void>;
}

export function useMemoriesTimeline(
  calendarId: string,
  filter?: MemoryFilter
): UseMemoriesTimelineResult {
  const [entries, setEntries] = useState<MemoryEntryWithThumbnail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<MemoryError | null>(null);
  const year = filter?.year;
  const month = filter?.month;

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const client = getSupabaseClient();
    const result = await listMemoriesTimeline(
      client,
      calendarId,
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
        if (!entry.thumbnailStoragePath) {
          return { ...entry, thumbnailUrl: null };
        }
        const urlResult = await getPhotoUrl(client, entry.thumbnailStoragePath);
        return { ...entry, thumbnailUrl: urlResult.ok ? urlResult.value : null };
      })
    );
    setEntries(withThumbnails);
    setError(null);
    setIsLoading(false);
  }, [calendarId, year, month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { entries, isLoading, error, refetch };
}
