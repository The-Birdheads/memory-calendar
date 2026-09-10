import type { Calendar } from "../../features/calendars/types";
import type { Tag } from "../../features/tags/types";

export interface ColorUsageEntry {
  calendars: Calendar[];
  tags: Tag[];
}

export interface FindColorUsageOptions {
  /** 編集中のカレンダー自身は「使用中」に含めない。 */
  excludeCalendarId?: string;
  /** 編集中のタグ自身は「使用中」に含めない。 */
  excludeTagId?: string;
}

/**
 * 指定した色(パレットの1色)を、他のカレンダー・タグが既に使っていないか
 * 調べる。タグは大分類(major)のみを対象にする - 中分類/小分類は親の色を
 * 自動で薄めた色になり(`lightenHexColor`)、パレットのhex値そのものとは
 * 一致しないため。編集中の本人(calendarId/tagId)は除外する(2026-09追加 -
 * パレットが7色しかなく、カレンダー/タグが増えるほど色が被りやすいため、
 * 被っていること自体に選択時に気づけるようにした)。
 */
export function findColorUsage(
  hex: string,
  calendars: Calendar[],
  tags: Tag[],
  options: FindColorUsageOptions = {}
): ColorUsageEntry {
  return {
    calendars: calendars.filter((calendar) => calendar.color === hex && calendar.id !== options.excludeCalendarId),
    tags: tags.filter((tag) => tag.level === "major" && tag.color === hex && tag.id !== options.excludeTagId),
  };
}

export function hasColorUsage(usage: ColorUsageEntry): boolean {
  return usage.calendars.length > 0 || usage.tags.length > 0;
}

/**
 * 「この色は共有カレンダー「〇〇」で使用中です」「この色は共有カレンダー
 * 「〇〇」とタグ「〇〇」で使用中です」のような説明文を組み立てる。
 * 使用箇所が無ければnull。
 */
export function formatColorUsageMessage(usage: ColorUsageEntry): string | null {
  if (!hasColorUsage(usage)) return null;

  const parts: string[] = [];
  if (usage.calendars.length > 0) {
    parts.push(
      usage.calendars
        .map((calendar) => `${calendar.kind === "personal" ? "個人用" : "共有"}カレンダー「${calendar.name}」`)
        .join("、")
    );
  }
  if (usage.tags.length > 0) {
    parts.push(`タグ${usage.tags.map((tag) => `「${tag.name}」`).join("")}`);
  }
  return `この色は${parts.join("と")}で使用中です`;
}
