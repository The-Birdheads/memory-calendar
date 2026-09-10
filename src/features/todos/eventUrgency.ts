import { toJstDateKey } from "../../shared/utils/formatDateTime";

export type EventUrgency = "overdue" | "today" | "tomorrow" | "none";

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Classifies how urgent an event's linked ToDos are, purely from the
 * event's own start date compared to today (both as JST "YYYY-MM-DD" date
 * keys) - independent of whether any ToDo is actually still incomplete.
 * Callers combine this with a group's own completion state to decide
 * whether to show a badge at all (see EventTodoGroup + countIncomplete in
 * groupByEvent.ts).
 */
export function getEventUrgency(eventStartAt: string, todayDateKey: string): EventUrgency {
  const eventDateKey = toJstDateKey(eventStartAt);

  if (eventDateKey < todayDateKey) return "overdue";
  if (eventDateKey === todayDateKey) return "today";
  if (eventDateKey === addDaysToDateKey(todayDateKey, 1)) return "tomorrow";
  return "none";
}
