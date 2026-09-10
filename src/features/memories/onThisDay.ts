import type { MemoryEntry } from "./types";
import { toJstDateKey } from "../../shared/utils/formatDateTime";

/**
 * Picks out past memories that fall on "today" (JST month-day) in an
 * earlier year - the「n年前の今日」サプライズ演出。過去の年から複数件
 * マッチすることもあるので配列で返す(呼び出し側は横スクロールなどで並べる)。
 * 今年の同日は除く(グリッドの一番上に既に出ているため)。
 */
export function selectOnThisDayEntries<T extends MemoryEntry>(entries: T[], todayJstDateKey: string): T[] {
  const todayMonthDay = todayJstDateKey.slice(5);
  const currentYear = todayJstDateKey.slice(0, 4);

  return entries.filter((entry) => {
    const entryDateKey = toJstDateKey(entry.startAt);
    return entryDateKey.slice(0, 4) !== currentYear && entryDateKey.slice(5) === todayMonthDay;
  });
}
