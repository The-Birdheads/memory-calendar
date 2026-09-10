import type { Event } from "../events/types";
import { toJstDateKey } from "../../shared/utils/formatDateTime";

export interface TimelineGroup {
  /** "YYYY-MM" (JST), stable key for lists/keyExtractor. */
  yearMonth: string;
  /** "YYYY年M月" display label. */
  label: string;
  events: Event[];
}

function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

/**
 * Groups events into consecutive runs that share the same JST year-month,
 * for the history tab's 年表 (timeline) view - a month header per group,
 * events listed underneath it. Assumes the input is already ordered (the
 * history feature's own query returns events sorted by start time
 * descending), and simply splits it into month-sized runs without
 * re-sorting - a group boundary starts wherever the year-month changes.
 */
export function groupEventsByYearMonth(events: Event[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];

  for (const event of events) {
    const yearMonth = toJstDateKey(event.startAt).slice(0, 7);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.yearMonth === yearMonth) {
      lastGroup.events.push(event);
    } else {
      groups.push({ yearMonth, label: formatYearMonthLabel(yearMonth), events: [event] });
    }
  }

  return groups;
}
