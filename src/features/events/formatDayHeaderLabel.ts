const WEEKDAY_FULL_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * Formats a "YYYY-MM-DD" date key as "M月D日 曜日曜日" (e.g. "8月27日 木曜日")
 * for the day-events modal's header.
 */
export function formatDayHeaderLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const weekday = WEEKDAY_FULL_LABELS[date.getUTCDay()];
  return `${month}月${day}日 ${weekday}曜日`;
}
