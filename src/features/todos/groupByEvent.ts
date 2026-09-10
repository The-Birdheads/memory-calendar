import type { TodoWithEventTitle } from "./types";

export interface EventTodoGroup {
  eventId: string;
  eventCalendarId: string;
  eventTitle: string;
  eventStartAt: string;
  eventEndAt: string;
  todos: TodoWithEventTitle[];
}

/**
 * Groups todos by the event they belong to, ordering the groups by the
 * event's start time (chronological, matching the order the linked events
 * appear on the calendar). Todos within a group keep their original order.
 */
export function groupTodosByEvent(todos: TodoWithEventTitle[]): EventTodoGroup[] {
  const groups = new Map<string, EventTodoGroup>();

  for (const todo of todos) {
    const existing = groups.get(todo.eventId);
    if (existing) {
      existing.todos.push(todo);
    } else {
      groups.set(todo.eventId, {
        eventId: todo.eventId,
        eventCalendarId: todo.eventCalendarId,
        eventTitle: todo.eventTitle,
        eventStartAt: todo.eventStartAt,
        eventEndAt: todo.eventEndAt,
        todos: [todo],
      });
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(a.eventStartAt).getTime() - new Date(b.eventStartAt).getTime()
  );
}

/** The number of todos in a group that aren't done yet. */
export function countIncomplete(group: EventTodoGroup): number {
  return group.todos.filter((todo) => !todo.isDone).length;
}
