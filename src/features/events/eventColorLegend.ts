import type { Calendar } from "../calendars/types";
import type { EventWithTagColor } from "./types";
import type { Tag } from "../tags/types";

export interface EventColorLegendEntry {
  color: string;
  label: string;
}

/**
 * Resolves what a single event's displayed color (see resolveEventColor in
 * calendar.tsx) actually MEANS, so a legend can show more than "these dots
 * are different colors" - a tagged event is labeled with its matching tag's
 * own name (タグ名), an untagged event falls back to its calendar's own
 * name (そのカレンダーのデフォルト色を使っているので), and anything
 * unrecognized (calendar not found) reads as "その他" rather than showing
 * nothing.
 */
function resolveEventLegendLabel(
  event: EventWithTagColor,
  tags: Tag[],
  calendars: Calendar[]
): { label: string; isTagLabel: boolean } {
  if (event.tagColor) {
    const matchingTag = tags.find((tag) => tag.color === event.tagColor);
    if (matchingTag) return { label: matchingTag.name, isTagLabel: true };
  }
  const calendar = calendars.find((c) => c.id === event.calendarId);
  return { label: calendar ? calendar.name : "その他", isTagLabel: false };
}

/**
 * Builds a de-duplicated (color, label) legend from a set of events, for
 * the「一目で予定の種類が見分けられる」ための凡例(カレンダー画面のフィル
 * ターシート内に表示)。同じ色は出現順を保って1エントリにまとめるが、ラベル
 * は「タグ名」を「カレンダー名(タグなしのフォールバック)」より常に優先する
 * - タグの色がたまたま何かのカレンダーのデフォルト色と一致した場合、その
 * カレンダーの未タグ付け予定が先に出現していると、タグを設定しているのに
 * カレンダー名が表示されてしまう不具合があったため(2026-09)。
 */
export function buildEventColorLegend(
  events: EventWithTagColor[],
  tagsByEventId: Record<string, Tag[]>,
  calendars: Calendar[]
): EventColorLegendEntry[] {
  const calendarColorById = Object.fromEntries(calendars.map((calendar) => [calendar.id, calendar.color]));
  const order: string[] = [];
  const labelByColor: Record<string, string> = {};
  const isTagLabelByColor: Record<string, boolean> = {};

  for (const event of events) {
    const color = event.tagColor ?? calendarColorById[event.calendarId] ?? "#999999";
    const { label, isTagLabel } = resolveEventLegendLabel(event, tagsByEventId[event.id] ?? [], calendars);

    if (!(color in labelByColor)) {
      order.push(color);
      labelByColor[color] = label;
      isTagLabelByColor[color] = isTagLabel;
    } else if (isTagLabel && !isTagLabelByColor[color]) {
      labelByColor[color] = label;
      isTagLabelByColor[color] = true;
    }
  }

  return order.map((color) => ({ color, label: labelByColor[color] }));
}
