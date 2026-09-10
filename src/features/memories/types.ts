import type { Event } from "../events/types";

export interface EventPhoto {
  id: string;
  eventId: string;
  storagePath: string;
  uploadedBy: string;
  /** この予定の思い出タイムライン上でサムネイルとして使われる1枚かどうか(1予定につき最大1枚)。 */
  isThumbnail: boolean;
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

/** サムネイルが設定された(=思い出タイムラインに表示される)予定のみを表す。 */
export interface MemoryEntry extends Event {
  thumbnailStoragePath: string;
}

export type MemoryError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "EventNotPast" }
  /** 既に自分の写真をこの予定に追加済み(1人1枚まで)。 */
  | { type: "AlreadyAttached" };
