const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** The JST calendar day an instant falls on, as the UTC ms of that day's JST midnight. */
function jstDayStart(date: Date): number {
  return Math.floor((date.getTime() + JST_OFFSET_MS) / DAY_MS) * DAY_MS - JST_OFFSET_MS;
}

/**
 * 開始日時が変更されたあとの終了日時を返す。開始が終了より後ろになった場合だけ
 * 終了を補正し、そうでなければ終了はそのまま返す。
 * - 開始の日付が終了の日付より後ろになった: 終了を開始と同じ日にする
 *   (時刻あり予定は終了の時刻を保つ)。
 * - 時刻あり予定で、同じ日のまま開始時刻が終了時刻より後ろになった(上の補正後に
 *   まだ開始より前の場合も含む): 終了を開始の1時間後にする。
 * 日付はアプリ全体の規約に合わせて JST で判定する。
 */
export function adjustEndForNewStart(start: Date, end: Date, isAllDay: boolean): Date {
  const startDay = jstDayStart(start);
  const endDay = jstDayStart(end);

  if (isAllDay) {
    return startDay > endDay ? new Date(start.getTime()) : end;
  }

  if (start.getTime() <= end.getTime()) {
    return end;
  }

  const sameDayEnd = new Date(end.getTime() + (startDay - endDay));
  if (sameDayEnd.getTime() > start.getTime()) {
    return sameDayEnd;
  }
  return new Date(start.getTime() + HOUR_MS);
}
