import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
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
import {
  useCreateTodo,
  useDeleteTodo,
  useOrphanedTodos,
  useReattachTodoToExistingEvent,
  useReattachTodoToNewPersonalEvent,
  useToggleDone,
  useTodosByCalendars,
  useTodosByEvent,
  useUpdateTodo,
} from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  createTodo: jest.fn(),
  listOrphanedTodos: jest.fn(),
  listTodosByCalendars: jest.fn(),
  listTodosByEvent: jest.fn(),
  reattachTodoToExistingEvent: jest.fn(),
  reattachTodoToNewPersonalEvent: jest.fn(),
  toggleDone: jest.fn(),
  updateTodo: jest.fn(),
  deleteTodo: jest.fn(),
}));

describe("useCreateTodo", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when creation succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createTodo as jest.Mock).mockResolvedValue({ ok: true, value: { id: "todo-1" } });

    const { result } = await renderHook(() => useCreateTodo());

    let success = false;
    await act(async () => {
      success = await result.current.createTodo({ eventId: "event-1", title: "飲み物を買う" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(createTodo).toHaveBeenCalledWith({}, { eventId: "event-1", title: "飲み物を買う" });
  });

  it("returns false and sets the error when creation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createTodo as jest.Mock).mockResolvedValue({
      ok: false,
      error: { type: "ValidationError", field: "title" },
    });

    const { result } = await renderHook(() => useCreateTodo());

    let success = true;
    await act(async () => {
      success = await result.current.createTodo({ eventId: "event-1", title: "" });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "ValidationError", field: "title" });
  });
});

describe("useTodosByCalendars", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads todos for the given calendars on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const todos = [{ id: "todo-1", eventId: "event-1", eventCalendarId: "cal-1", title: "飲み物を買う", isDone: false }];
    (listTodosByCalendars as jest.Mock).mockResolvedValue({ ok: true, value: todos });

    const { result } = await renderHook(() => useTodosByCalendars(["cal-1", "cal-2"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.todos).toEqual(todos);
    expect(listTodosByCalendars).toHaveBeenCalledWith({}, ["cal-1", "cal-2"]);
  });

  it("reloads when the set of calendar ids changes", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listTodosByCalendars as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result, rerender } = await renderHook(
      ({ calendarIds }: { calendarIds: string[] }) => useTodosByCalendars(calendarIds),
      { initialProps: { calendarIds: ["cal-1"] } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await rerender({ calendarIds: ["cal-1", "cal-2"] });

    await waitFor(() =>
      expect(listTodosByCalendars).toHaveBeenLastCalledWith({}, ["cal-1", "cal-2"])
    );
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listTodosByCalendars as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useTodosByCalendars(["cal-1"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.todos).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("subscribes to realtime changes on the todos table and refetches on change", async () => {
    const channel = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = { channel: jest.fn(() => channel) };
    (getSupabaseClient as jest.Mock).mockReturnValue(client);
    (listTodosByCalendars as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    await renderHook(() => useTodosByCalendars(["cal-1"]));

    await waitFor(() => expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^todos-multi-/)));
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "todos" },
      expect.any(Function)
    );

    const onChange = channel.on.mock.calls[0][2];
    (listTodosByCalendars as jest.Mock).mockClear();
    await act(async () => {
      await onChange();
    });

    await waitFor(() => expect(listTodosByCalendars).toHaveBeenCalled());
  });
});

describe("useOrphanedTodos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the caller's orphaned todos on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const todos = [{ id: "todo-1", eventId: null, title: "宛名を書く", isDone: false }];
    (listOrphanedTodos as jest.Mock).mockResolvedValue({ ok: true, value: todos });

    const { result } = await renderHook(() => useOrphanedTodos());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.todos).toEqual(todos);
    expect(listOrphanedTodos).toHaveBeenCalledWith({});
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listOrphanedTodos as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useOrphanedTodos());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.todos).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useReattachTodoToExistingEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (reattachTodoToExistingEvent as jest.Mock).mockResolvedValue({ ok: true, value: { id: "todo-1" } });

    const { result } = await renderHook(() => useReattachTodoToExistingEvent());

    let success = false;
    await act(async () => {
      success = await result.current.reattachTodoToExistingEvent("todo-1", "event-2");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(reattachTodoToExistingEvent).toHaveBeenCalledWith({}, "todo-1", "event-2");
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (reattachTodoToExistingEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useReattachTodoToExistingEvent());

    let success = true;
    await act(async () => {
      success = await result.current.reattachTodoToExistingEvent("todo-1", "event-2");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useReattachTodoToNewPersonalEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (reattachTodoToNewPersonalEvent as jest.Mock).mockResolvedValue({ ok: true, value: { id: "todo-1" } });

    const { result } = await renderHook(() => useReattachTodoToNewPersonalEvent());

    let success = false;
    await act(async () => {
      success = await result.current.reattachTodoToNewPersonalEvent("todo-1", {
        title: "出発準備の日",
        date: "2026-10-05",
      });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(reattachTodoToNewPersonalEvent).toHaveBeenCalledWith({}, "todo-1", {
      title: "出発準備の日",
      date: "2026-10-05",
    });
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (reattachTodoToNewPersonalEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "NotFound" } });

    const { result } = await renderHook(() => useReattachTodoToNewPersonalEvent());

    let success = true;
    await act(async () => {
      success = await result.current.reattachTodoToNewPersonalEvent("todo-1", {
        title: "出発準備の日",
        date: "2026-10-05",
      });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "NotFound" });
  });
});

describe("useTodosByEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads todos for the given event on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const todos = [{ id: "todo-1", eventId: "event-1", title: "飲み物を買う", isDone: false }];
    (listTodosByEvent as jest.Mock).mockResolvedValue({ ok: true, value: todos });

    const { result } = await renderHook(() => useTodosByEvent("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.todos).toEqual(todos);
    expect(listTodosByEvent).toHaveBeenCalledWith({}, "event-1");
  });

  it("reloads when the event id changes", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listTodosByEvent as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result, rerender } = await renderHook(
      ({ eventId }: { eventId: string }) => useTodosByEvent(eventId),
      { initialProps: { eventId: "event-1" } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await rerender({ eventId: "event-2" });

    await waitFor(() => expect(listTodosByEvent).toHaveBeenLastCalledWith({}, "event-2"));
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listTodosByEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useTodosByEvent("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.todos).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useToggleDone", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (toggleDone as jest.Mock).mockResolvedValue({ ok: true, value: { id: "todo-1" } });

    const { result } = await renderHook(() => useToggleDone());

    let success = false;
    await act(async () => {
      success = await result.current.toggleDone("todo-1", true);
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(toggleDone).toHaveBeenCalledWith({}, "todo-1", true);
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (toggleDone as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useToggleDone());

    let success = true;
    await act(async () => {
      success = await result.current.toggleDone("todo-1", true);
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useUpdateTodo", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateTodo as jest.Mock).mockResolvedValue({ ok: true, value: { id: "todo-1" } });

    const { result } = await renderHook(() => useUpdateTodo());

    let success = false;
    await act(async () => {
      success = await result.current.updateTodo("todo-1", { title: "変更後" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(updateTodo).toHaveBeenCalledWith({}, "todo-1", { title: "変更後" });
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateTodo as jest.Mock).mockResolvedValue({
      ok: false,
      error: { type: "ValidationError", field: "title" },
    });

    const { result } = await renderHook(() => useUpdateTodo());

    let success = true;
    await act(async () => {
      success = await result.current.updateTodo("todo-1", { title: "" });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "ValidationError", field: "title" });
  });
});

describe("useDeleteTodo", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when deletion succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteTodo as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDeleteTodo());

    let success = false;
    await act(async () => {
      success = await result.current.deleteTodo("todo-1");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(deleteTodo).toHaveBeenCalledWith({}, "todo-1");
  });

  it("returns false and sets the error when deletion fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteTodo as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useDeleteTodo());

    let success = true;
    await act(async () => {
      success = await result.current.deleteTodo("todo-1");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
