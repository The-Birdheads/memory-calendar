import type { CalendarKind } from "../calendars/types";

export interface CalendarSwitchWarningInput {
  fromKind: CalendarKind;
  fromName: string;
  toKind: CalendarKind;
  toName: string;
}

/**
 * 予定のカレンダー切り替え確認モーダルに出す注意文を組み立てる。
 * - 個人→共有(切り替え先が共有): 予定の内容・思い出・コメントが新しいメンバーに
 *   共有される旨を説明する(タグ/ToDo/リマインドは常に本人専用なので対象外)。
 * - 共有→個人 or 共有→別の共有(切り替え元が共有): 元のカレンダーのメンバーは
 *   この予定を見られなくなる旨を説明する。
 * 共有カレンダー間の切り替え(共有→共有)では両方が該当するため、両方の文を返す。
 */
export function buildCalendarSwitchWarningMessages(input: CalendarSwitchWarningInput): string[] {
  const messages: string[] = [];

  if (input.toKind === "group") {
    messages.push(
      `「${input.toName}」に移動すると、この予定の内容(タイトル・日時・場所など)や、追加した思い出(写真)・コメントが「${input.toName}」のメンバーに共有されます。タグ・ToDo・リマインドはこれまで通りご自身にのみ表示されます。`
    );
  }

  if (input.fromKind === "group") {
    messages.push(`「${input.fromName}」のメンバーは、移動後この予定を見られなくなります。`);
  }

  if (messages.length === 0) {
    messages.push("この予定の所属カレンダーが変更されます。");
  }

  return messages;
}
