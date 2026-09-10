import type { MealRecord, MealSlot } from "./types";
import { formatDayHeaderLabel } from "../events/formatDayHeaderLabel";

// 同じ日の献立の並び順(上から間食→夕食→昼食→朝食)。時系列(朝→夜)ではなく
// あえて逆順にする、という指定に合わせている。
const SLOT_DISPLAY_ORDER: Record<MealSlot, number> = { snack: 0, dinner: 1, lunch: 2, breakfast: 3 };

export interface MealDateGroup<T extends MealRecord = MealRecord> {
  /** "YYYY-MM-DD", stable key for lists/keyExtractor. */
  mealDate: string;
  /** "M月D日 曜日曜日" display label. */
  label: string;
  records: T[];
}

export interface MealMonthGroup<T extends MealRecord = MealRecord> {
  /** "YYYY-MM", stable key for lists/keyExtractor. */
  yearMonth: string;
  /** "YYYY年M月" display label. */
  label: string;
  records: T[];
}

function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

/**
 * Groups meal records into consecutive runs sharing the same mealDate, for
 * the献立タブ「予定」パネル - a day header per group, its meals listed
 * underneath in slot order (間食→夕食→昼食→朝食, see SLOT_DISPLAY_ORDER).
 * mealDate is already a plain "YYYY-MM-DD" (no JST shifting needed, unlike
 * Event.startAt). Assumes the input is already ordered by date (the meals
 * feature's own query returns records sorted by meal_date ascending) and
 * simply splits it into day-sized runs, sorting each day's own records by
 * slot afterward (a stable sort, so same-slot records keep their relative
 * order).
 */
export function groupMealsByDate<T extends MealRecord>(records: T[]): MealDateGroup<T>[] {
  const groups: MealDateGroup<T>[] = [];

  for (const record of records) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.mealDate === record.mealDate) {
      lastGroup.records.push(record);
    } else {
      groups.push({ mealDate: record.mealDate, label: formatDayHeaderLabel(record.mealDate), records: [record] });
    }
  }

  for (const group of groups) {
    group.records.sort((a, b) => SLOT_DISPLAY_ORDER[a.slot] - SLOT_DISPLAY_ORDER[b.slot]);
  }

  return groups;
}

/**
 * Groups meal records into consecutive runs sharing the same "YYYY-MM"
 * prefix of mealDate, for the献立タブ「記録」パネル - a month header per
 * group, like 振り返りタブの年表/画像パネル. Assumes the input is already
 * ordered and simply splits it into month-sized runs without re-sorting.
 */
export function groupMealsByMonth<T extends MealRecord>(records: T[]): MealMonthGroup<T>[] {
  const groups: MealMonthGroup<T>[] = [];

  for (const record of records) {
    const yearMonth = record.mealDate.slice(0, 7);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.yearMonth === yearMonth) {
      lastGroup.records.push(record);
    } else {
      groups.push({ yearMonth, label: formatYearMonthLabel(yearMonth), records: [record] });
    }
  }

  return groups;
}
