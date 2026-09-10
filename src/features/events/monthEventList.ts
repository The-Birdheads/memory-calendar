import { expandEventDateKeys } from "./eventDateKeys";
import { formatDayHeaderLabel } from "./formatDayHeaderLabel";
import type { Event } from "./types";

export interface MonthDayEventGroup<T extends Event = Event> {
  /** "YYYY-MM-DD" (JST), stable key for lists/keyExtractor. */
  dateKey: string;
  /** "M月D日 曜日曜日" display label. */
  label: string;
  events: T[];
}

/**
 * Builds one group per day of the given month that actually has events,
 * for the カレンダー画面の「一覧」表示 - a day header per group, its events
 * listed underneath in chronological order. Unlike the grid (which is fed
 * the whole padded range including a few leading/trailing days from
 * adjacent months), this only considers days that fall within the given
 * calendar month itself, and a multi-day event appears under every day it
 * spans within that month (same as it does on the grid).
 */
export function buildMonthEventGroups<T extends Event>(events: T[], year: number, month: number): MonthDayEventGroup<T>[] {
  const eventsByDate = new Map<string, T[]>();
  for (const event of events) {
    for (const dateKey of expandEventDateKeys(event.startAt, event.endAt)) {
      const list = eventsByDate.get(dateKey) ?? [];
      list.push(event);
      eventsByDate.set(dateKey, list);
    }
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const groups: MonthDayEventGroup<T>[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = eventsByDate.get(dateKey);
    if (!dayEvents || dayEvents.length === 0) continue;

    groups.push({
      dateKey,
      label: formatDayHeaderLabel(dateKey),
      events: [...dayEvents].sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0)),
    });
  }

  return groups;
}
