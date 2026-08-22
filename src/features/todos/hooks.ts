import { useCallback, useEffect, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  createTodo,
  deleteTodo,
  listTodosByCalendar,
  listTodosByEvent,
  toggleDone,
  updateTodo,
} from "./service";
import type { CreateTodoInput, Todo, TodoError, UpdateTodoInput } from "./types";

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

export interface UseTodosByCalendarResult {
  todos: Todo[];
  isLoading: boolean;
  error: TodoError | null;
  refetch: () => Promise<void>;
}

export function useTodosByCalendar(calendarId: string): UseTodosByCalendarResult {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TodoError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listTodosByCalendar(getSupabaseClient(), calendarId);
    if (result.ok) {
      setTodos(result.value);
      setError(null);
    } else {
      setTodos([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [calendarId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    return subscribeToTableChanges(getSupabaseClient(), `todos-${calendarId}`, "todos", refetch);
  }, [calendarId, refetch]);

  return { todos, isLoading, error, refetch };
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
