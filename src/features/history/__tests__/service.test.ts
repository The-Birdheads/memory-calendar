import type { SupabaseClient } from "@supabase/supabase-js";

import { listPastEventsByTag } from "../service";

describe("listPastEventsByTag", () => {
  it("calls the RPC without a tag filter and returns past events ordered by date", async () => {
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

    const result = await listPastEventsByTag(client, "cal-1");

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
      p_calendar_id: "cal-1",
      p_tag_id: null,
    });
  });

  it("calls the RPC with the given tag id", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await listPastEventsByTag(client, "cal-1", "tag-1");

    expect(rpc).toHaveBeenCalledWith("list_past_events_by_tag", {
      p_calendar_id: "cal-1",
      p_tag_id: "tag-1",
    });
  });

  it("returns an empty array when no events match", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await listPastEventsByTag(client, "cal-1", "tag-1");

    expect(result).toEqual({ ok: true, value: [] });
  });

  it("maps a Supabase error to Forbidden", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await listPastEventsByTag(client, "cal-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
