import { toJstDateKey } from "../../shared/utils/formatDateTime";
import { expandEventDateKeys } from "./eventDateKeys";
import type { MonthGridCell } from "./monthGrid";
import type { Event } from "./types";

/** TimeTree風に、複数日にまたがる予定を週をまたいでも同じ縦位置(lane)で
 * つながって見えるようにするための、同時に重ねられる本数の上限。これを
 * 超えて重なる予定はバー表示自体を諦め、呼び出し側の従来通りの(単日の
 * 予定と同じ)セル内ピル表示にフォールバックさせる。 */
export const MAX_MULTI_DAY_LANES = 2;

export interface MultiDayBanner<T extends Event = Event> {
  event: T;
  weekIndex: number;
  /** 0(日)〜6(土)、その週内でのバーの開始列(前の週から続く場合はその週の日曜にクリップ済み)。 */
  colStart: number;
  /** 0(日)〜6(土)、その週内でのバーの終了列(次の週へ続く場合はその週の土曜にクリップ済み)。 */
  colEnd: number;
  /** 予定ごとに一意な縦位置。月をまたぐ全ての週で同じ値になる(継続して見えるように)。 */
  lane: number;
  /** 予定の実際の開始日がこの週に含まれるか(左端を丸めて見せてよいか)。 */
  isStart: boolean;
  /** 予定の実際の終了日がこの週に含まれるか(右端を丸めて見せてよいか)。 */
  isEnd: boolean;
}

export interface MultiDayBannerLayout<T extends Event = Event> {
  banners: MultiDayBanner<T>[];
  /** lane数の上限を超えたため、バーではなく従来のピル表示に回す予定のid。 */
  overflowEventIds: Set<string>;
  /** 日付キー("YYYY-MM-DD")ごとに、その日に実際に重なっているバーが使う
   * lane数(=そのセルのピル表示を何段目から開始すべきか)。バーが1件も
   * 重ならない日は含まれない(呼び出し側は`?? 0`で扱う) - 同じ週の中でも
   * バーが通らない日まで一律に空けてしまわないよう、週単位ではなく日付
   * 単位で持つ。 */
  laneCountByDateKey: Record<string, number>;
}

/**
 * 複数日にまたがる予定を、TimeTreeのように週をまたいでもつながって見える
 * 横長バーとして配置する。単日の予定はこの対象に含めない(呼び出し側で
 * 従来通りセル内のピルとして表示する)。
 *
 * lane(縦位置)は予定ごとに1度だけ決め、その予定が現れる全ての週で使い回す
 * - 週ごとに縦位置がずれると「つながって見える」効果が壊れるため。
 * 重なりの判定と列位置は全てJSTの日付キー("YYYY-MM-DD")の文字列比較で行う
 * (`expandEventDateKeys`と同じ変換規則)。
 */
export function buildMultiDayBanners<T extends Event>(
  events: T[],
  monthGrid: MonthGridCell[][]
): MultiDayBannerLayout<T> {
  const multiDayEvents = events
    .map((event) => ({
      event,
      startKey: toJstDateKey(event.startAt),
      endKey: toJstDateKey(event.endAt),
    }))
    .filter(({ startKey, endKey }) => endKey > startKey)
    // 開始日が早い順、同じ開始日なら長い予定を先に - 先に大きく場所を取る
    // 予定にlane0を優先させ、無駄にlaneを分散させない。
    .sort((a, b) => a.startKey.localeCompare(b.startKey) || b.endKey.localeCompare(a.endKey) * -1);

  const laneEndKeys: string[] = [];
  const laneByEventId = new Map<string, number>();
  const overflowEventIds = new Set<string>();

  for (const { event, startKey, endKey } of multiDayEvents) {
    let lane = laneEndKeys.findIndex((lastEndKey) => lastEndKey < startKey);
    if (lane === -1) {
      if (laneEndKeys.length >= MAX_MULTI_DAY_LANES) {
        overflowEventIds.add(event.id);
        continue;
      }
      lane = laneEndKeys.length;
      laneEndKeys.push(endKey);
    } else {
      laneEndKeys[lane] = endKey;
    }
    laneByEventId.set(event.id, lane);
  }

  const banners: MultiDayBanner<T>[] = [];
  monthGrid.forEach((week, weekIndex) => {
    const weekStartKey = week[0].dateKey;
    const weekEndKey = week[week.length - 1].dateKey;

    for (const { event, startKey, endKey } of multiDayEvents) {
      if (overflowEventIds.has(event.id)) continue;
      if (endKey < weekStartKey || startKey > weekEndKey) continue;

      const clippedStartKey = startKey > weekStartKey ? startKey : weekStartKey;
      const clippedEndKey = endKey < weekEndKey ? endKey : weekEndKey;
      const colStart = week.findIndex((cell) => cell.dateKey === clippedStartKey);
      const colEnd = week.findIndex((cell) => cell.dateKey === clippedEndKey);

      banners.push({
        event,
        weekIndex,
        colStart,
        colEnd,
        lane: laneByEventId.get(event.id)!,
        isStart: startKey >= weekStartKey,
        isEnd: endKey <= weekEndKey,
      });
    }
  });

  const laneCountByDateKey: Record<string, number> = {};
  for (const banner of banners) {
    const week = monthGrid[banner.weekIndex];
    for (let col = banner.colStart; col <= banner.colEnd; col++) {
      const dateKey = week[col].dateKey;
      laneCountByDateKey[dateKey] = Math.max(laneCountByDateKey[dateKey] ?? 0, banner.lane + 1);
    }
  }

  return { banners, overflowEventIds, laneCountByDateKey };
}

/** 単日の予定と同じ(セル内ピル)表示に回すべき予定だけを残す - バー表示に
 * なった複数日予定は除外し、lane超過でオーバーフローした複数日予定は
 * (従来通りその日ごとに)残す。 */
export function excludeBannerEvents<T extends Event>(events: T[], overflowEventIds: Set<string>): T[] {
  return events.filter((event) => expandEventDateKeys(event.startAt, event.endAt).length === 1 || overflowEventIds.has(event.id));
}
