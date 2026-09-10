import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type {
  CreatePersonalEventForTodoInput,
  CreateTodoInput,
  Todo,
  TodoError,
  TodoWithEventTitle,
  UpdateTodoInput,
} from "./types";

interface TodoRow {
  id: string;
  event_id: string | null;
  title: string;
  is_done: boolean;
  completed_at: string | null;
  reminder_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TodoRowWithEvent extends TodoRow {
  event_id: string;
  events: { calendar_id: string; title: string; start_at: string; end_at: string; is_all_day: boolean };
}

function mapTodoRow(row: TodoRow): Todo {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    isDone: row.is_done,
    completedAt: row.completed_at,
    reminderAt: row.reminder_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTodoRowWithEventTitle(row: TodoRowWithEvent): TodoWithEventTitle {
  return {
    ...mapTodoRow(row),
    eventId: row.event_id,
    eventCalendarId: row.events.calendar_id,
    eventTitle: row.events.title,
    eventStartAt: row.events.start_at,
    eventEndAt: row.events.end_at,
    eventIsAllDay: row.events.is_all_day,
  };
}

function mapTodoError(error: PostgrestError): TodoError {
  if (error.code === "A0001" || error.code === "A0005") {
    return { type: "NotFound" };
  }
  return { type: "Forbidden" };
}

export async function createTodo(
  client: SupabaseClient,
  input: CreateTodoInput
): Promise<Result<Todo, TodoError>> {
  if (!input.title.trim()) {
    return err({ type: "ValidationError", field: "title" });
  }

  const payload: Record<string, unknown> = { event_id: input.eventId, title: input.title };
  if (input.reminderAt !== undefined) payload.reminder_at = input.reminderAt;

  const { data, error } = await client.from("todos").insert(payload).select().single();

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok(mapTodoRow(data as TodoRow));
}

/** Lists todos scoped to any of the given calendars (e.g. the ToDo tab's
 * multi-select view, which defaults to all of the caller's calendars). */
export async function listTodosByCalendars(
  client: SupabaseClient,
  calendarIds: string[]
): Promise<Result<TodoWithEventTitle[], TodoError>> {
  if (calendarIds.length === 0) {
    return ok([]);
  }

  const { data, error } = await client
    .from("todos")
    .select("*, events!inner(calendar_id, title, start_at, end_at, is_all_day)")
    .in("events.calendar_id", calendarIds);

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok((data as TodoRowWithEvent[]).map(mapTodoRowWithEventTitle));
}

export async function toggleDone(
  client: SupabaseClient,
  todoId: string,
  isDone: boolean
): Promise<Result<Todo, TodoError>> {
  const { data, error } = await client
    .from("todos")
    .update({ is_done: isDone, completed_at: isDone ? new Date().toISOString() : null })
    .eq("id", todoId)
    .select()
    .single();

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok(mapTodoRow(data as TodoRow));
}

export async function updateTodo(
  client: SupabaseClient,
  todoId: string,
  input: UpdateTodoInput
): Promise<Result<Todo, TodoError>> {
  if (input.title !== undefined && !input.title.trim()) {
    return err({ type: "ValidationError", field: "title" });
  }

  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.reminderAt !== undefined) payload.reminder_at = input.reminderAt;

  const { data, error } = await client
    .from("todos")
    .update(payload)
    .eq("id", todoId)
    .select()
    .single();

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok(mapTodoRow(data as TodoRow));
}

export async function deleteTodo(
  client: SupabaseClient,
  todoId: string
): Promise<Result<void, TodoError>> {
  const { error } = await client.from("todos").delete().eq("id", todoId);

  if (error) {
    return err(mapTodoError(error));
  }

  return ok(undefined);
}

export async function listOrphanedTodos(client: SupabaseClient): Promise<Result<Todo[], TodoError>> {
  const { data, error } = await client.from("todos").select().is("event_id", null);

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok((data as TodoRow[]).map(mapTodoRow));
}

export async function reattachTodoToExistingEvent(
  client: SupabaseClient,
  todoId: string,
  eventId: string
): Promise<Result<Todo, TodoError>> {
  const { data, error } = await client
    .from("todos")
    .update({ event_id: eventId })
    .eq("id", todoId)
    .select()
    .single();

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok(mapTodoRow(data as TodoRow));
}

export async function reattachTodoToNewPersonalEvent(
  client: SupabaseClient,
  todoId: string,
  input: CreatePersonalEventForTodoInput
): Promise<Result<Todo, TodoError>> {
  const { data, error } = await client
    .rpc("reattach_todo_to_new_personal_event", {
      p_todo_id: todoId,
      p_title: input.title,
      p_date: input.date,
    })
    .single();

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok(mapTodoRow(data as TodoRow));
}

export async function listTodosByEvent(
  client: SupabaseClient,
  eventId: string
): Promise<Result<Todo[], TodoError>> {
  const { data, error } = await client.from("todos").select().eq("event_id", eventId);

  if (error || !data) {
    return err(mapTodoError(error as PostgrestError));
  }

  return ok((data as TodoRow[]).map(mapTodoRow));
}
