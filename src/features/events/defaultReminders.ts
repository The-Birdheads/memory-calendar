import type { EventReminderKind } from "./types";

/**
 * 予定を作成するときに最初から選んでおくリマインド。
 * - 終日: 当日(JST9時)と1日前(JST9時)
 * - 時刻指定: 前日9時(JST、種別は「1日前」と同じ)。「10分前」は、予定の直前に通知されても準備が間に合わない
 *   ため既定にはしない(選択肢としては残している)。
 */
export function defaultReminderKinds(isAllDay: boolean): EventReminderKind[] {
  return isAllDay ? ["on_day", "day_before_1"] : ["day_before_1"];
}
