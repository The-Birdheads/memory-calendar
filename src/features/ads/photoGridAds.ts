const CARDS_PER_ROW = 2;
/** 写真の一覧で、広告を入れる間隔(行数)。 */
export const PHOTO_ROWS_PER_AD = 10;

export interface PhotoGroupSize {
  key: string;
  cardCount: number;
}

/**
 * 1行に2枚並ぶ写真の一覧(月ごとのまとまり)で、PHOTO_ROWS_PER_AD 行ごと(月をまたいで数える)に
 * 広告を入れる位置を返す。位置は、まとまりごとの「その番号のカードの直後」。10行目が月の最後の行
 * ならその月の最後のカードの後ろ。一覧全体の最後の行の後ろ(続きがない)には入れない。
 * 半端に埋まった最後の行も1行に数える。
 */
export function photoAdAfterCardIndexes(groups: PhotoGroupSize[]): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  const totalRows = groups.reduce((sum, group) => sum + Math.ceil(group.cardCount / CARDS_PER_ROW), 0);

  let rowsBefore = 0;
  for (const group of groups) {
    const indexes = new Set<number>();
    const rows = Math.ceil(group.cardCount / CARDS_PER_ROW);
    for (let row = 0; row < rows; row += 1) {
      const globalRow = rowsBefore + row + 1;
      if (globalRow % PHOTO_ROWS_PER_AD === 0 && globalRow < totalRows) {
        indexes.add(Math.min(row * CARDS_PER_ROW + CARDS_PER_ROW - 1, group.cardCount - 1));
      }
    }
    result.set(group.key, indexes);
    rowsBefore += rows;
  }
  return result;
}
