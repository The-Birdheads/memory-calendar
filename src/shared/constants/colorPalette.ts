/** 色を手動で選ばせる箇所(タグ・カレンダーの色スウォッチ)全体で共有する
 * 固定パレット。新しい色を増やす場合もここに1箇所追加すれば全箇所に反映
 * される(2026-09、カレンダーの色設定を追加した際にタグ側の色一覧から抽出)。
 * 明度・彩度が低く沈んで見えていたもの(indigo/purple/yellow/green/teal/
 * cyan)は、白文字のピル塗りとして十分なコントラストを保てる範囲でより
 * 明るく鮮やかな色に差し替えた(2026-09)。既存データ(カレンダー/タグに
 * 保存済みの旧hex)はリリース前のため移行せず残置 - パレット上の選択状態が
 * 「未選択(カスタム色)」に見えるだけで、表示自体はそのまま旧色で問題ない。 */
export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "blue", hex: "#2f6fed" },
  { name: "indigo", hex: "#2d46d2" },
  { name: "purple", hex: "#b01fd6" },
  { name: "pink", hex: "#d81b60" },
  { name: "red", hex: "#e53935" },
  { name: "deep-orange", hex: "#f4511e" },
  { name: "orange", hex: "#fb8c00" },
  { name: "yellow", hex: "#da9f0c" },
  { name: "green", hex: "#22c32a" },
  { name: "teal", hex: "#11d4c1" },
  { name: "cyan", hex: "#0cd1e9" },
  { name: "brown", hex: "#6d4c41" },
];
