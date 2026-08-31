import { formatDateOnly } from "../../shared/utils/formatDateTime";

/**
 * Formats a linked event's start (and, when it differs, end) date for the
 * ToDo screen's section header - date only, no time, "YYYY/MM/DD" or
 * "YYYY/MM/DD〜YYYY/MM/DD" when the event spans more than one day.
 */
export function formatEventDateRangeLabel(startAt: string, endAt: string): string {
  const startLabel = formatDateOnly(startAt);
  const endLabel = formatDateOnly(endAt);
  return startLabel === endLabel ? startLabel : `${startLabel}〜${endLabel}`;
}
