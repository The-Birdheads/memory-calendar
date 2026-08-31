export interface Todo {
  id: string;
  eventId: string;
  title: string;
  isDone: boolean;
  completedAt: string | null;
  reminderAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A todo along with its event's title and start/end time, for calendar-wide listings. */
export interface TodoWithEventTitle extends Todo {
  eventTitle: string;
  eventStartAt: string;
  eventEndAt: string;
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

export type TodoError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "ValidationError"; field: string };
