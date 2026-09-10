import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createTodo,
  deleteTodo,
  listOrphanedTodos,
  listTodosByCalendars,
  listTodosByEvent,
  reattachTodoToExistingEvent,
  reattachTodoToNewPersonalEvent,
  toggleDone,
  updateTodo,
} from "../service";

describe("createTodo", () => {
  it("creates a todo linked to the given event and returns it on success", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-1",
      title: "飲み物を買う",
      is_done: false,
      completed_at: null,
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

    const result = await createTodo(client, { eventId: "event-1", title: "飲み物を買う" });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "todo-1",
        eventId: "event-1",
        title: "飲み物を買う",
        isDone: false,
        completedAt: null,
        createdBy: "user-1",
        createdAt: "2026-08-18T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("todos");
    expect(insert).toHaveBeenCalledWith({ event_id: "event-1", title: "飲み物を買う" });
  });

  it("returns a ValidationError without calling Supabase when the title is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await createTodo(client, { eventId: "event-1", title: "   " });

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

    const result = await createTodo(client, { eventId: "event-1", title: "飲み物を買う" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("includes reminderAt in the insert payload when provided", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-1",
      title: "飲み物を買う",
      is_done: false,
      completed_at: null,
      reminder_at: "2026-08-19T09:00:00.000Z",
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

    const result = await createTodo(client, {
      eventId: "event-1",
      title: "飲み物を買う",
      reminderAt: "2026-08-19T09:00:00.000Z",
    });

    expect(insert).toHaveBeenCalledWith({
      event_id: "event-1",
      title: "飲み物を買う",
      reminder_at: "2026-08-19T09:00:00.000Z",
    });
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ reminderAt: "2026-08-19T09:00:00.000Z" }),
    });
  });
});

describe("listTodosByCalendars", () => {
  it("returns the todos for events belonging to any of the given calendars", async () => {
    const rows = [
      {
        id: "todo-1",
        event_id: "event-1",
        title: "飲み物を買う",
        is_done: false,
        completed_at: null,
        created_by: "user-1",
        created_at: "2026-08-18T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
        events: {
          calendar_id: "cal-1",
          title: "誕生日会",
          start_at: "2026-08-20T10:00:00.000Z",
          end_at: "2026-08-20T12:00:00.000Z",
          is_all_day: false,
        },
      },
      {
        id: "todo-2",
        event_id: "event-2",
        title: "会場を予約する",
        is_done: true,
        completed_at: "2026-08-17T00:00:00.000Z",
        created_by: "user-1",
        created_at: "2026-08-17T00:00:00.000Z",
        updated_at: "2026-08-17T00:00:00.000Z",
        events: {
          calendar_id: "cal-2",
          title: "夏祭り",
          start_at: "2026-07-15T09:00:00.000Z",
          end_at: "2026-07-16T09:00:00.000Z",
          is_all_day: true,
        },
      },
    ];
    const select = jest.fn().mockReturnThis();
    const inFilter = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFilter }),
    } as unknown as SupabaseClient;

    const result = await listTodosByCalendars(client, ["cal-1", "cal-2"]);

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "todo-1",
          eventId: "event-1",
          eventCalendarId: "cal-1",
          title: "飲み物を買う",
          isDone: false,
          completedAt: null,
          createdBy: "user-1",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
          eventTitle: "誕生日会",
          eventStartAt: "2026-08-20T10:00:00.000Z",
          eventEndAt: "2026-08-20T12:00:00.000Z",
          eventIsAllDay: false,
        },
        {
          id: "todo-2",
          eventId: "event-2",
          eventCalendarId: "cal-2",
          title: "会場を予約する",
          isDone: true,
          completedAt: "2026-08-17T00:00:00.000Z",
          createdBy: "user-1",
          createdAt: "2026-08-17T00:00:00.000Z",
          updatedAt: "2026-08-17T00:00:00.000Z",
          eventTitle: "夏祭り",
          eventStartAt: "2026-07-15T09:00:00.000Z",
          eventEndAt: "2026-07-16T09:00:00.000Z",
          eventIsAllDay: true,
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("todos");
    expect(select).toHaveBeenCalledWith("*, events!inner(calendar_id, title, start_at, end_at, is_all_day)");
    expect(inFilter).toHaveBeenCalledWith("events.calendar_id", ["cal-1", "cal-2"]);
  });

  it("returns an empty list without querying when given no calendar ids", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await listTodosByCalendars(client, []);

    expect(result).toEqual({ ok: true, value: [] });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const inFilter = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFilter }),
    } as unknown as SupabaseClient;

    const result = await listTodosByCalendars(client, ["cal-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("toggleDone", () => {
  it("marks a todo as done and sets completedAt", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-1",
      title: "飲み物を買う",
      is_done: true,
      completed_at: "2026-08-18T00:00:00.000Z",
      created_by: "user-1",
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

    const result = await toggleDone(client, "todo-1", true);

    expect(result).toEqual({
      ok: true,
      value: {
        id: "todo-1",
        eventId: "event-1",
        title: "飲み物を買う",
        isDone: true,
        completedAt: "2026-08-18T00:00:00.000Z",
        createdBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(update).toHaveBeenCalledWith({ is_done: true, completed_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("id", "todo-1");
  });

  it("marks a todo as not done and clears completedAt", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: {
        id: "todo-1",
        event_id: "event-1",
        title: "飲み物を買う",
        is_done: false,
        completed_at: null,
        created_by: "user-1",
        created_at: "2026-08-17T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
      error: null,
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    await toggleDone(client, "todo-1", false);

    expect(update).toHaveBeenCalledWith({ is_done: false, completed_at: null });
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

    const result = await toggleDone(client, "todo-1", true);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("updateTodo", () => {
  it("updates the todo title and returns it on success", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-1",
      title: "飲み物とお菓子を買う",
      is_done: false,
      completed_at: null,
      created_by: "user-1",
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

    const result = await updateTodo(client, "todo-1", { title: "飲み物とお菓子を買う" });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "todo-1",
        eventId: "event-1",
        title: "飲み物とお菓子を買う",
        isDone: false,
        completedAt: null,
        createdBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(update).toHaveBeenCalledWith({ title: "飲み物とお菓子を買う" });
  });

  it("returns a ValidationError without calling Supabase when the title is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await updateTodo(client, "todo-1", { title: "   " });

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

    const result = await updateTodo(client, "todo-1", { title: "変更" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("saves a reminder date and reflects it in the returned todo", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-1",
      title: "飲み物を買う",
      is_done: false,
      completed_at: null,
      reminder_at: "2026-08-19T09:00:00.000Z",
      created_by: "user-1",
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

    const result = await updateTodo(client, "todo-1", { reminderAt: "2026-08-19T09:00:00.000Z" });

    expect(update).toHaveBeenCalledWith({ reminder_at: "2026-08-19T09:00:00.000Z" });
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ reminderAt: "2026-08-19T09:00:00.000Z" }),
    });
  });

  it("clears the reminder date when reminderAt is set to null", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-1",
      title: "飲み物を買う",
      is_done: false,
      completed_at: null,
      reminder_at: null,
      created_by: "user-1",
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

    await updateTodo(client, "todo-1", { reminderAt: null });

    expect(update).toHaveBeenCalledWith({ reminder_at: null });
  });
});

describe("deleteTodo", () => {
  it("deletes the given todo", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteTodo(client, "todo-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("todos");
    expect(eq).toHaveBeenCalledWith("id", "todo-1");
  });

  it("maps a permission error to Forbidden", async () => {
    const eq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteTodo(client, "todo-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listOrphanedTodos", () => {
  it("returns todos whose event_id is null", async () => {
    const rows = [
      {
        id: "todo-1",
        event_id: null,
        title: "宛名を書く",
        is_done: false,
        completed_at: null,
        created_by: "user-1",
        created_at: "2026-08-18T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
    ];
    const is = jest.fn().mockResolvedValue({ data: rows, error: null });
    const select = jest.fn().mockReturnValue({ is });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await listOrphanedTodos(client);

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "todo-1",
          eventId: null,
          title: "宛名を書く",
          isDone: false,
          completedAt: null,
          createdBy: "user-1",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("todos");
    expect(is).toHaveBeenCalledWith("event_id", null);
  });

  it("maps a Supabase error to Forbidden", async () => {
    const is = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const select = jest.fn().mockReturnValue({ is });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await listOrphanedTodos(client);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("reattachTodoToExistingEvent", () => {
  it("sets the todo's event_id and returns it on success", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-2",
      title: "宛名を書く",
      is_done: false,
      completed_at: null,
      created_by: "user-1",
      created_at: "2026-08-18T00:00:00.000Z",
      updated_at: "2026-08-18T00:00:00.000Z",
    };
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await reattachTodoToExistingEvent(client, "todo-1", "event-2");

    expect(result).toEqual({
      ok: true,
      value: {
        id: "todo-1",
        eventId: "event-2",
        title: "宛名を書く",
        isDone: false,
        completedAt: null,
        createdBy: "user-1",
        createdAt: "2026-08-18T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("todos");
    expect(update).toHaveBeenCalledWith({ event_id: "event-2" });
    expect(eq).toHaveBeenCalledWith("id", "todo-1");
  });

  it("maps an RLS/permission error to Forbidden (e.g. the target event isn't visible to the caller)", async () => {
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

    const result = await reattachTodoToExistingEvent(client, "todo-1", "event-2");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("reattachTodoToNewPersonalEvent", () => {
  it("calls the reattach RPC and returns the updated todo on success", async () => {
    const row = {
      id: "todo-1",
      event_id: "event-new",
      title: "宛名を書く",
      is_done: false,
      completed_at: null,
      created_by: "user-1",
      created_at: "2026-08-18T00:00:00.000Z",
      updated_at: "2026-08-18T00:00:00.000Z",
    };
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      rpc: jest.fn().mockReturnValue({ single }),
    } as unknown as SupabaseClient;

    const result = await reattachTodoToNewPersonalEvent(client, "todo-1", {
      title: "出発準備の日",
      date: "2026-10-05",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "todo-1",
        eventId: "event-new",
        title: "宛名を書く",
        isDone: false,
        completedAt: null,
        createdBy: "user-1",
        createdAt: "2026-08-18T00:00:00.000Z",
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.rpc).toHaveBeenCalledWith("reattach_todo_to_new_personal_event", {
      p_todo_id: "todo-1",
      p_title: "出発準備の日",
      p_date: "2026-10-05",
    });
  });

  it("maps a NotFound error when the caller has no personal calendar", async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "personal_calendar_not_found", code: "A0005" },
    });
    const client = {
      rpc: jest.fn().mockReturnValue({ single }),
    } as unknown as SupabaseClient;

    const result = await reattachTodoToNewPersonalEvent(client, "todo-1", {
      title: "出発準備の日",
      date: "2026-10-05",
    });

    expect(result).toEqual({ ok: false, error: { type: "NotFound" } });
  });

  it("maps an RLS/permission error to Forbidden when the caller doesn't own the todo", async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      rpc: jest.fn().mockReturnValue({ single }),
    } as unknown as SupabaseClient;

    const result = await reattachTodoToNewPersonalEvent(client, "todo-1", {
      title: "出発準備の日",
      date: "2026-10-05",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listTodosByEvent", () => {
  it("returns the todos for the given event", async () => {
    const rows = [
      {
        id: "todo-1",
        event_id: "event-1",
        title: "飲み物を買う",
        is_done: false,
        completed_at: null,
        reminder_at: null,
        created_by: "user-1",
        created_at: "2026-08-18T00:00:00.000Z",
        updated_at: "2026-08-18T00:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq }),
    } as unknown as SupabaseClient;

    const result = await listTodosByEvent(client, "event-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "todo-1",
          eventId: "event-1",
          title: "飲み物を買う",
          isDone: false,
          completedAt: null,
          reminderAt: null,
          createdBy: "user-1",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("todos");
    expect(eq).toHaveBeenCalledWith("event_id", "event-1");
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq }),
    } as unknown as SupabaseClient;

    const result = await listTodosByEvent(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
