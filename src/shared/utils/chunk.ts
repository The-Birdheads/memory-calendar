/**
 * Supabaseの`.in("col", ids)`はIDをURLのクエリ文字列に並べるため、件数が増えると
 * URLが長すぎてリクエスト自体が失敗する(予定が数百件になった一覧/年表で
 * タグや写真マークがまるごと消える原因になる)。そのためIDをこの件数ごとの
 * かたまりに分けて問い合わせる。UUID(36文字)×100件でURL約4KBに収まる。
 */
export const IN_QUERY_CHUNK_SIZE = 100;

export function chunk<T>(items: readonly T[], size: number = IN_QUERY_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
