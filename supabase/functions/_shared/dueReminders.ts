// リマインド(予定・ToDo)の配信対象の絞り込み。Deno固有のAPIは使わない純粋な関数だけにして、
// jestからも検証できるようにしている。
//
// 以前は「リマインド時刻が過ぎているものすべて」を毎分たどり、配信済みのものにも毎回 notification_log へ
// INSERT して、一意制約違反(Postgres のエラー / REST の 409)を起こしていた。リマインドが増えるたびに
// 毎分のエラーが永久に1つずつ増え、処理時間も延びていく。そこで、
//   1. リマインド時刻が「直近の一定期間」にあるものだけを対象にし、
//   2. その中で、すでに notification_log に行があるもの(配信済み・配信失敗済み)を除く
// ようにする。

/** 期限を過ぎたリマインドを、どこまでさかのぼって配信するか(障害などで取りこぼしたときの救済)。 */
export const REMINDER_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** PostgREST の `in` に一度に渡す件数(URLが長くなりすぎないように)。 */
export const LOG_LOOKUP_CHUNK_SIZE = 100;

/** 配信対象にするリマインド時刻の下限(これより前のものは、もう配信しない)。 */
export function lookbackStart(now: Date): string {
  return new Date(now.getTime() - REMINDER_LOOKBACK_MS).toISOString();
}

/** すでに notification_log に行があるもの(loggedIds)を除く。順序は保つ。 */
export function excludeLogged<T extends { id: string }>(rows: T[], loggedIds: Set<string>): T[] {
  return rows.filter((row) => !loggedIds.has(row.id));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}
