import type { SupabaseClient } from "@supabase/supabase-js";

import { postComment } from "../../communication/service";
import { listEventsInRange } from "../../events/service";
import {
  addReflection,
  attachPhoto,
  getPhotoUrl,
  listMemoriesTimeline,
  listPhotosForEvent,
} from "../service";

jest.mock("../../communication/service", () => ({
  postComment: jest.fn(),
}));

jest.mock("../../events/service", () => ({
  listEventsInRange: jest.fn(),
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
});

describe("listPhotosForEvent", () => {
  it("returns the photos attached to the given event", async () => {
    const rows = [
      {
        id: "photo-1",
        event_id: "event-1",
        storage_path: "event-1/1_photo.jpg",
        uploaded_by: "user-1",
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

describe("addReflection", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("posts a reflection comment when the event is past", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const selectEventSingle = jest.fn().mockResolvedValue({
      data: { end_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();
    const client = {
      from: jest.fn().mockReturnValue({ select: selectEvent, eq: selectEventEq, single: selectEventSingle }),
    } as unknown as SupabaseClient;

    const comment = {
      id: "comment-1",
      eventId: "event-1",
      userId: "user-1",
      body: "楽しかったです",
      createdAt: "2026-08-18T00:00:00.000Z",
    };
    (postComment as jest.Mock).mockResolvedValue({ ok: true, value: comment });

    const result = await addReflection(client, "event-1", "楽しかったです");

    expect(result).toEqual({ ok: true, value: comment });
    expect(postComment).toHaveBeenCalledWith(client, "event-1", "楽しかったです");
  });

  it("returns EventNotPast without posting when the event has not ended yet", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const selectEventSingle = jest.fn().mockResolvedValue({
      data: { end_at: "2026-08-20T00:00:00.000Z" },
      error: null,
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();
    const client = {
      from: jest.fn().mockReturnValue({ select: selectEvent, eq: selectEventEq, single: selectEventSingle }),
    } as unknown as SupabaseClient;

    const result = await addReflection(client, "event-1", "楽しかったです");

    expect(result).toEqual({ ok: false, error: { type: "EventNotPast" } });
    expect(postComment).not.toHaveBeenCalled();
  });

  it("maps a Forbidden error from postComment through", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const selectEventSingle = jest.fn().mockResolvedValue({
      data: { end_at: "2026-08-01T00:00:00.000Z" },
      error: null,
    });
    const selectEventEq = jest.fn().mockReturnThis();
    const selectEvent = jest.fn().mockReturnThis();
    const client = {
      from: jest.fn().mockReturnValue({ select: selectEvent, eq: selectEventEq, single: selectEventSingle }),
    } as unknown as SupabaseClient;

    (postComment as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const result = await addReflection(client, "event-1", "楽しかったです");

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

  it("returns only past events, sorted descending, with a thumbnail from the first attached photo", async () => {
    mockNow("2026-08-18T00:00:00.000Z");

    const pastEarly = makeEvent("event-1", "2026-08-01T10:00:00.000Z", "2026-08-01T11:00:00.000Z");
    const pastLate = makeEvent("event-2", "2026-08-10T10:00:00.000Z", "2026-08-10T11:00:00.000Z");
    const future = makeEvent("event-3", "2026-08-20T10:00:00.000Z", "2026-08-20T11:00:00.000Z");
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: true, value: [pastEarly, pastLate, future] });

    const photoRows = [
      {
        id: "photo-1",
        event_id: "event-2",
        storage_path: "event-2/a.jpg",
        uploaded_by: "user-1",
        created_at: "2026-08-10T12:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const inFilter = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: photoRows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq: jest.fn(), in: inFilter, order }),
    } as unknown as SupabaseClient;

    const result = await listMemoriesTimeline(client, "cal-1");

    expect(result).toEqual({
      ok: true,
      value: [
        { ...pastLate, thumbnailStoragePath: "event-2/a.jpg" },
        { ...pastEarly, thumbnailStoragePath: null },
      ],
    });
    expect(inFilter.mock.calls[0][0]).toBe("event_id");
    expect(inFilter.mock.calls[0][1]).toEqual(expect.arrayContaining(["event-1", "event-2"]));
  });

  it("returns an empty array when there are no memories", async () => {
    mockNow("2026-08-18T00:00:00.000Z");
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: true, value: [] });
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await listMemoriesTimeline(client, "cal-1");

    expect(result).toEqual({ ok: true, value: [] });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("converts a year/month filter into the corresponding date range", async () => {
    mockNow("2026-08-18T00:00:00.000Z");
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: true, value: [] });
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    await listMemoriesTimeline(client, "cal-1", { year: 2026, month: 7 });

    expect(listEventsInRange).toHaveBeenCalledWith(client, "cal-1", {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-07-31T23:59:59.999Z",
    });
  });

  it("maps an error from listEventsInRange to Forbidden", async () => {
    mockNow("2026-08-18T00:00:00.000Z");
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await listMemoriesTimeline(client, "cal-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
