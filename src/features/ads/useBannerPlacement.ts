import { useCallback, useMemo, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

import { computeBannerAfterIndexes } from "./bannerPlacement";

// これ未満の高さの変化は無視する(測り直しのたびに再描画が連鎖しないように)。
const MIN_HEIGHT_CHANGE = 1;

export interface BannerPlacement {
  /** 広告を入れる位置(その番号の項目の直後)。 */
  afterIndexes: Set<number>;
  /** 一覧の見えている範囲の onLayout に渡す。 */
  onViewportLayout: (event: LayoutChangeEvent) => void;
  /** i 番目の項目の onLayout に渡す(`onLayout={placement.onItemLayout(i)}`)。 */
  onItemLayout: (index: number) => (event: LayoutChangeEvent) => void;
}

/**
 * 一覧に「N項目ごと」に広告を入れる位置を決める。一覧の見えている範囲と各項目の高さを測り、
 * スクロールしない最初の画面には広告が出ないようにする(bannerPlacement.ts)。
 * itemCount が変わったとき(絞り込みなど)は、古い測定値を捨てる。
 */
export function useBannerPlacement(itemCount: number, interval: number): BannerPlacement {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [measured, setMeasured] = useState<{ count: number; heights: Record<number, number> }>({
    count: itemCount,
    heights: {},
  });

  // 件数が変わったら、測り直す(並び・内容が変わっているため)。
  const heights = measured.count === itemCount ? measured.heights : {};

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setViewportHeight((previous) =>
      previous !== null && Math.abs(previous - height) < MIN_HEIGHT_CHANGE ? previous : height
    );
  }, []);

  const onItemLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      setMeasured((previous) => {
        const base = previous.count === itemCount ? previous.heights : {};
        const known = base[index];
        if (known !== undefined && Math.abs(known - height) < MIN_HEIGHT_CHANGE) {
          return previous.count === itemCount ? previous : { count: itemCount, heights: base };
        }
        return { count: itemCount, heights: { ...base, [index]: height } };
      });
    },
    [itemCount]
  );

  const afterIndexes = useMemo(
    () =>
      new Set(
        computeBannerAfterIndexes({
          itemHeights: Array.from({ length: itemCount }, (_, index) => heights[index]),
          interval,
          viewportHeight,
        })
      ),
    [heights, interval, itemCount, viewportHeight]
  );

  return { afterIndexes, onViewportLayout, onItemLayout };
}
