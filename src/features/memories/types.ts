import type { Event } from "../events/types";

export interface EventPhoto {
  id: string;
  eventId: string;
  storagePath: string;
  uploadedBy: string;
  createdAt: string;
}

export interface PhotoUploadInput {
  fileName: string;
  contentType: string;
  data: Blob | ArrayBuffer | string;
}

export interface MemoryFilter {
  year?: number;
  month?: number;
}

export interface MemoryEntry extends Event {
  thumbnailStoragePath: string | null;
}

export type MemoryError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "EventNotPast" };
