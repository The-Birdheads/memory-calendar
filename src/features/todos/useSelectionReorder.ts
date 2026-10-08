import { useState } from "react";

import { moveItem } from "./reorder";

/**
 * ToDoの並べ替えモードの状態。行をタップして選択し、「↑」「↓」ボタンで選択行を
 * 1つずつ上下に動かす方式(ドラッグ操作は、リスト自体のスクロールと競合して
 * 思い通りに動かせなかったため廃止)。ここでは並びと選択だけを持ち、保存は
 * しない - 確定時に呼び出し側が`order`を読んでsort_orderへ反映する
 * (reorder.tsのsequentialSortOrders)。
 */
export function useSelectionReorder(ids: string[]) {
  const [order, setOrder] = useState<string[]>(ids);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedIndex = selectedId === null ? -1 : order.indexOf(selectedId);
  const canMoveUp = selectedIndex > 0;
  const canMoveDown = selectedIndex !== -1 && selectedIndex < order.length - 1;

  /** 行をタップした時 - 未選択なら選択、選択済みの行をもう一度タップしたら解除。 */
  const select = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const moveSelected = (delta: -1 | 1) => {
    if (selectedId === null) return;
    setOrder((prev) => moveItem(prev, selectedId, prev.indexOf(selectedId) + delta));
  };

  /** 並べ替えモードに入る時などに、最新のデータで並びを作り直し、選択も解除する。 */
  const reset = (nextIds: string[]) => {
    setOrder(nextIds);
    setSelectedId(null);
  };

  return {
    order,
    selectedId,
    canMoveUp,
    canMoveDown,
    select,
    moveSelectedUp: () => moveSelected(-1),
    moveSelectedDown: () => moveSelected(1),
    reset,
  };
}
