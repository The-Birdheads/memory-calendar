export interface Todo {
  id: string;
  eventId: string | null;
  title: string;
  isDone: boolean;
  completedAt: string | null;
  reminderAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A todo along with its event's title and start/end time, for calendar-wide
 * listings. Always comes from a query joined on an existing event, so
 * eventId is never null here (unlike the general Todo, which can be orphaned).
 */
export interface TodoWithEventTitle extends Todo {
  eventId: string;
  eventCalendarId: string;
  eventTitle: string;
  eventStartAt: string;
  eventEndAt: string;
  /** リマインドの選択肢(終日用/時刻指定用)を予定と同じ基準で出し分けるために持つ。 */
  eventIsAllDay: boolean;
}

export interface CreateTodoInput {
  eventId: string;
  title: string;
  reminderAt?: string;
}

export interface UpdateTodoInput {
  title?: string;
  reminderAt?: string | null;
}

export interface CreatePersonalEventForTodoInput {
  title: string;
  date: string;
}

export type TodoError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "ValidationError"; field: string };
