/**
 * Formats an ISO date-time string as "YYYY/MM/DD hh:mm" (zero-padded, UTC) so
 * dates and times are displayed consistently across the whole app instead of
 * raw ISO strings or ad-hoc per-screen formats.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

/** Formats a start/end pair as "YYYY/MM/DD hh:mm 〜 YYYY/MM/DD hh:mm". */
export function formatDateTimeRange(startIso: string, endIso: string): string {
  return `${formatDateTime(startIso)} 〜 ${formatDateTime(endIso)}`;
}

/** Formats just the "hh:mm" portion of an ISO date-time string (zero-padded, UTC). */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
