export interface Event {
  id: string;
  calendarId: string;
  seriesId: string | null;
  title: string;
  location: string | null;
  memo: string | null;
  categoryColor: string | null;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  reminderAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  isAllDay?: boolean;
  location?: string;
  memo?: string;
  categoryColor?: string;
  reminderAt?: string;
}

export type EditScope = "this" | "series";

export interface UpdateEventInput {
  title?: string;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  location?: string | null;
  memo?: string | null;
  categoryColor?: string | null;
  reminderAt?: string | null;
}

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface CreateRecurringSeriesInput {
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  recurrenceRule: RecurrenceFrequency;
  recurrenceEndAt: string;
  isAllDay?: boolean;
  location?: string;
  memo?: string;
  categoryColor?: string;
  reminderAt?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export type ReminderTargetsInput = string[] | "all";

export type EventError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "InvalidDateRange" }
  | { type: "InvalidRecurrenceRange" };
