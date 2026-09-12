/**
 * ToDo/振り返り(年表)/献立(記録)タブの共通「期間」フィルターが使う判定。
 * "YYYY-MM-DD"形式の日付キーは文字列比較がそのまま日付の前後比較になるので、
 * Dateへの変換なしで済む。start/endどちらかがnullならその側は無制限。
 */
export function isDateKeyInRange(dateKey: string, startDate: string | null, endDate: string | null): boolean {
  if (startDate !== null && dateKey < startDate) return false;
  if (endDate !== null && dateKey > endDate) return false;
  return true;
}
