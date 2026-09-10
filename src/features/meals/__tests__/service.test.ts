import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createMealRecord,
  createMealTag,
  deleteMealRecord,
  listMealRecords,
  listMealRecordsByCalendars,
  updateMealRecord,
} from "../service";

describe("createMealRecord", () => {
  it("creates a meal record and returns it on success", async () => {
    const row = {
      id: "meal-1",
      calendar_id: "cal-1",
      meal_date: "2026-08-20",
      slot: "breakfast",
      title: "トースト",
      rating: 4,
      url: null,
      memo: null,
      created_by: "user-1",
      created_at: "2026-08-18T00:00:00.000Z",
      updated_at: "2026-08-18T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createMealRecord(client, {
      calendarId: "cal-1",
      mealDate: "2026-08-20",
      slot: "breakfast",
      title: "トースト",
      rating: 4,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "meal-1",
        calendarId: "cal-1",
        mealDate: "2026-08-20",
        slot: "breakfast",
        title: "トースト",
        rating: 4,
        url: null,
        memo: null,
        createdBy: "user-1",
        createdAt: "2026-08-18T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("meal_records");
    expect(insert).toHaveBeenCalledWith({
      calendar_id: "cal-1",
      meal_date: "2026-08-20",
      slot: "breakfast",
      title: "トースト",
      rating: 4,
      url: null,
      memo: null,
    });
  });

  it("attaches the given meal tags after creating the record", async () => {
    const row = {
      id: "meal-1",
      calendar_id: "cal-1",
      meal_date: "2026-08-20",
      slot: "dinner",
      title: "カレー",
      rating: null,
      url: null,
      memo: null,
      created_by: "user-1",
      created_at: "2026-08-18T00:00:00.000Z",
      updated_at: "2026-08-18T00:00:00.000Z",
    };
    const insertRecord = jest.fn().mockReturnThis();
    const selectRecord = jest.fn().mockReturnThis();
    const singleRecord = jest.fn().mockResolvedValue({ data: row, error: null });
    const insertTags = jest.fn().mockResolvedValue({ error: null });

    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce({ insert: insertRecord, select: selectRecord, single: singleRecord })
        .mockReturnValueOnce({ insert: insertTags }),
    } as unknown as SupabaseClient;

    await createMealRecord(client, {
      calendarId: "cal-1",
      mealDate: "2026-08-20",
      slot: "dinner",
      title: "カレー",
      tagIds: ["mealtag-1", "mealtag-2"],
    });

    expect(insertTags).toHaveBeenCalledWith([
      { meal_record_id: "meal-1", meal_tag_id: "mealtag-1" },
      { meal_record_id: "meal-1", meal_tag_id: "mealtag-2" },
    ]);
  });

  it("returns a ValidationError without calling Supabase when the title is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await createMealRecord(client, {
      calendarId: "cal-1",
      mealDate: "2026-08-20",
      slot: "breakfast",
      title: "   ",
    });

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "title" } });
    expect(client.from).not.toHaveBeenCalled();
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

    const result = await createMealRecord(client, {
      calendarId: "cal-1",
      mealDate: "2026-08-20",
      slot: "breakfast",
      title: "トースト",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("createMealTag", () => {
  it("creates a meal tag and returns it on success", async () => {
    const row = {
      id: "mealtag-1",
      calendar_id: "cal-1",
      name: "和食",
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createMealTag(client, { calendarId: "cal-1", name: "和食" });

    expect(result).toEqual({
      ok: true,
      value: { id: "mealtag-1", calendarId: "cal-1", name: "和食", createdAt: "2026-08-18T00:00:00.000Z" },
    });
    expect(client.from).toHaveBeenCalledWith("meal_tags");
    expect(insert).toHaveBeenCalledWith({ calendar_id: "cal-1", name: "和食" });
  });

  it("returns a ValidationError without calling Supabase when the name is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await createMealTag(client, { calendarId: "cal-1", name: "  " });

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "name" } });
    expect(client.from).not.toHaveBeenCalled();
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

    const result = await createMealTag(client, { calendarId: "cal-1", name: "和食" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listMealRecords", () => {
  it("returns the meal records for the given calendar ordered by date", async () => {
    const rows = [
      {
        id: "meal-1",
        calendar_id: "cal-1",
        meal_date: "2026-08-19",
        slot: "breakfast",
        title: "トースト",
        rating: 4,
        url: null,
        memo: null,
        created_by: "user-1",
        created_at: "2026-08-18T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
      {
        id: "meal-2",
        calendar_id: "cal-1",
        meal_date: "2026-08-25",
        slot: "dinner",
        title: "カレー",
        rating: null,
        url: null,
        memo: null,
        created_by: "user-2",
        created_at: "2026-08-18T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    const result = await listMealRecords(client, "cal-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "meal-1",
          calendarId: "cal-1",
          mealDate: "2026-08-19",
          slot: "breakfast",
          title: "トースト",
          rating: 4,
          url: null,
          memo: null,
          createdBy: "user-1",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
        {
          id: "meal-2",
          calendarId: "cal-1",
          mealDate: "2026-08-25",
          slot: "dinner",
          title: "カレー",
          rating: null,
          url: null,
          memo: null,
          createdBy: "user-2",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("meal_records");
    expect(eq).toHaveBeenCalledWith("calendar_id", "cal-1");
    expect(order).toHaveBeenCalledWith("meal_date", { ascending: true });
  });

  it("filters by slot when given", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    await listMealRecords(client, "cal-1", { slot: "lunch" });

    expect(eq).toHaveBeenCalledWith("calendar_id", "cal-1");
    expect(eq).toHaveBeenCalledWith("slot", "lunch");
  });

  it("filters by date range when given", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const gte = jest.fn().mockReturnThis();
    const lte = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, gte, lte, order }),
    } as unknown as SupabaseClient;

    await listMealRecords(client, "cal-1", { dateRange: { start: "2026-08-01", end: "2026-08-31" } });

    expect(gte).toHaveBeenCalledWith("meal_date", "2026-08-01");
    expect(lte).toHaveBeenCalledWith("meal_date", "2026-08-31");
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

    const result = await listMealRecords(client, "cal-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listMealRecordsByCalendars", () => {
  it("returns the meal records across every given calendar, ordered by date", async () => {
    const rows = [
      {
        id: "meal-1",
        calendar_id: "cal-1",
        meal_date: "2026-08-19",
        slot: "breakfast",
        title: "トースト",
        rating: 4,
        url: null,
        memo: null,
        created_by: "user-1",
        created_at: "2026-08-18T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
      {
        id: "meal-2",
        calendar_id: "cal-2",
        meal_date: "2026-08-25",
        slot: "dinner",
        title: "カレー",
        rating: null,
        url: null,
        memo: null,
        created_by: "user-2",
        created_at: "2026-08-18T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn, order }),
    } as unknown as SupabaseClient;

    const result = await listMealRecordsByCalendars(client, ["cal-1", "cal-2"]);

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "meal-1",
          calendarId: "cal-1",
          mealDate: "2026-08-19",
          slot: "breakfast",
          title: "トースト",
          rating: 4,
          url: null,
          memo: null,
          createdBy: "user-1",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
        {
          id: "meal-2",
          calendarId: "cal-2",
          mealDate: "2026-08-25",
          slot: "dinner",
          title: "カレー",
          rating: null,
          url: null,
          memo: null,
          createdBy: "user-2",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("meal_records");
    expect(inFn).toHaveBeenCalledWith("calendar_id", ["cal-1", "cal-2"]);
    expect(order).toHaveBeenCalledWith("meal_date", { ascending: true });
  });

  it("returns an empty array without querying when given no calendar ids", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await listMealRecordsByCalendars(client, []);

    expect(result).toEqual({ ok: true, value: [] });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn, order }),
    } as unknown as SupabaseClient;

    const result = await listMealRecordsByCalendars(client, ["cal-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("updateMealRecord", () => {
  it("updates a meal record and returns it on success", async () => {
    const row = {
      id: "meal-1",
      calendar_id: "cal-1",
      meal_date: "2026-08-20",
      slot: "breakfast",
      title: "トーストとコーヒー",
      rating: 5,
      url: null,
      memo: null,
      created_by: "user-1",
      created_at: "2026-08-18T00:00:00.000Z",
      updated_at: "2026-08-19T00:00:00.000Z",
    };
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateMealRecord(client, "meal-1", { title: "トーストとコーヒー", rating: 5 });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "meal-1",
        calendarId: "cal-1",
        mealDate: "2026-08-20",
        slot: "breakfast",
        title: "トーストとコーヒー",
        rating: 5,
        url: null,
        memo: null,
        createdBy: "user-1",
        createdAt: "2026-08-18T00:00:00.000Z",
        updatedAt: "2026-08-19T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("meal_records");
    expect(update).toHaveBeenCalledWith({ title: "トーストとコーヒー", rating: 5 });
    expect(eq).toHaveBeenCalledWith("id", "meal-1");
  });

  it("returns a ValidationError without calling Supabase when the title is emptied", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await updateMealRecord(client, "meal-1", { title: "   " });

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "title" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a permission error to Forbidden", async () => {
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

    const result = await updateMealRecord(client, "meal-1", { title: "変更" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("deleteMealRecord", () => {
  it("deletes the given meal record", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteMealRecord(client, "meal-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("meal_records");
    expect(eq).toHaveBeenCalledWith("id", "meal-1");
  });

  it("maps a permission error to Forbidden", async () => {
    const eq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteMealRecord(client, "meal-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
