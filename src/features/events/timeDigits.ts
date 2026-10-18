export type TimeField = "hour" | "minute";

export interface TimeDigitResult {
  /** 入力途中も含めた、その欄の現在の値。 */
  value: number;
  /** 十の位だけ入力済みなら、その桁("" なら次の入力は十の位)。 */
  buffer: string;
  /** その欄の入力が終わった(次の欄へ移ってよい)。 */
  done: boolean;
}

const MAX: Record<TimeField, number> = { hour: 23, minute: 59 };
// 十の位に置ける最大の数字(時は 0-2、分は 0-5)。これを超える数字が最初に来たら、
// 十の位としてはあり得ない(30時・60分は無い)ので、一の位に入れて次の欄へ移る。
const MAX_TENS: Record<TimeField, number> = { hour: 2, minute: 5 };

/**
 * 時刻のキーボード入力で、数字を1文字受け取ったときの欄の状態を返す。
 * - 最初の数字が十の位になり得る(時: 0-2 / 分: 0-5)なら、二桁目を待つ。
 * - なり得ない(時: 3-9 / 分: 6-9)なら、その数字を一の位として確定し、次の欄へ移る。
 * - 二桁目は、組み合わせが範囲内(時 23 / 分 59 まで)なら確定して次の欄へ。範囲外
 *   になる数字(例: 時で「2」のあとの「4」)は無視する(null)。
 */
export function applyTimeDigit(field: TimeField, buffer: string, digit: number): TimeDigitResult | null {
  if (buffer === "") {
    if (digit <= MAX_TENS[field]) {
      return { value: digit, buffer: String(digit), done: false };
    }
    return { value: digit, buffer: "", done: true };
  }

  const combined = Number(buffer) * 10 + digit;
  if (combined > MAX[field]) {
    return null;
  }
  return { value: combined, buffer: "", done: true };
}

/**
 * 「00」「30」のような二桁のキーが押されたときの欄の状態を返す。欄に二桁をそのまま入れる
 * (時なら「00」は 0 時、「30」は 23 を超えるので無効)。範囲外なら無視する(null)。
 * 二桁入力で終わるので、常に done: true(次の欄へ移ってよい)。
 */
export function applyTimeValue(field: TimeField, value: number): TimeDigitResult | null {
  if (value > MAX[field]) {
    return null;
  }
  return { value, buffer: "", done: true };
}
