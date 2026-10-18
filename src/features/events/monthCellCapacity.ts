// 月グリッドの1日の枠に、予定を何行まで表示できるかの計算。
// 枠の高さは月の週数(4〜6行)や画面の大きさで変わるので、固定の件数ではなく、
// 実際の枠の高さから「入るだけ」表示し、入りきらないときだけ最後の行を「+N」にする。

/** 枠の上端から予定の1行目まで: paddingTop(4) + 日付バッジ(24) + gap(2)。 */
export const CELL_TOP_AREA = 30;
/** 複数日予定のバー1本(lane)が取る高さ: バー14 + 間隔2。 */
export const LANE_HEIGHT = 16;
/** 予定1行(ピル)の高さ: lineHeight 12 + 上下のpadding 1×2。「+N」の行も同じ高さに揃える。 */
export const EVENT_ROW_HEIGHT = 14;
export const EVENT_ROW_GAP = 1;
/** 枠の下端に残す余白。 */
export const CELL_BOTTOM_PADDING = 2;

/** 高さがまだ測れていない間の表示件数(これまでの固定の上限)。 */
const FALLBACK_VISIBLE_COUNT = 3;

/** 枠(行の高さ rowHeight)に、予定を最大で何行並べられるか(「+N」の行も1行に数える)。 */
export function computeCellEventCapacity(rowHeight: number, laneCount: number): number {
  const available = rowHeight - CELL_TOP_AREA - laneCount * LANE_HEIGHT - CELL_BOTTOM_PADDING;
  if (available < EVENT_ROW_HEIGHT) return 0;
  return Math.floor((available + EVENT_ROW_GAP) / (EVENT_ROW_HEIGHT + EVENT_ROW_GAP));
}

/**
 * 1日の予定を、枠に入る分だけ表示する予定と、入りきらない件数に分ける。全部入るなら全て表示。
 * 入りきらないときは最後の1行を「+N」に使うので、その分を除いた件数を表示する。
 */
export function splitCellEvents<T>(
  events: T[],
  rowHeight: number | null,
  laneCount: number
): { visible: T[]; hiddenCount: number } {
  if (rowHeight === null) {
    const visible = events.slice(0, FALLBACK_VISIBLE_COUNT);
    return { visible, hiddenCount: events.length - visible.length };
  }

  const capacity = computeCellEventCapacity(rowHeight, laneCount);
  if (events.length <= capacity) {
    return { visible: events, hiddenCount: 0 };
  }

  const visible = events.slice(0, Math.max(capacity - 1, 0));
  return { visible, hiddenCount: events.length - visible.length };
}
