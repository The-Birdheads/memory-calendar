const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Shifts a UTC instant by Japan's fixed +09:00 offset (no DST) so its UTC-*
 * accessors read as JST wall-clock components. The whole app displays (and
 * lets the user pick) times as JST, regardless of the device's own
 * timezone setting, so this is the single place that conversion happens.
 */
function toJstComponents(iso: string): Date {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS);
}

/**
 * The current instant, shifted so reading its UTC-* accessors yields JST
 * wall-clock components. Use this (instead of `new Date()`) wherever "now"
 * feeds something that treats a Date's UTC year/month/day as the calendar
 * day itself (e.g. today's highlighted cell, the initially-focused month) -
 * it keeps "today" correct in JST even right around UTC midnight (9am JST).
 */
export function jstNow(): Date {
  return new Date(Date.now() + JST_OFFSET_MS);
}

/**
 * Converts an event/record's absolute-instant ISO timestamp to the
 * "YYYY-MM-DD" JST calendar day it falls on - e.g. for deciding which day
 * cell an event belongs in, distinct from formatDateOnly's "YYYY/MM/DD"
 * display format.
 */
export function toJstDateKey(iso: string): string {
  return toJstComponents(iso).toISOString().slice(0, 10);
}

/**
 * Today's "YYYY-MM-DD" JST calendar day. jstNow()'s own UTC-* accessors
 * already read as JST wall-clock components, so this is a plain slice of
 * its ISO string - passing it through toJstDateKey (which itself shifts a
 * RAW UTC instant by +9h) would double-shift it.
 */
export function todayJstDateKey(): string {
  return jstNow().toISOString().slice(0, 10);
}

/**
 * Formats an ISO date-time string as "YYYY/MM/DD hh:mm" (zero-padded, JST)
 * so dates and times are displayed consistently across the whole app,
 * always in Japan time, instead of raw ISO strings, ad-hoc per-screen
 * formats, or whatever timezone the viewing device happens to be set to.
 */
export function formatDateTime(iso: string): string {
  const date = toJstComponents(iso);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

/** Formats just the "YYYY/MM/DD" portion of an ISO date-time string (zero-padded, JST). */
export function formatDateOnly(iso: string): string {
  return formatDateTime(iso).slice(0, 10);
}

/**
 * Formats a start/end pair as "YYYY/MM/DD hh:mm 〜 YYYY/MM/DD hh:mm", or as
 * "YYYY/MM/DD 〜 YYYY/MM/DD" (no time) when isAllDay is true.
 */
export function formatDateTimeRange(startIso: string, endIso: string, isAllDay = false): string {
  const format = isAllDay ? formatDateOnly : formatDateTime;
  return `${format(startIso)} 〜 ${format(endIso)}`;
}

/** Formats just the "hh:mm" portion of an ISO date-time string (zero-padded, JST). */
export function formatTime(iso: string): string {
  const date = toJstComponents(iso);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
