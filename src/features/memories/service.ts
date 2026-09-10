import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { listEventsInRangeForCalendars } from "../events/service";
import type { DateRange, Event, EventError } from "../events/types";
import { err, ok, type Result } from "../../shared/types/result";
import type { EventPhoto, MemoryEntry, MemoryError, MemoryFilter, PhotoUploadInput } from "./types";

interface EventPhotoRow {
  id: string;
  event_id: string;
  storage_path: string;
  uploaded_by: string;
  is_thumbnail: boolean;
  created_at: string;
}

function mapEventPhotoRow(row: EventPhotoRow): EventPhoto {
  return {
    id: row.id,
    eventId: row.event_id,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
    isThumbnail: row.is_thumbnail,
    createdAt: row.created_at,
  };
}

function mapMemoryError(error: { code?: string } | null): MemoryError {
  if (error?.code === "A0005") {
    return { type: "EventNotPast" };
  }
  if (error?.code === "23505") {
    return { type: "AlreadyAttached" };
  }
  return { type: "Forbidden" };
}

function mapEventErrorToMemoryError(error: EventError): MemoryError {
  if (error.type === "NotFound") {
    return { type: "NotFound" };
  }
  return { type: "Forbidden" };
}

function computeMemoryRange(filter: MemoryFilter | undefined, now: Date): DateRange {
  let start: Date;
  let end: Date;

  if (filter?.year !== undefined && filter?.month !== undefined) {
    start = new Date(Date.UTC(filter.year, filter.month - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(filter.year, filter.month, 0, 23, 59, 59, 999));
  } else if (filter?.year !== undefined) {
    start = new Date(Date.UTC(filter.year, 0, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(filter.year, 11, 31, 23, 59, 59, 999));
  } else {
    start = new Date(0);
    end = now;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

async function ensureEventIsPast(
  client: SupabaseClient,
  eventId: string
): Promise<Result<true, MemoryError>> {
  const { data, error } = await client.from("events").select("end_at").eq("id", eventId).single();

  if (error || !data) {
    return err(mapMemoryError(error as PostgrestError));
  }

  const endAt = (data as { end_at: string }).end_at;
  if (new Date(endAt) >= new Date()) {
    return err({ type: "EventNotPast" });
  }

  return ok(true);
}

export async function attachPhoto(
  client: SupabaseClient,
  eventId: string,
  photo: PhotoUploadInput
): Promise<Result<EventPhoto, MemoryError>> {
  const pastCheck = await ensureEventIsPast(client, eventId);
  if (!pastCheck.ok) {
    return pastCheck;
  }

  const storagePath = `${eventId}/${Date.now()}_${photo.fileName}`;

  const { error: uploadError } = await client.storage
    .from("event-photos")
    .upload(storagePath, photo.data, { contentType: photo.contentType });

  if (uploadError) {
    return err({ type: "Forbidden" });
  }

  const { data, error } = await client
    .from("event_photos")
    .insert({ event_id: eventId, storage_path: storagePath })
    .select()
    .single();

  if (error || !data) {
    // アップロード済みのStorageオブジェクトが孤立しないよう、DB側の登録
    // (例: 1人1枚までの一意制約違反)に失敗した場合はベストエフォートで削除する。
    await client.storage.from("event-photos").remove([storagePath]);
    return err(mapMemoryError(error as PostgrestError));
  }

  return ok(mapEventPhotoRow(data as EventPhotoRow));
}

/** 自分が追加した写真を削除する(1枚差し替える際は削除してから追加し直す)。 */
export async function detachPhoto(
  client: SupabaseClient,
  photoId: string,
  storagePath: string
): Promise<Result<void, MemoryError>> {
  const { error: deleteRowError } = await client.from("event_photos").delete().eq("id", photoId);

  if (deleteRowError) {
    return err(mapMemoryError(deleteRowError));
  }

  await client.storage.from("event-photos").remove([storagePath]);

  return ok(undefined);
}

/** その予定のサムネイルをphotoIdの写真に切り替える(誰の写真かは問わない、共有の設定)。
 * 一意制約(1予定1枚まで)に触れないよう、まず既存のサムネイルを解除してから設定する。 */
export async function setPhotoThumbnail(
  client: SupabaseClient,
  eventId: string,
  photoId: string
): Promise<Result<void, MemoryError>> {
  const { error: clearError } = await client
    .from("event_photos")
    .update({ is_thumbnail: false })
    .eq("event_id", eventId)
    .eq("is_thumbnail", true);

  if (clearError) {
    return err(mapMemoryError(clearError));
  }

  const { error: setError } = await client
    .from("event_photos")
    .update({ is_thumbnail: true })
    .eq("id", photoId);

  if (setError) {
    return err(mapMemoryError(setError));
  }

  return ok(undefined);
}

export async function listPhotosForEvent(
  client: SupabaseClient,
  eventId: string
): Promise<Result<EventPhoto[], MemoryError>> {
  const { data, error } = await client
    .from("event_photos")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return err(mapMemoryError(error as PostgrestError));
  }

  return ok((data as EventPhotoRow[]).map(mapEventPhotoRow));
}

/**
 * Batched "does this event have any photos" check for many events at once -
 * used by list screens (e.g. the history tab's timeline) that just need a
 * presence indicator per event, not the photos themselves.
 */
export async function listEventIdsWithPhotos(
  client: SupabaseClient,
  eventIds: string[]
): Promise<Result<Set<string>, MemoryError>> {
  if (eventIds.length === 0) {
    return ok(new Set());
  }

  const { data, error } = await client.from("event_photos").select("event_id").in("event_id", eventIds);

  if (error || !data) {
    return err(mapMemoryError(error as PostgrestError));
  }

  return ok(new Set((data as { event_id: string }[]).map((row) => row.event_id)));
}

export async function listMemoriesTimeline(
  client: SupabaseClient,
  calendarIds: string[],
  filter?: MemoryFilter
): Promise<Result<MemoryEntry[], MemoryError>> {
  const now = new Date();
  const range = computeMemoryRange(filter, now);

  const eventsResult = await listEventsInRangeForCalendars(client, calendarIds, range);
  if (!eventsResult.ok) {
    return err(mapEventErrorToMemoryError(eventsResult.error));
  }

  const pastEvents = (eventsResult.value as Event[])
    .filter((event) => new Date(event.endAt) < now)
    .sort((a, b) => (a.startAt < b.startAt ? 1 : -1));

  if (pastEvents.length === 0) {
    return ok([]);
  }

  const eventIds = pastEvents.map((event) => event.id);
  // サムネイルが設定された予定だけをタイムラインに出す(カメラロールのように、
  // 誰かが「これ」と選んだ写真がある予定のみ)。
  const { data, error } = await client
    .from("event_photos")
    .select()
    .in("event_id", eventIds)
    .eq("is_thumbnail", true);

  if (error) {
    return err(mapMemoryError(error as PostgrestError));
  }

  const thumbnailByEventId = new Map<string, string>();
  ((data as EventPhotoRow[]) ?? []).forEach((row) => {
    thumbnailByEventId.set(row.event_id, row.storage_path);
  });

  return ok(
    pastEvents
      .filter((event) => thumbnailByEventId.has(event.id))
      .map((event) => ({
        ...event,
        thumbnailStoragePath: thumbnailByEventId.get(event.id) as string,
      }))
  );
}

export async function getPhotoUrl(
  client: SupabaseClient,
  storagePath: string
): Promise<Result<string, MemoryError>> {
  const { data, error } = await client.storage.from("event-photos").createSignedUrl(storagePath, 3600);

  if (error || !data) {
    return err({ type: "Forbidden" });
  }

  return ok(data.signedUrl);
}
