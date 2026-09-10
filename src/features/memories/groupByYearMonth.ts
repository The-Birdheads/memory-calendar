import type { MemoryEntry } from "./types";
import { toJstDateKey } from "../../shared/utils/formatDateTime";

export interface MemoryTimelineGroup<T extends MemoryEntry = MemoryEntry> {
  /** "YYYY-MM" (JST), stable key for lists/keyExtractor. */
  yearMonth: string;
  /** "YYYY年M月" display label. */
  label: string;
  entries: T[];
}

function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

/**
 * Groups memory entries into consecutive runs that share the same JST
 * year-month, for the振り返りタブ「画像」パネル - a month header (アルバムの
 * 章区切りのように) per group, photos grid underneath it. Mirrors
 * `groupEventsByYearMonth` (history/groupByYearMonth.ts) but keeps its own
 * copy since it operates on MemoryEntry. Generic over T so callers can pass
 * `MemoryEntryWithThumbnail[]` (the shape `useMemoriesTimeline` actually
 * returns) and get that richer type back out in `entries`, not just the
 * base `MemoryEntry`. Assumes the input is already ordered (the memories
 * feature's own query returns entries sorted by start time descending), and
 * simply splits it into month-sized runs without re-sorting - a group
 * boundary starts wherever the year-month changes.
 */
export function groupMemoriesByYearMonth<T extends MemoryEntry>(entries: T[]): MemoryTimelineGroup<T>[] {
  const groups: MemoryTimelineGroup<T>[] = [];

  for (const entry of entries) {
    const yearMonth = toJstDateKey(entry.startAt).slice(0, 7);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.yearMonth === yearMonth) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ yearMonth, label: formatYearMonthLabel(yearMonth), entries: [entry] });
    }
  }

  return groups;
}
