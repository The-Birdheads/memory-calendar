/**
 * 振り返り(年表)の「キーワード」絞り込みが使う判定。空白(半角/全角)で
 * 区切った語がすべてタイトルに含まれていれば一致(AND)、大文字小文字は
 * 区別しない。キーワードが空/空白だけなら絞り込みなし(常に一致)。
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  const words = keyword
    .toLowerCase()
    .split(/[\s　]+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return true;
  const haystack = text.toLowerCase();
  return words.every((word) => haystack.includes(word));
}
