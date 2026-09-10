import { useCallback, useEffect, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
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
} from "./service";
import type {
  CreatePersonalEventForTodoInput,
  CreateTodoInput,
  Todo,
  TodoError,
  TodoWithEventTitle,
  UpdateTodoInput,
} from "./types";

export interface UseCreateTodoResult {
  createTodo: (input: CreateTodoInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: TodoError | null;
}

export function useCreateTodo(): UseCreateTodoResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TodoError | null>(null);

  const runCreateTodo = useCallback(async (input: CreateTodoInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createTodo(getSupabaseClient(), input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { createTodo: runCreateTodo, isSubmitting, error };
}

export interface UseTodosByCalendarsResult {
  todos: TodoWithEventTitle[];
  isLoading: boolean;
  error: TodoError | null;
  refetch: () => Promise<void>;
}

/** Todos across the given calendars (e.g. the ToDo tab's multi-select view,
 * which defaults to all of the caller's calendars). */
export function useTodosByCalendars(calendarIds: string[]): UseTodosByCalendarsResult {
  const [todos, setTodos] = useState<TodoWithEventTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TodoError | null>(null);
  const calendarIdsKey = calendarIds.join(",");

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listTodosByCalendars(getSupabaseClient(), calendarIds);
    if (result.ok) {
      setTodos(result.value);
      setError(null);
    } else {
      setTodos([]);
      setError(result.error);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarIdsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    // todosテーブル自体にはcalendar_id列がなく(event経由でしか分からない)、
    // postgres_changesではevents側をキーにしたフィルタができないため、
    // カレンダーを絞らず全件のtodos変更を購読してrefetchする。
    return subscribeToTableChanges(getSupabaseClient(), "todos-multi", "todos", refetch);
  }, [refetch]);

  return { todos, isLoading, error, refetch };
}

export interface UseOrphanedTodosResult {
  todos: Todo[];
  isLoading: boolean;
  error: TodoError | null;
  refetch: () => Promise<void>;
}

export function useOrphanedTodos(): UseOrphanedTodosResult {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TodoError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listOrphanedTodos(getSupabaseClient());
    if (result.ok) {
      setTodos(result.value);
      setError(null);
    } else {
      setTodos([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { todos, isLoading, error, refetch };
}

export interface UseReattachTodoToExistingEventResult {
  reattachTodoToExistingEvent: (todoId: string, eventId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: TodoError | null;
}

export function useReattachTodoToExistingEvent(): UseReattachTodoToExistingEventResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TodoError | null>(null);

  const run = useCallback(async (todoId: string, eventId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await reattachTodoToExistingEvent(getSupabaseClient(), todoId, eventId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { reattachTodoToExistingEvent: run, isSubmitting, error };
}

export interface UseReattachTodoToNewPersonalEventResult {
  reattachTodoToNewPersonalEvent: (todoId: string, input: CreatePersonalEventForTodoInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: TodoError | null;
}

export function useReattachTodoToNewPersonalEvent(): UseReattachTodoToNewPersonalEventResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TodoError | null>(null);

  const run = useCallback(async (todoId: string, input: CreatePersonalEventForTodoInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await reattachTodoToNewPersonalEvent(getSupabaseClient(), todoId, input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { reattachTodoToNewPersonalEvent: run, isSubmitting, error };
}

export interface UseTodosByEventResult {
  todos: Todo[];
  isLoading: boolean;
  error: TodoError | null;
  refetch: () => Promise<void>;
}

export function useTodosByEvent(eventId: string): UseTodosByEventResult {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TodoError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listTodosByEvent(getSupabaseClient(), eventId);
    if (result.ok) {
      setTodos(result.value);
      setError(null);
    } else {
      setTodos([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { todos, isLoading, error, refetch };
}

export interface UseToggleDoneResult {
  toggleDone: (todoId: string, isDone: boolean) => Promise<boolean>;
  isSubmitting: boolean;
  error: TodoError | null;
}

export function useToggleDone(): UseToggleDoneResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TodoError | null>(null);

  const runToggleDone = useCallback(async (todoId: string, isDone: boolean) => {
    setIsSubmitting(true);
    setError(null);
    const result = await toggleDone(getSupabaseClient(), todoId, isDone);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { toggleDone: runToggleDone, isSubmitting, error };
}

export interface UseUpdateTodoResult {
  updateTodo: (todoId: string, input: UpdateTodoInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: TodoError | null;
}

export function useUpdateTodo(): UseUpdateTodoResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TodoError | null>(null);

  const runUpdateTodo = useCallback(async (todoId: string, input: UpdateTodoInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateTodo(getSupabaseClient(), todoId, input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { updateTodo: runUpdateTodo, isSubmitting, error };
}

export interface UseDeleteTodoResult {
  deleteTodo: (todoId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: TodoError | null;
}

export function useDeleteTodo(): UseDeleteTodoResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TodoError | null>(null);

  const runDeleteTodo = useCallback(async (todoId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteTodo(getSupabaseClient(), todoId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { deleteTodo: runDeleteTodo, isSubmitting, error };
}
