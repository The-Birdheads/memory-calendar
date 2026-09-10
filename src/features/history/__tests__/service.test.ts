import type { SupabaseClient } from "@supabase/supabase-js";

import { listPastEventsByTag } from "../service";

describe("listPastEventsByTag", () => {
  it("calls the RPC with no filters and returns past events ordered by date", async () => {
    const rows = [
      {
        id: "event-1",
        calendar_id: "cal-1",
        series_id: null,
        title: "先週の集まり",
        location: null,
        memo: null,
        category_color: "#2f6fed",
        start_at: "2026-08-10T10:00:00.000Z",
        end_at: "2026-08-10T11:00:00.000Z",
        is_all_day: false,
        reminder_at: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ];
    const rpc = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await listPastEventsByTag(client);

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "event-1",
          calendarId: "cal-1",
          seriesId: null,
          title: "先週の集まり",
          location: null,
          memo: null,
          url: null,
          categoryColor: "#2f6fed",
          startAt: "2026-08-10T10:00:00.000Z",
          endAt: "2026-08-10T11:00:00.000Z",
          isAllDay: false,
          reminderAt: null,
          createdBy: "user-1",
          updatedBy: "user-1",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("list_past_events_by_tag", {
      p_calendar_ids: null,
      p_tag_id: null,
    });
  });

  it("calls the RPC with the given tag id, across all of the caller's calendars", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await listPastEventsByTag(client, "tag-1");

    expect(rpc).toHaveBeenCalledWith("list_past_events_by_tag", {
      p_calendar_ids: null,
      p_tag_id: "tag-1",
    });
  });

  it("calls the RPC with both the tag id and an additional calendar filter", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await listPastEventsByTag(client, "tag-1", ["cal-1", "cal-2"]);

    expect(rpc).toHaveBeenCalledWith("list_past_events_by_tag", {
      p_calendar_ids: ["cal-1", "cal-2"],
      p_tag_id: "tag-1",
    });
  });

  it("passes an empty calendar id list through as-is (deliberately \"no calendars\", not \"no filter\")", async () => {
    // The caller only ever passes an explicit [] when the user has actively
    // deselected every calendar in the filter - that must mean "show
    // nothing", not silently fall back to "no filter" (which would show
    // events from every calendar instead of the none the user asked for).
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await listPastEventsByTag(client, "tag-1", []);

    expect(rpc).toHaveBeenCalledWith("list_past_events_by_tag", {
      p_calendar_ids: [],
      p_tag_id: "tag-1",
    });
  });

  it("still treats omitting the calendar filter entirely (undefined) as no filter", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await listPastEventsByTag(client, "tag-1", undefined);

    expect(rpc).toHaveBeenCalledWith("list_past_events_by_tag", {
      p_calendar_ids: null,
      p_tag_id: "tag-1",
    });
  });

  it("returns an empty array when no events match", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await listPastEventsByTag(client, "tag-1");

    expect(result).toEqual({ ok: true, value: [] });
  });

  it("maps a Supabase error to Forbidden", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await listPastEventsByTag(client);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
