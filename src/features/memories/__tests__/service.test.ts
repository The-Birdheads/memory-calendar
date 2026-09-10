import type { SupabaseClient } from "@supabase/supabase-js";

import { listEventsInRangeForCalendars } from "../../events/service";
import {
  attachPhoto,
  detachPhoto,
  getPhotoUrl,
  listEventIdsWithPhotos,
  listMemoriesTimeline,
  listPhotosForEvent,
  setPhotoThumbnail,
} from "../service";

jest.mock("../../events/service", () => ({
  listEventsInRangeForCalendars: jest.fn(),
}));

function mockNow(iso: string) {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(iso));
}

describe("attachPhoto", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("uploads the file and inserts an event_photos row when the event is past", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const selectEventSingle = jest.fn().mockResolvedValue({
      data: { end_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();

    const upload = jest.fn().mockResolvedValue({ data: { path: "event-1/1_photo.jpg" }, error: null });
    const storageFrom = jest.fn().mockReturnValue({ upload });

    const photoRow = {
      id: "photo-1",
      event_id: "event-1",
      storage_path: "event-1/1_photo.jpg",
      uploaded_by: "user-1",
      is_thumbnail: false,
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const insertSelect = jest.fn().mockReturnThis();
    const insertSingle = jest.fn().mockResolvedValue({ data: photoRow, error: null });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: selectEvent, eq: selectEventEq, single: selectEventSingle })
        .mockReturnValueOnce({ insert, select: insertSelect, single: insertSingle }),
      storage: { from: storageFrom },
    } as unknown as SupabaseClient;

    const result = await attachPhoto(client, "event-1", {
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      data: "base64data",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "photo-1",
        eventId: "event-1",
        storagePath: "event-1/1_photo.jpg",
        uploadedBy: "user-1",
        isThumbnail: false,
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(selectEvent).toHaveBeenCalledWith("end_at");
    expect(selectEventEq).toHaveBeenCalledWith("id", "event-1");
    expect(storageFrom).toHaveBeenCalledWith("event-photos");
    expect(upload).toHaveBeenCalledWith(expect.stringContaining("event-1/"), "base64data", {
      contentType: "image/jpeg",
    });
    expect(insert).toHaveBeenCalledWith({
      event_id: "event-1",
      storage_path: expect.stringContaining("event-1/"),
    });
  });

  it("returns EventNotPast without uploading when the event has not ended yet", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const selectEventSingle = jest.fn().mockResolvedValue({
      data: { end_at: "2026-08-20T00:00:00.000Z" },
      error: null,
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();
    const storageFrom = jest.fn();

    const client = {
      from: jest.fn().mockReturnValue({ select: selectEvent, eq: selectEventEq, single: selectEventSingle }),
      storage: { from: storageFrom },
    } as unknown as SupabaseClient;

    const result = await attachPhoto(client, "event-1", {
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      data: "base64data",
    });

    expect(result).toEqual({ ok: false, error: { type: "EventNotPast" } });
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("maps a permission error from fetching the event to Forbidden", async () => {
    const selectEventSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();

    const client = {
      from: jest.fn().mockReturnValue({ select: selectEvent, eq: selectEventEq, single: selectEventSingle }),
      storage: { from: jest.fn() },
    } as unknown as SupabaseClient;

    const result = await attachPhoto(client, "event-1", {
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      data: "base64data",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("maps a storage upload error to Forbidden", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const selectEventSingle = jest.fn().mockResolvedValue({
      data: { end_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();

    const upload = jest.fn().mockResolvedValue({ data: null, error: { message: "storage error" } });
    const storageFrom = jest.fn().mockReturnValue({ upload });

    const client = {
      from: jest.fn().mockReturnValue({ select: selectEvent, eq: selectEventEq, single: selectEventSingle }),
      storage: { from: storageFrom },
    } as unknown as SupabaseClient;

    const result = await attachPhoto(client, "event-1", {
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      data: "base64data",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("maps a unique-violation from the insert to AlreadyAttached and removes the just-uploaded file", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const selectEventSingle = jest.fn().mockResolvedValue({
      data: { end_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();

    const upload = jest.fn().mockResolvedValue({ data: { path: "event-1/1_photo.jpg" }, error: null });
    const remove = jest.fn().mockResolvedValue({ data: null, error: null });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });

    const insert = jest.fn().mockReturnThis();
    const insertSelect = jest.fn().mockReturnThis();
    const insertSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "duplicate key", code: "23505" },
    });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: selectEvent, eq: selectEventEq, single: selectEventSingle })
        .mockReturnValueOnce({ insert, select: insertSelect, single: insertSingle }),
      storage: { from: storageFrom },
    } as unknown as SupabaseClient;

    const result = await attachPhoto(client, "event-1", {
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      data: "base64data",
    });

    expect(result).toEqual({ ok: false, error: { type: "AlreadyAttached" } });
    expect(remove).toHaveBeenCalledWith([expect.stringContaining("event-1/")]);
  });
});

describe("detachPhoto", () => {
  it("deletes the row and removes the storage object", async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq: deleteEq });
    const remove = jest.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
      storage: { from: jest.fn().mockReturnValue({ remove }) },
    } as unknown as SupabaseClient;

    const result = await detachPhoto(client, "photo-1", "event-1/photo.jpg");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deleteEq).toHaveBeenCalledWith("id", "photo-1");
    expect(remove).toHaveBeenCalledWith(["event-1/photo.jpg"]);
  });

  it("maps a permission error to Forbidden without touching storage", async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: { message: "denied", code: "42501" } });
    const del = jest.fn().mockReturnValue({ eq: deleteEq });
    const remove = jest.fn();
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
      storage: { from: jest.fn().mockReturnValue({ remove }) },
    } as unknown as SupabaseClient;

    const result = await detachPhoto(client, "photo-1", "event-1/photo.jpg");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("setPhotoThumbnail", () => {
  it("clears any existing thumbnail for the event, then sets the given photo as the new one", async () => {
    const clearEq2 = jest.fn().mockResolvedValue({ error: null });
    const clearEq1 = jest.fn().mockReturnValue({ eq: clearEq2 });
    const clearUpdate = jest.fn().mockReturnValue({ eq: clearEq1 });
    const setEq = jest.fn().mockResolvedValue({ error: null });
    const setUpdate = jest.fn().mockReturnValue({ eq: setEq });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ update: clearUpdate })
        .mockReturnValueOnce({ update: setUpdate }),
    } as unknown as SupabaseClient;

    const result = await setPhotoThumbnail(client, "event-1", "photo-2");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(clearUpdate).toHaveBeenCalledWith({ is_thumbnail: false });
    expect(clearEq1).toHaveBeenCalledWith("event_id", "event-1");
    expect(clearEq2).toHaveBeenCalledWith("is_thumbnail", true);
    expect(setUpdate).toHaveBeenCalledWith({ is_thumbnail: true });
    expect(setEq).toHaveBeenCalledWith("id", "photo-2");
  });

  it("maps a permission error from the clear step to Forbidden", async () => {
    const clearEq2 = jest.fn().mockResolvedValue({ error: { message: "denied", code: "42501" } });
    const clearEq1 = jest.fn().mockReturnValue({ eq: clearEq2 });
    const clearUpdate = jest.fn().mockReturnValue({ eq: clearEq1 });
    const client = { from: jest.fn().mockReturnValue({ update: clearUpdate }) } as unknown as SupabaseClient;

    const result = await setPhotoThumbnail(client, "event-1", "photo-2");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listPhotosForEvent", () => {
  it("returns the photos attached to the given event", async () => {
    const rows = [
      {
        id: "photo-1",
        event_id: "event-1",
        storage_path: "event-1/1_photo.jpg",
        uploaded_by: "user-1",
        is_thumbnail: true,
        created_at: "2026-08-18T00:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    const result = await listPhotosForEvent(client, "event-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "photo-1",
          eventId: "event-1",
          storagePath: "event-1/1_photo.jpg",
          uploadedBy: "user-1",
          isThumbnail: true,
          createdAt: "2026-08-18T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("event_photos");
    expect(eq).toHaveBeenCalledWith("event_id", "event-1");
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    const result = await listPhotosForEvent(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listEventIdsWithPhotos", () => {
  it("returns the set of event ids that have at least one photo", async () => {
    const rows = [{ event_id: "event-1" }, { event_id: "event-1" }, { event_id: "event-3" }];
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn }),
    } as unknown as SupabaseClient;

    const result = await listEventIdsWithPhotos(client, ["event-1", "event-2", "event-3"]);

    expect(result).toEqual({ ok: true, value: new Set(["event-1", "event-3"]) });
    expect(client.from).toHaveBeenCalledWith("event_photos");
    expect(select).toHaveBeenCalledWith("event_id");
    expect(inFn).toHaveBeenCalledWith("event_id", ["event-1", "event-2", "event-3"]);
  });

  it("returns an empty set without querying when given no event ids", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await listEventIdsWithPhotos(client, []);

    expect(result).toEqual({ ok: true, value: new Set() });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn }),
    } as unknown as SupabaseClient;

    const result = await listEventIdsWithPhotos(client, ["event-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("getPhotoUrl", () => {
  it("returns a signed url for the given storage path", async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/signed/event-1/photo.jpg" },
      error: null,
    });
    const storageFrom = jest.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from: storageFrom } } as unknown as SupabaseClient;

    const result = await getPhotoUrl(client, "event-1/photo.jpg");

    expect(result).toEqual({ ok: true, value: "https://example.com/signed/event-1/photo.jpg" });
    expect(storageFrom).toHaveBeenCalledWith("event-photos");
    expect(createSignedUrl).toHaveBeenCalledWith("event-1/photo.jpg", 3600);
  });

  it("maps a Supabase error to Forbidden", async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    const storageFrom = jest.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from: storageFrom } } as unknown as SupabaseClient;

    const result = await getPhotoUrl(client, "event-1/photo.jpg");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listMemoriesTimeline", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function makeEvent(id: string, startAt: string, endAt: string) {
    return {
      id,
      calendarId: "cal-1",
      seriesId: null,
      title: `予定${id}`,
      location: null,
      memo: null,
      categoryColor: null,
      startAt,
      endAt,
      isAllDay: false,
      reminderAt: null,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: startAt,
      updatedAt: startAt,
    };
  }

  it("returns only past events that have a thumbnail set, sorted descending", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const pastWithThumbnail = makeEvent("event-1", "2026-08-01T10:00:00.000Z", "2026-08-01T11:00:00.000Z");
    const pastWithoutThumbnail = makeEvent("event-2", "2026-08-10T10:00:00.000Z", "2026-08-10T11:00:00.000Z");
    const future = makeEvent("event-3", "2026-08-20T10:00:00.000Z", "2026-08-20T11:00:00.000Z");
    (listEventsInRangeForCalendars as jest.Mock).mockResolvedValue({
      ok: true,
      value: [pastWithThumbnail, pastWithoutThumbnail, future],
    });

    const thumbnailRows = [
      {
        id: "photo-1",
        event_id: "event-1",
        storage_path: "event-1/a.jpg",
        uploaded_by: "user-1",
        is_thumbnail: true,
        created_at: "2026-08-01T12:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const inFilter = jest.fn().mockReturnThis();
    const eqFilter = jest.fn().mockResolvedValue({ data: thumbnailRows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFilter, eq: eqFilter }),
    } as unknown as SupabaseClient;

    const result = await listMemoriesTimeline(client, ["cal-1", "cal-2"]);

    // event-2はサムネイル未設定なので除外され、event-1のみ返る
    expect(result).toEqual({
      ok: true,
      value: [{ ...pastWithThumbnail, thumbnailStoragePath: "event-1/a.jpg" }],
    });
    expect(inFilter.mock.calls[0][0]).toBe("event_id");
    expect(inFilter.mock.calls[0][1]).toEqual(expect.arrayContaining(["event-1", "event-2"]));
    expect(eqFilter).toHaveBeenCalledWith("is_thumbnail", true);
  });

  it("returns an empty array when there are no memories", async () => {
    mockNow("2026-08-18T00:00:00.000Z");
    (listEventsInRangeForCalendars as jest.Mock).mockResolvedValue({ ok: true, value: [] });
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await listMemoriesTimeline(client, ["cal-1"]);

    expect(result).toEqual({ ok: true, value: [] });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("converts a year/month filter into the corresponding date range", async () => {
    mockNow("2026-08-18T00:00:00.000Z");
    (listEventsInRangeForCalendars as jest.Mock).mockResolvedValue({ ok: true, value: [] });
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    await listMemoriesTimeline(client, ["cal-1"], { year: 2026, month: 7 });

    expect(listEventsInRangeForCalendars).toHaveBeenCalledWith(client, ["cal-1"], {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-07-31T23:59:59.999Z",
    });
  });

  it("maps an error from listEventsInRangeForCalendars to Forbidden", async () => {
    mockNow("2026-08-18T00:00:00.000Z");
    (listEventsInRangeForCalendars as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await listMemoriesTimeline(client, ["cal-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
