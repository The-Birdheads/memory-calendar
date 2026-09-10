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
function resolveEventLegendLabel(event: EventWithTagColor, tags: Tag[], calendars: Calendar[]): string {
  if (event.tagColor) {
    const matchingTag = tags.find((tag) => tag.color === event.tagColor);
    if (matchingTag) return matchingTag.name;
  }
  const calendar = calendars.find((c) => c.id === event.calendarId);
  return calendar ? calendar.name : "その他";
}

/**
 * Builds a de-duplicated (color, label) legend from a set of events, for
 * the「一目で予定の種類が見分けられる」ための凡例(カレンダー画面のフィル
 * ターシート内に表示)。同じ色は最初に出てきたラベルを採用し、出現順を
 * 保つ(呼び出し側でそのまま並べればよい)。
 */
export function buildEventColorLegend(
  events: EventWithTagColor[],
  tagsByEventId: Record<string, Tag[]>,
  calendars: Calendar[]
): EventColorLegendEntry[] {
  const calendarColorById = Object.fromEntries(calendars.map((calendar) => [calendar.id, calendar.color]));
  const seenColors = new Set<string>();
  const legend: EventColorLegendEntry[] = [];

  for (const event of events) {
    const color = event.tagColor ?? calendarColorById[event.calendarId] ?? "#999999";
    if (seenColors.has(color)) continue;
    seenColors.add(color);
    legend.push({ color, label: resolveEventLegendLabel(event, tagsByEventId[event.id] ?? [], calendars) });
  }

  return legend;
}
