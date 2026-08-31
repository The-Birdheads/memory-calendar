import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { CreateTodoInput, Todo, TodoError, TodoWithEventTitle, UpdateTodoInput } from "./types";

interface TodoRow {
  id: string;
  event_id: string;
  title: string;
  is_done: boolean;
  completed_at: string | null;
  reminder_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TodoRowWithEvent extends TodoRow {
  events: { calendar_id: string; title: string };
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
  return { ...mapTodoRow(row), eventTitle: row.events.title };
}

function mapTodoError(error: PostgrestError): TodoError {
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

export async function listTodosByCalendar(
  client: SupabaseClient,
  calendarId: string
): Promise<Result<TodoWithEventTitle[], TodoError>> {
  const { data, error } = await client
    .from("todos")
    .select("*, events!inner(calendar_id, title)")
    .eq("events.calendar_id", calendarId);

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
