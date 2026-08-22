import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createTodo,
  deleteTodo,
  listTodosByCalendar,
  listTodosByEvent,
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

describe("listTodosByCalendar", () => {
  it("returns the todos for events belonging to the given calendar", async () => {
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
        events: { calendar_id: "cal-1" },
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
        events: { calendar_id: "cal-1" },
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq }),
    } as unknown as SupabaseClient;

    const result = await listTodosByCalendar(client, "cal-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "todo-1",
          eventId: "event-1",
          title: "飲み物を買う",
          isDone: false,
          completedAt: null,
          createdBy: "user-1",
          createdAt: "2026-08-18T00:00:00.000Z",
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
        {
          id: "todo-2",
          eventId: "event-2",
          title: "会場を予約する",
          isDone: true,
          completedAt: "2026-08-17T00:00:00.000Z",
          createdBy: "user-1",
          createdAt: "2026-08-17T00:00:00.000Z",
          updatedAt: "2026-08-17T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("todos");
    expect(select).toHaveBeenCalledWith("*, events!inner(calendar_id)");
    expect(eq).toHaveBeenCalledWith("events.calendar_id", "cal-1");
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

    const result = await listTodosByCalendar(client, "cal-1");

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
