import { toJstDateKey } from "../../shared/utils/formatDateTime";

/**
 * A native date picker hands back a real absolute instant (e.g. tapping
 * "9/4" on a JST device yields JST-midnight-Sept-4, i.e. 15:00 UTC on the
 * 3rd) - reading its JST calendar day (not a raw UTC slice) is what keeps
 * the date you pick and the date that gets saved/displayed in sync.
 */
export function mealDateKeyFromPicked(date: Date): string {
  return toJstDateKey(date.toISOString());
}

/** Parses a "YYYY-MM-DD" mealDate into a Date for the picker (UTC midnight -
 * round-trips correctly through mealDateKeyFromPicked's JST-day read, same
 * as the web date-input fallback). */
export function mealDateToPickerValue(mealDate: string): Date {
  return new Date(`${mealDate}T00:00:00.000Z`);
}
