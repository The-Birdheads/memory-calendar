import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import {
  attachPhoto,
  detachPhoto,
  getPhotoUrl,
  listEventIdsWithPhotos,
  listMemoriesTimeline,
  listPhotosForEvent,
  setPhotoThumbnail,
} from "../service";
import {
  useAttachPhoto,
  useDetachPhoto,
  useEventIdsWithPhotos,
  useEventPhotos,
  useMemoriesTimeline,
  useSetPhotoThumbnail,
} from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  attachPhoto: jest.fn(),
  detachPhoto: jest.fn(),
  setPhotoThumbnail: jest.fn(),
  listPhotosForEvent: jest.fn(),
  listEventIdsWithPhotos: jest.fn(),
  getPhotoUrl: jest.fn(),
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

describe("useDetachPhoto", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (detachPhoto as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDetachPhoto());

    let success = false;
    await act(async () => {
      success = await result.current.detachPhoto("photo-1", "event-1/a.jpg");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(detachPhoto).toHaveBeenCalledWith({}, "photo-1", "event-1/a.jpg");
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (detachPhoto as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useDetachPhoto());

    let success = true;
    await act(async () => {
      success = await result.current.detachPhoto("photo-1", "event-1/a.jpg");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useSetPhotoThumbnail", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (setPhotoThumbnail as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useSetPhotoThumbnail());

    let success = false;
    await act(async () => {
      success = await result.current.setPhotoThumbnail("event-1", "photo-1");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(setPhotoThumbnail).toHaveBeenCalledWith({}, "event-1", "photo-1");
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (setPhotoThumbnail as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useSetPhotoThumbnail());

    let success = true;
    await act(async () => {
      success = await result.current.setPhotoThumbnail("event-1", "photo-1");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
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

describe("useEventIdsWithPhotos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the set of event ids that have photos, for every given event, on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listEventIdsWithPhotos as jest.Mock).mockResolvedValue({ ok: true, value: new Set(["event-1"]) });

    const { result } = await renderHook(() => useEventIdsWithPhotos(["event-1", "event-2"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.eventIdsWithPhotos).toEqual(new Set(["event-1"]));
    expect(listEventIdsWithPhotos).toHaveBeenCalledWith({}, ["event-1", "event-2"]);
  });

  it("keeps an empty set and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listEventIdsWithPhotos as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useEventIdsWithPhotos(["event-1"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.eventIdsWithPhotos).toEqual(new Set());
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("skips fetching when given no event ids", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});

    const { result } = await renderHook(() => useEventIdsWithPhotos([]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.eventIdsWithPhotos).toEqual(new Set());
    expect(listEventIdsWithPhotos).not.toHaveBeenCalled();
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
      { id: "event-2", calendarId: "cal-1", title: "外出", thumbnailStoragePath: "event-2/b.jpg" },
    ];
    (listMemoriesTimeline as jest.Mock).mockResolvedValue({ ok: true, value: entries });
    (getPhotoUrl as jest.Mock)
      .mockResolvedValueOnce({ ok: true, value: "https://example.com/signed/a.jpg" })
      .mockResolvedValueOnce({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useMemoriesTimeline(["cal-1"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([
      { ...entries[0], thumbnailUrl: "https://example.com/signed/a.jpg" },
      { ...entries[1], thumbnailUrl: null },
    ]);
    expect(listMemoriesTimeline).toHaveBeenCalledWith({}, ["cal-1"], undefined);
    expect(getPhotoUrl).toHaveBeenCalledWith({}, "event-1/a.jpg");
  });

  it("passes the year/month filter through to the service", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMemoriesTimeline as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result } = await renderHook(() => useMemoriesTimeline(["cal-1"], { year: 2026, month: 7 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listMemoriesTimeline).toHaveBeenCalledWith({}, ["cal-1"], { year: 2026, month: 7 });
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMemoriesTimeline as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useMemoriesTimeline(["cal-1"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
