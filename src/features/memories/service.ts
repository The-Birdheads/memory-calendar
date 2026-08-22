import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { postComment } from "../communication/service";
import type { CommunicationError, EventComment } from "../communication/types";
import { listEventsInRange } from "../events/service";
import type { DateRange, Event, EventError } from "../events/types";
import { err, ok, type Result } from "../../shared/types/result";
import type { EventPhoto, MemoryEntry, MemoryError, MemoryFilter, PhotoUploadInput } from "./types";

interface EventPhotoRow {
  id: string;
  event_id: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

function mapEventPhotoRow(row: EventPhotoRow): EventPhoto {
  return {
    id: row.id,
    eventId: row.event_id,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function mapMemoryError(error: { code?: string } | null): MemoryError {
  if (error?.code === "A0005") {
    return { type: "EventNotPast" };
  }
  return { type: "Forbidden" };
}

function mapCommunicationError(error: CommunicationError): MemoryError {
  if (error.type === "NotFound") {
    return { type: "NotFound" };
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
    return err(mapMemoryError(error as PostgrestError));
  }

  return ok(mapEventPhotoRow(data as EventPhotoRow));
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

export async function addReflection(
  client: SupabaseClient,
  eventId: string,
  body: string
): Promise<Result<EventComment, MemoryError>> {
  const pastCheck = await ensureEventIsPast(client, eventId);
  if (!pastCheck.ok) {
    return pastCheck;
  }

  const result = await postComment(client, eventId, body);
  if (!result.ok) {
    return err(mapCommunicationError(result.error));
  }

  return ok(result.value);
}

export async function listMemoriesTimeline(
  client: SupabaseClient,
  calendarId: string,
  filter?: MemoryFilter
): Promise<Result<MemoryEntry[], MemoryError>> {
  const now = new Date();
  const range = computeMemoryRange(filter, now);

  const eventsResult = await listEventsInRange(client, calendarId, range);
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
  const { data, error } = await client
    .from("event_photos")
    .select()
    .in("event_id", eventIds)
    .order("created_at", { ascending: true });

  if (error) {
    return err(mapMemoryError(error as PostgrestError));
  }

  const thumbnailByEventId = new Map<string, string>();
  ((data as EventPhotoRow[]) ?? []).forEach((row) => {
    if (!thumbnailByEventId.has(row.event_id)) {
      thumbnailByEventId.set(row.event_id, row.storage_path);
    }
  });

  return ok(
    pastEvents.map((event) => ({
      ...event,
      thumbnailStoragePath: thumbnailByEventId.get(event.id) ?? null,
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
