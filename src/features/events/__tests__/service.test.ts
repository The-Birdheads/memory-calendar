import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createEvent,
  createRecurringSeries,
  deleteEvent,
  getEvent,
  getEventErrorMessageJa,
  listEventsInRange,
  setReminderTargets,
  updateEvent,
} from "../service";

describe("createEvent", () => {
  it("creates a single event and returns it on success", async () => {
    const row = {
      id: "event-1",
      calendar_id: "cal-1",
      title: "誕生日会",
      location: "自宅",
      memo: "ケーキを用意する",
      category_color: "#ff0000",
      start_at: "2026-09-01T10:00:00.000Z",
      end_at: "2026-09-01T12:00:00.000Z",
      is_all_day: false,
      reminder_at: null,
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
      updated_at: "2026-08-17T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createEvent(client, {
      calendarId: "cal-1",
      title: "誕生日会",
      startAt: "2026-09-01T10:00:00.000Z",
      endAt: "2026-09-01T12:00:00.000Z",
      location: "自宅",
      memo: "ケーキを用意する",
      categoryColor: "#ff0000",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "event-1",
        calendarId: "cal-1",
        title: "誕生日会",
        location: "自宅",
        memo: "ケーキを用意する",
        categoryColor: "#ff0000",
        startAt: "2026-09-01T10:00:00.000Z",
        endAt: "2026-09-01T12:00:00.000Z",
        isAllDay: false,
        reminderAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-17T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("events");
    expect(insert).toHaveBeenCalledWith({
      calendar_id: "cal-1",
      title: "誕生日会",
      start_at: "2026-09-01T10:00:00.000Z",
      end_at: "2026-09-01T12:00:00.000Z",
      is_all_day: false,
      location: "自宅",
      memo: "ケーキを用意する",
      category_color: "#ff0000",
      reminder_at: null,
    });
  });

  it("omits optional fields when not provided", async () => {
    const row = {
      id: "event-2",
      calendar_id: "cal-1",
      title: "会議",
      location: null,
      memo: null,
      category_color: null,
      start_at: "2026-09-02T09:00:00.000Z",
      end_at: "2026-09-02T10:00:00.000Z",
      is_all_day: false,
      reminder_at: null,
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
      updated_at: "2026-08-17T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    await createEvent(client, {
      calendarId: "cal-1",
      title: "会議",
      startAt: "2026-09-02T09:00:00.000Z",
      endAt: "2026-09-02T10:00:00.000Z",
    });

    expect(insert).toHaveBeenCalledWith({
      calendar_id: "cal-1",
      title: "会議",
      start_at: "2026-09-02T09:00:00.000Z",
      end_at: "2026-09-02T10:00:00.000Z",
      is_all_day: false,
      location: null,
      memo: null,
      category_color: null,
      reminder_at: null,
    });
  });

  it("maps a check constraint violation to InvalidDateRange", async () => {
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "check constraint violated", code: "23514" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createEvent(client, {
      calendarId: "cal-1",
      title: "会議",
      startAt: "2026-09-02T10:00:00.000Z",
      endAt: "2026-09-02T09:00:00.000Z",
    });

    expect(result).toEqual({ ok: false, error: { type: "InvalidDateRange" } });
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createEvent(client, {
      calendarId: "cal-1",
      title: "会議",
      startAt: "2026-09-02T09:00:00.000Z",
      endAt: "2026-09-02T10:00:00.000Z",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("updateEvent", () => {
  it("updates an event and returns it on success", async () => {
    const row = {
      id: "event-1",
      calendar_id: "cal-1",
      title: "誕生日会(変更後)",
      location: "自宅",
      memo: "ケーキを用意する",
      category_color: "#ff0000",
      start_at: "2026-09-01T10:00:00.000Z",
      end_at: "2026-09-01T13:00:00.000Z",
      is_all_day: false,
      reminder_at: null,
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
      updated_at: "2026-08-18T00:00:00.000Z",
    };
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateEvent(client, "event-1", {
      title: "誕生日会(変更後)",
      endAt: "2026-09-01T13:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "event-1",
        calendarId: "cal-1",
        title: "誕生日会(変更後)",
        location: "自宅",
        memo: "ケーキを用意する",
        categoryColor: "#ff0000",
        startAt: "2026-09-01T10:00:00.000Z",
        endAt: "2026-09-01T13:00:00.000Z",
        isAllDay: false,
        reminderAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("events");
    expect(update).toHaveBeenCalledWith({ title: "誕生日会(変更後)", end_at: "2026-09-01T13:00:00.000Z" });
    expect(eq).toHaveBeenCalledWith("id", "event-1");
  });

  it("returns InvalidDateRange without calling Supabase when both dates are given and endAt is before startAt", async () => {
    const client = {
      from: jest.fn(),
    } as unknown as SupabaseClient;

    const result = await updateEvent(client, "event-1", {
      startAt: "2026-09-01T10:00:00.000Z",
      endAt: "2026-09-01T09:00:00.000Z",
    });

    expect(result).toEqual({ ok: false, error: { type: "InvalidDateRange" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a check constraint violation to InvalidDateRange", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "check constraint violated", code: "23514" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateEvent(client, "event-1", { endAt: "2026-09-01T09:00:00.000Z" });

    expect(result).toEqual({ ok: false, error: { type: "InvalidDateRange" } });
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateEvent(client, "event-1", { title: "変更" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("maps a missing row to NotFound", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "no rows returned", code: "PGRST116" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateEvent(client, "event-1", { title: "変更" });

    expect(result).toEqual({ ok: false, error: { type: "NotFound" } });
  });

  it("updates every event sharing the series_id and returns them all when scope is series", async () => {
    const seriesRow = { series_id: "series-1" };
    const selectSeriesId = jest.fn().mockReturnThis();
    const eqSeriesId = jest.fn().mockReturnThis();
    const singleSeriesId = jest.fn().mockResolvedValue({ data: seriesRow, error: null });

    const updatedRows = [
      {
        id: "event-1",
        calendar_id: "cal-1",
        series_id: "series-1",
        title: "まとめ変更後",
        location: null,
        memo: null,
        category_color: null,
        start_at: "2026-09-01T10:00:00.000Z",
        end_at: "2026-09-01T11:00:00.000Z",
        is_all_day: false,
        reminder_at: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: "2026-08-17T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
      {
        id: "event-2",
        calendar_id: "cal-1",
        series_id: "series-1",
        title: "まとめ変更後",
        location: null,
        memo: null,
        category_color: null,
        start_at: "2026-09-08T10:00:00.000Z",
        end_at: "2026-09-08T11:00:00.000Z",
        is_all_day: false,
        reminder_at: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: "2026-08-17T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
    ];
    const update = jest.fn().mockReturnThis();
    const eqSeries = jest.fn().mockReturnThis();
    const select = jest.fn().mockResolvedValue({ data: updatedRows, error: null });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: selectSeriesId, eq: eqSeriesId, single: singleSeriesId })
        .mockReturnValueOnce({ update, eq: eqSeries, select }),
    } as unknown as SupabaseClient;

    const result = await updateEvent(client, "event-1", { title: "まとめ変更後" }, "series");

    expect(eqSeriesId).toHaveBeenCalledWith("id", "event-1");
    expect(update).toHaveBeenCalledWith({ title: "まとめ変更後" });
    expect(eqSeries).toHaveBeenCalledWith("series_id", "series-1");
    expect(result).toEqual({
      ok: true,
      value: updatedRows.map((row) => ({
        id: row.id,
        calendarId: row.calendar_id,
        seriesId: row.series_id,
        title: row.title,
        location: row.location,
        memo: row.memo,
        categoryColor: row.category_color,
        startAt: row.start_at,
        endAt: row.end_at,
        isAllDay: row.is_all_day,
        reminderAt: row.reminder_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  });

  it("drops startAt/endAt from the payload when scope is series", async () => {
    const seriesRow = { series_id: "series-1" };
    const selectSeriesId = jest.fn().mockReturnThis();
    const eqSeriesId = jest.fn().mockReturnThis();
    const singleSeriesId = jest.fn().mockResolvedValue({ data: seriesRow, error: null });

    const update = jest.fn().mockReturnThis();
    const eqSeries = jest.fn().mockReturnThis();
    const select = jest.fn().mockResolvedValue({ data: [], error: null });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: selectSeriesId, eq: eqSeriesId, single: singleSeriesId })
        .mockReturnValueOnce({ update, eq: eqSeries, select }),
    } as unknown as SupabaseClient;

    await updateEvent(
      client,
      "event-1",
      { title: "まとめ変更後", startAt: "2026-09-01T00:00:00.000Z", endAt: "2026-09-01T01:00:00.000Z" },
      "series"
    );

    expect(update).toHaveBeenCalledWith({ title: "まとめ変更後" });
  });
});

describe("deleteEvent", () => {
  it("deletes an event by id", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteEvent(client, "event-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("events");
    expect(eq).toHaveBeenCalledWith("id", "event-1");
  });

  it("maps a permission error to Forbidden", async () => {
    const eq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteEvent(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("deletes every event sharing the series_id when scope is series", async () => {
    const seriesRow = { series_id: "series-1" };
    const selectSeriesId = jest.fn().mockReturnThis();
    const eqSeriesId = jest.fn().mockReturnThis();
    const singleSeriesId = jest.fn().mockResolvedValue({ data: seriesRow, error: null });

    const del = jest.fn().mockReturnThis();
    const eqSeries = jest.fn().mockResolvedValue({ error: null });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: selectSeriesId, eq: eqSeriesId, single: singleSeriesId })
        .mockReturnValueOnce({ delete: del, eq: eqSeries }),
    } as unknown as SupabaseClient;

    const result = await deleteEvent(client, "event-1", "series");

    expect(eqSeriesId).toHaveBeenCalledWith("id", "event-1");
    expect(eqSeries).toHaveBeenCalledWith("series_id", "series-1");
    expect(result).toEqual({ ok: true, value: undefined });
  });
});

describe("createRecurringSeries", () => {
  const validInput = {
    calendarId: "cal-1",
    title: "毎週ミーティング",
    startAt: "2026-09-01T10:00:00.000Z",
    endAt: "2026-09-01T11:00:00.000Z",
    recurrenceRule: "weekly" as const,
    recurrenceEndAt: "2026-09-15T10:00:00.000Z",
  };

  it("calls the create_recurring_series RPC and returns the generated events", async () => {
    const rows = [
      {
        id: "event-1",
        calendar_id: "cal-1",
        series_id: "series-1",
        title: "毎週ミーティング",
        location: null,
        memo: null,
        category_color: null,
        start_at: "2026-09-01T10:00:00.000Z",
        end_at: "2026-09-01T11:00:00.000Z",
        is_all_day: false,
        reminder_at: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: "2026-08-17T00:00:00.000Z",
        updated_at: "2026-08-17T00:00:00.000Z",
      },
      {
        id: "event-2",
        calendar_id: "cal-1",
        series_id: "series-1",
        title: "毎週ミーティング",
        location: null,
        memo: null,
        category_color: null,
        start_at: "2026-09-08T10:00:00.000Z",
        end_at: "2026-09-08T11:00:00.000Z",
        is_all_day: false,
        reminder_at: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: "2026-08-17T00:00:00.000Z",
        updated_at: "2026-08-17T00:00:00.000Z",
      },
    ];
    const rpc = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await createRecurringSeries(client, validInput);

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "event-1",
          calendarId: "cal-1",
          seriesId: "series-1",
          title: "毎週ミーティング",
          location: null,
          memo: null,
          categoryColor: null,
          startAt: "2026-09-01T10:00:00.000Z",
          endAt: "2026-09-01T11:00:00.000Z",
          isAllDay: false,
          reminderAt: null,
          createdBy: "user-1",
          updatedBy: "user-1",
          createdAt: "2026-08-17T00:00:00.000Z",
          updatedAt: "2026-08-17T00:00:00.000Z",
        },
        {
          id: "event-2",
          calendarId: "cal-1",
          seriesId: "series-1",
          title: "毎週ミーティング",
          location: null,
          memo: null,
          categoryColor: null,
          startAt: "2026-09-08T10:00:00.000Z",
          endAt: "2026-09-08T11:00:00.000Z",
          isAllDay: false,
          reminderAt: null,
          createdBy: "user-1",
          updatedBy: "user-1",
          createdAt: "2026-08-17T00:00:00.000Z",
          updatedAt: "2026-08-17T00:00:00.000Z",
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("create_recurring_series", {
      p_calendar_id: "cal-1",
      p_title: "毎週ミーティング",
      p_start_at: "2026-09-01T10:00:00.000Z",
      p_end_at: "2026-09-01T11:00:00.000Z",
      p_recurrence_rule: "weekly",
      p_recurrence_end_at: "2026-09-15T10:00:00.000Z",
      p_is_all_day: false,
      p_location: null,
      p_memo: null,
      p_category_color: null,
      p_reminder_at: null,
    });
  });

  it("returns InvalidRecurrenceRange without calling the RPC when recurrenceEndAt is empty", async () => {
    const rpc = jest.fn();
    const client = { rpc } as unknown as SupabaseClient;

    const result = await createRecurringSeries(client, { ...validInput, recurrenceEndAt: "" });

    expect(result).toEqual({ ok: false, error: { type: "InvalidRecurrenceRange" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns InvalidRecurrenceRange without calling the RPC when recurrenceEndAt is more than 1 year after startAt", async () => {
    const rpc = jest.fn();
    const client = { rpc } as unknown as SupabaseClient;

    const result = await createRecurringSeries(client, {
      ...validInput,
      startAt: "2026-01-01T00:00:00.000Z",
      recurrenceEndAt: "2027-01-02T00:00:00.000Z",
    });

    expect(result).toEqual({ ok: false, error: { type: "InvalidRecurrenceRange" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns InvalidDateRange without calling the RPC when endAt is before startAt", async () => {
    const rpc = jest.fn();
    const client = { rpc } as unknown as SupabaseClient;

    const result = await createRecurringSeries(client, {
      ...validInput,
      endAt: "2026-09-01T09:00:00.000Z",
    });

    expect(result).toEqual({ ok: false, error: { type: "InvalidDateRange" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await createRecurringSeries(client, validInput);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("maps a recurrence range error from the RPC to InvalidRecurrenceRange", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "invalid recurrence range", code: "A0003" },
    });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await createRecurringSeries(client, validInput);

    expect(result).toEqual({ ok: false, error: { type: "InvalidRecurrenceRange" } });
  });
});

describe("listEventsInRange", () => {
  it("queries events within the given range and returns them ordered by start time", async () => {
    const rows = [
      {
        id: "event-1",
        calendar_id: "cal-1",
        series_id: null,
        title: "会議",
        location: null,
        memo: null,
        category_color: "#2f6fed",
        start_at: "2026-09-01T10:00:00.000Z",
        end_at: "2026-09-01T11:00:00.000Z",
        is_all_day: false,
        reminder_at: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: "2026-08-17T00:00:00.000Z",
        updated_at: "2026-08-17T00:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const lte = jest.fn().mockReturnThis();
    const gte = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, lte, gte, order }),
    } as unknown as SupabaseClient;

    const result = await listEventsInRange(client, "cal-1", {
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-09-30T23:59:59.999Z",
    });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "event-1",
          calendarId: "cal-1",
          seriesId: null,
          title: "会議",
          location: null,
          memo: null,
          categoryColor: "#2f6fed",
          startAt: "2026-09-01T10:00:00.000Z",
          endAt: "2026-09-01T11:00:00.000Z",
          isAllDay: false,
          reminderAt: null,
          createdBy: "user-1",
          updatedBy: "user-1",
          createdAt: "2026-08-17T00:00:00.000Z",
          updatedAt: "2026-08-17T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("events");
    expect(eq).toHaveBeenCalledWith("calendar_id", "cal-1");
    expect(lte).toHaveBeenCalledWith("start_at", "2026-09-30T23:59:59.999Z");
    expect(gte).toHaveBeenCalledWith("end_at", "2026-09-01T00:00:00.000Z");
    expect(order).toHaveBeenCalledWith("start_at", { ascending: true });
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const lte = jest.fn().mockReturnThis();
    const gte = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, lte, gte, order }),
    } as unknown as SupabaseClient;

    const result = await listEventsInRange(client, "cal-1", {
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-09-30T23:59:59.999Z",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("setReminderTargets", () => {
  it("clears existing targets and inserts the given member ids", async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq: deleteEq });
    const insert = jest.fn().mockResolvedValue({ error: null });

    const client = {
      from: jest.fn().mockReturnValueOnce({ delete: del }).mockReturnValueOnce({ insert }),
    } as unknown as SupabaseClient;

    const result = await setReminderTargets(client, "event-1", ["user-1", "user-2"]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deleteEq).toHaveBeenCalledWith("event_id", "event-1");
    expect(insert).toHaveBeenCalledWith([
      { event_id: "event-1", user_id: "user-1" },
      { event_id: "event-1", user_id: "user-2" },
    ]);
  });

  it("only clears existing targets without inserting when set to all members", async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq: deleteEq });
    const insert = jest.fn();

    const client = {
      from: jest.fn().mockReturnValueOnce({ delete: del }).mockReturnValueOnce({ insert }),
    } as unknown as SupabaseClient;

    const result = await setReminderTargets(client, "event-1", "all");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(deleteEq).toHaveBeenCalledWith("event_id", "event-1");
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats an empty member list the same as all members", async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq: deleteEq });
    const insert = jest.fn();

    const client = {
      from: jest.fn().mockReturnValueOnce({ delete: del }).mockReturnValueOnce({ insert }),
    } as unknown as SupabaseClient;

    const result = await setReminderTargets(client, "event-1", []);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(insert).not.toHaveBeenCalled();
  });

  it("maps a permission error from the delete step to Forbidden", async () => {
    const deleteEq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const del = jest.fn().mockReturnValue({ eq: deleteEq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await setReminderTargets(client, "event-1", ["user-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("maps a permission error from the insert step to Forbidden", async () => {
    const deleteEq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq: deleteEq });
    const insert = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });

    const client = {
      from: jest.fn().mockReturnValueOnce({ delete: del }).mockReturnValueOnce({ insert }),
    } as unknown as SupabaseClient;

    const result = await setReminderTargets(client, "event-1", ["user-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("getEvent", () => {
  it("returns the event on success", async () => {
    const row = {
      id: "event-1",
      calendar_id: "cal-1",
      series_id: null,
      title: "会議",
      location: null,
      memo: null,
      category_color: "#2f6fed",
      start_at: "2026-09-01T10:00:00.000Z",
      end_at: "2026-09-01T11:00:00.000Z",
      is_all_day: false,
      reminder_at: null,
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
      updated_at: "2026-08-17T00:00:00.000Z",
    };
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, single }),
    } as unknown as SupabaseClient;

    const result = await getEvent(client, "event-1");

    expect(result).toEqual({
      ok: true,
      value: {
        id: "event-1",
        calendarId: "cal-1",
        seriesId: null,
        title: "会議",
        location: null,
        memo: null,
        categoryColor: "#2f6fed",
        startAt: "2026-09-01T10:00:00.000Z",
        endAt: "2026-09-01T11:00:00.000Z",
        isAllDay: false,
        reminderAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-17T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("events");
    expect(eq).toHaveBeenCalledWith("id", "event-1");
  });

  it("maps a missing row to NotFound", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "no rows returned", code: "PGRST116" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, single }),
    } as unknown as SupabaseClient;

    const result = await getEvent(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "NotFound" } });
  });
});

describe("getEventErrorMessageJa", () => {
  it("returns a Japanese message for each known error type", () => {
    expect(getEventErrorMessageJa({ type: "NotFound" })).toContain("見つかりません");
    expect(getEventErrorMessageJa({ type: "Forbidden" })).toContain("権限がありません");
    expect(getEventErrorMessageJa({ type: "InvalidDateRange" })).toContain("開始日時より後");
    expect(getEventErrorMessageJa({ type: "InvalidRecurrenceRange" })).toContain("1年以内");
  });
});
