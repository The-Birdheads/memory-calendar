import type { DateRange } from "./types";

export type CalendarViewMode = "month" | "week" | "day";

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function startOfWeekUTC(date: Date): Date {
  const start = startOfDayUTC(date);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function endOfWeekUTC(date: Date): Date {
  const end = startOfWeekUTC(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return endOfDayUTC(end);
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function computeDateRange(mode: CalendarViewMode, date: Date): DateRange {
  if (mode === "day") {
    return { start: startOfDayUTC(date).toISOString(), end: endOfDayUTC(date).toISOString() };
  }
  if (mode === "week") {
    return { start: startOfWeekUTC(date).toISOString(), end: endOfWeekUTC(date).toISOString() };
  }
  return { start: startOfMonthUTC(date).toISOString(), end: endOfMonthUTC(date).toISOString() };
}
