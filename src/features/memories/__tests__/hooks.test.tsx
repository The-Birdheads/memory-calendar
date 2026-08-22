import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import {
  addReflection,
  attachPhoto,
  getPhotoUrl,
  listMemoriesTimeline,
  listPhotosForEvent,
} from "../service";
import { useAddReflection, useAttachPhoto, useEventPhotos, useMemoriesTimeline } from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  attachPhoto: jest.fn(),
  listPhotosForEvent: jest.fn(),
  getPhotoUrl: jest.fn(),
  addReflection: jest.fn(),
  listMemoriesTimeline: jest.fn(),
}));

describe("useAttachPhoto", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (attachPhoto as jest.Mock).mockResolvedValue({ ok: true, value: { id: "photo-1" } });

    const { result } = await renderHook(() => useAttachPhoto());

    let success = false;
    await act(async () => {
      success = await result.current.attachPhoto("event-1", {
        fileName: "a.jpg",
        contentType: "image/jpeg",
        data: "base64",
      });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(attachPhoto).toHaveBeenCalledWith({}, "event-1", {
      fileName: "a.jpg",
      contentType: "image/jpeg",
      data: "base64",
    });
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (attachPhoto as jest.Mock).mockResolvedValue({ ok: false, error: { type: "EventNotPast" } });

    const { result } = await renderHook(() => useAttachPhoto());

    let success = true;
    await act(async () => {
      success = await result.current.attachPhoto("event-1", {
        fileName: "a.jpg",
        contentType: "image/jpeg",
        data: "base64",
      });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "EventNotPast" });
  });
});

describe("useEventPhotos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads photos for the given event and resolves a signed url for each", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const photos = [
      { id: "photo-1", eventId: "event-1", storagePath: "event-1/a.jpg", uploadedBy: "user-1", createdAt: "2026-08-18" },
    ];
    (listPhotosForEvent as jest.Mock).mockResolvedValue({ ok: true, value: photos });
    (getPhotoUrl as jest.Mock).mockResolvedValue({ ok: true, value: "https://example.com/signed/a.jpg" });

    const { result } = await renderHook(() => useEventPhotos("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.photos).toEqual([{ ...photos[0], url: "https://example.com/signed/a.jpg" }]);
    expect(listPhotosForEvent).toHaveBeenCalledWith({}, "event-1");
    expect(getPhotoUrl).toHaveBeenCalledWith({}, "event-1/a.jpg");
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPhotosForEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useEventPhotos("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.photos).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("sets a null url when signed url resolution fails for a photo", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const photos = [
      { id: "photo-1", eventId: "event-1", storagePath: "event-1/a.jpg", uploadedBy: "user-1", createdAt: "2026-08-18" },
    ];
    (listPhotosForEvent as jest.Mock).mockResolvedValue({ ok: true, value: photos });
    (getPhotoUrl as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useEventPhotos("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.photos).toEqual([{ ...photos[0], url: null }]);
  });
});

describe("useAddReflection", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (addReflection as jest.Mock).mockResolvedValue({ ok: true, value: { id: "comment-1" } });

    const { result } = await renderHook(() => useAddReflection());

    let success = false;
    await act(async () => {
      success = await result.current.addReflection("event-1", "楽しかったです");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(addReflection).toHaveBeenCalledWith({}, "event-1", "楽しかったです");
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (addReflection as jest.Mock).mockResolvedValue({ ok: false, error: { type: "EventNotPast" } });

    const { result } = await renderHook(() => useAddReflection());

    let success = true;
    await act(async () => {
      success = await result.current.addReflection("event-1", "楽しかったです");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "EventNotPast" });
  });
});

describe("useMemoriesTimeline", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the memories timeline for the given calendar and resolves thumbnail urls", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const entries = [
      { id: "event-1", calendarId: "cal-1", title: "誕生日会", thumbnailStoragePath: "event-1/a.jpg" },
      { id: "event-2", calendarId: "cal-1", title: "外出", thumbnailStoragePath: null },
    ];
    (listMemoriesTimeline as jest.Mock).mockResolvedValue({ ok: true, value: entries });
    (getPhotoUrl as jest.Mock).mockResolvedValue({ ok: true, value: "https://example.com/signed/a.jpg" });

    const { result } = await renderHook(() => useMemoriesTimeline("cal-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([
      { ...entries[0], thumbnailUrl: "https://example.com/signed/a.jpg" },
      { ...entries[1], thumbnailUrl: null },
    ]);
    expect(listMemoriesTimeline).toHaveBeenCalledWith({}, "cal-1", undefined);
    expect(getPhotoUrl).toHaveBeenCalledWith({}, "event-1/a.jpg");
  });

  it("passes the year/month filter through to the service", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMemoriesTimeline as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result } = await renderHook(() => useMemoriesTimeline("cal-1", { year: 2026, month: 7 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listMemoriesTimeline).toHaveBeenCalledWith({}, "cal-1", { year: 2026, month: 7 });
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMemoriesTimeline as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useMemoriesTimeline("cal-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
