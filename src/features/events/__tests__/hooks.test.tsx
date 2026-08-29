import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { createEvent, deleteEvent, getEvent, listEventsInRange, setReminderTargets, updateEvent } from "../service";
import {
  useCreateEvent,
  useDeleteEvent,
  useEvent,
  useEventsInRange,
  useSetReminderTargets,
  useUpdateEvent,
} from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  listEventsInRange: jest.fn(),
  setReminderTargets: jest.fn(),
  getEvent: jest.fn(),
}));

describe("useCreateEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the created event and clears the error when creation succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createEvent as jest.Mock).mockResolvedValue({ ok: true, value: { id: "event-1" } });

    const { result } = await renderHook(() => useCreateEvent());

    let created = null;
    await act(async () => {
      created = await result.current.createEvent({
        calendarId: "cal-1",
        title: "誕生日会",
        startAt: "2026-09-01T10:00:00.000Z",
        endAt: "2026-09-01T12:00:00.000Z",
      });
    });

    expect(created).toEqual({ id: "event-1" });
    expect(result.current.error).toBeNull();
    expect(createEvent).toHaveBeenCalledWith({}, {
      calendarId: "cal-1",
      title: "誕生日会",
      startAt: "2026-09-01T10:00:00.000Z",
      endAt: "2026-09-01T12:00:00.000Z",
    });
  });

  it("returns null and sets the error when creation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "InvalidDateRange" } });

    const { result } = await renderHook(() => useCreateEvent());

    let created: unknown = { id: "should-be-cleared" };
    await act(async () => {
      created = await result.current.createEvent({
        calendarId: "cal-1",
        title: "誕生日会",
        startAt: "2026-09-01T12:00:00.000Z",
        endAt: "2026-09-01T10:00:00.000Z",
      });
    });

    expect(created).toBeNull();
    expect(result.current.error).toEqual({ type: "InvalidDateRange" });
  });
});

describe("useUpdateEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when the update succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateEvent as jest.Mock).mockResolvedValue({ ok: true, value: { id: "event-1" } });

    const { result } = await renderHook(() => useUpdateEvent());

    let success = false;
    await act(async () => {
      success = await result.current.updateEvent("event-1", { title: "変更後" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(updateEvent).toHaveBeenCalledWith({}, "event-1", { title: "変更後" }, "this");
  });

  it("returns false and sets the error when the update fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "InvalidDateRange" } });

    const { result } = await renderHook(() => useUpdateEvent());

    let success = true;
    await act(async () => {
      success = await result.current.updateEvent("event-1", { endAt: "2026-01-01T00:00:00.000Z" });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "InvalidDateRange" });
  });

  it("forwards the series scope to the service call", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateEvent as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result } = await renderHook(() => useUpdateEvent());

    await act(async () => {
      await result.current.updateEvent("event-1", { title: "まとめ変更後" }, "series");
    });

    expect(updateEvent).toHaveBeenCalledWith({}, "event-1", { title: "まとめ変更後" }, "series");
  });
});

describe("useDeleteEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when deletion succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteEvent as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDeleteEvent());

    let success = false;
    await act(async () => {
      success = await result.current.deleteEvent("event-1");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(deleteEvent).toHaveBeenCalledWith({}, "event-1", "this");
  });

  it("returns false and sets the error when deletion fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useDeleteEvent());

    let success = true;
    await act(async () => {
      success = await result.current.deleteEvent("event-1");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("forwards the series scope to the service call", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteEvent as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDeleteEvent());

    await act(async () => {
      await result.current.deleteEvent("event-1", "series");
    });

    expect(deleteEvent).toHaveBeenCalledWith({}, "event-1", "series");
  });
});

describe("useEventsInRange", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const range = { start: "2026-09-01T00:00:00.000Z", end: "2026-09-30T23:59:59.999Z" };

  it("loads the events for the given calendar and range on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const events = [{ id: "event-1", calendarId: "cal-1", title: "会議" }];
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: true, value: events });

    const { result } = await renderHook(() => useEventsInRange("cal-1", range));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual(events);
    expect(listEventsInRange).toHaveBeenCalledWith({}, "cal-1", range);
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useEventsInRange("cal-1", range));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("reloads when the range changes", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result, rerender } = await renderHook(
      ({ r }: { r: typeof range }) => useEventsInRange("cal-1", r),
      { initialProps: { r: range } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const nextRange = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-31T23:59:59.999Z" };
    await rerender({ r: nextRange });

    await waitFor(() => expect(listEventsInRange).toHaveBeenLastCalledWith({}, "cal-1", nextRange));
  });

  it("subscribes to realtime changes on the events table and refetches on change", async () => {
    const channel = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = { channel: jest.fn(() => channel) };
    (getSupabaseClient as jest.Mock).mockReturnValue(client);
    (listEventsInRange as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    await renderHook(() => useEventsInRange("cal-1", range));

    await waitFor(() => expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^events-cal-1-/)));
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "events", filter: "calendar_id=eq.cal-1" },
      expect.any(Function)
    );

    const onChange = channel.on.mock.calls[0][2];
    (listEventsInRange as jest.Mock).mockClear();
    await act(async () => {
      await onChange();
    });

    await waitFor(() => expect(listEventsInRange).toHaveBeenCalled());
  });
});

describe("useSetReminderTargets", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (setReminderTargets as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useSetReminderTargets());

    let success = false;
    await act(async () => {
      success = await result.current.setReminderTargets("event-1", ["user-1"]);
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(setReminderTargets).toHaveBeenCalledWith({}, "event-1", ["user-1"]);
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (setReminderTargets as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useSetReminderTargets());

    let success = true;
    await act(async () => {
      success = await result.current.setReminderTargets("event-1", "all");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the event with the given id on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const event = { id: "event-1", calendarId: "cal-1", title: "会議" };
    (getEvent as jest.Mock).mockResolvedValue({ ok: true, value: event });

    const { result } = await renderHook(() => useEvent("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.event).toEqual(event);
    expect(getEvent).toHaveBeenCalledWith({}, "event-1");
  });

  it("keeps a null event and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (getEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "NotFound" } });

    const { result } = await renderHook(() => useEvent("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.event).toBeNull();
    expect(result.current.error).toEqual({ type: "NotFound" });
  });
});
