export interface BannerPlacementInput {
  /** 各項目(日付ごと・月ごとのまとまりなど)の高さ。まだ測れていない項目は undefined。 */
  itemHeights: (number | undefined)[];
  /** 何項目ごとに広告を入れるか。 */
  interval: number;
  /** 一覧の見えている範囲(最初の画面)の高さ。測れるまでは null。 */
  viewportHeight: number | null;
  /** 1つも測れていないときに、1項目の高さとして仮に使う値。 */
  fallbackHeight?: number;
}

const DEFAULT_FALLBACK_HEIGHT = 100;

/**
 * 「N項目ごと」に入れる広告の位置(その番号の項目の**直後**)を返す。ただし、スクロールしない
 * 最初の画面には広告を出さない: 広告の位置(その項目の下端)が、最初の画面の下端より上に
 * なる場合は入れない。最後の項目の後ろ(続きがない)にも入れない。
 * 高さがまだ測れていない項目は、測れた項目の平均で見積もる。
 */
export function computeBannerAfterIndexes({
  itemHeights,
  interval,
  viewportHeight,
  fallbackHeight = DEFAULT_FALLBACK_HEIGHT,
}: BannerPlacementInput): number[] {
  if (viewportHeight === null || itemHeights.length === 0) {
    return [];
  }

  const measured = itemHeights.filter((height): height is number => height !== undefined);
  const estimate = measured.length > 0 ? measured.reduce((sum, height) => sum + height, 0) / measured.length : fallbackHeight;

  const positions: number[] = [];
  let bottom = 0;
  for (let index = 0; index < itemHeights.length - 1; index += 1) {
    bottom += itemHeights[index] ?? estimate;
    if ((index + 1) % interval === 0 && bottom >= viewportHeight) {
      positions.push(index);
    }
  }
  return positions;
}

export type SlottedItem<T> = { kind: "item"; item: T; index: number } | { kind: "banner"; key: string };

/** 項目の並びに、広告の枠(指定した番号の項目の直後)を差し込んだ、一覧用の配列を作る。 */
export function withBannerSlots<T>(items: T[], afterIndexes: Set<number>): SlottedItem<T>[] {
  const result: SlottedItem<T>[] = [];
  items.forEach((item, index) => {
    result.push({ kind: "item", item, index });
    if (afterIndexes.has(index)) {
      result.push({ kind: "banner", key: `banner-after-${index}` });
    }
  });
  return result;
}
