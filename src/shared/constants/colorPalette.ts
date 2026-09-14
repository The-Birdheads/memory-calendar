/** 色を手動で選ばせる箇所(タグ・カレンダーの色スウォッチ)全体で共有する
 * 固定パレット。新しい色を増やす場合もここに1箇所追加すれば全箇所に反映
 * される(2026-09、カレンダーの色設定を追加した際にタグ側の色一覧から抽出)。 */
export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "blue", hex: "#2f6fed" },
  { name: "indigo", hex: "#3949ab" },
  { name: "purple", hex: "#8e24aa" },
  { name: "pink", hex: "#d81b60" },
  { name: "red", hex: "#e53935" },
  { name: "deep-orange", hex: "#f4511e" },
  { name: "orange", hex: "#fb8c00" },
  { name: "yellow", hex: "#b8860b" },
  { name: "green", hex: "#43a047" },
  { name: "teal", hex: "#00897b" },
  { name: "cyan", hex: "#00acc1" },
  { name: "brown", hex: "#6d4c41" },
];
