import type { DateRange } from "./types";

export type CalendarViewMode = "month" | "week" | "day";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// `date`'s UTC-* accessors are treated as JST calendar components (the
// caller always passes a "JST day" Date per the app-wide convention - see
// jstNow/toJstDateKey), so day/week/month arithmetic below reads those
// components directly and only converts to a real absolute UTC instant at
// the very end, via this helper - never shift first and read components
// after, or the day-of-week/day-of-month would come out wrong whenever the
// shift crosses a day boundary.
function jstMidnightToUtcInstant(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - JST_OFFSET_MS);
}

function startOfDayUTC(date: Date): Date {
  return jstMidnightToUtcInstant(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function endOfDayUTC(date: Date): Date {
  const nextDayStart = jstMidnightToUtcInstant(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return new Date(nextDayStart.getTime() - 1);
}

function startOfWeekUTC(date: Date): Date {
  return jstMidnightToUtcInstant(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay());
}

function endOfWeekUTC(date: Date): Date {
  const nextWeekStart = jstMidnightToUtcInstant(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - date.getUTCDay() + 7
  );
  return new Date(nextWeekStart.getTime() - 1);
}

function startOfMonthUTC(date: Date): Date {
  return jstMidnightToUtcInstant(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function endOfMonthUTC(date: Date): Date {
  const nextMonthStart = jstMidnightToUtcInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return new Date(nextMonthStart.getTime() - 1);
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
