// アイコン画像を登録していないユーザーのアイコン(頭文字+色)を決める。

const AVATAR_COLORS = ["#2f6fed", "#e5484d", "#2e9e5b", "#d98a00", "#8a5cf5", "#0b9ec9", "#d6409f", "#6b7280"];

/** 表示名の頭文字。絵文字などのサロゲートペアを壊さないよう、コードポイント単位で先頭を取る。 */
export function avatarInitial(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? "").trim();
  if (trimmed === "") return "?";
  const [first] = Array.from(trimmed);
  return first.toUpperCase();
}

/** ユーザーIDから決まる(毎回同じ)アイコンの背景色。 */
export function avatarColor(userId: string): string {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
