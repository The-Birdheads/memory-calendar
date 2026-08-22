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
