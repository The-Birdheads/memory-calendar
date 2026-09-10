import { findColorUsage, formatColorUsageMessage, hasColorUsage } from "../colorUsage";
import type { Calendar } from "../../../features/calendars/types";
import type { Tag } from "../../../features/tags/types";

function makeCalendar(id: string, name: string, color: string, kind: Calendar["kind"] = "group"): Calendar {
  return { id, name, kind, color, createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" };
}

function makeTag(id: string, name: string, color: string, level: Tag["level"] = "major"): Tag {
  return { id, parentId: null, level, name, color, createdAt: "2026-08-01T00:00:00.000Z" };
}

describe("findColorUsage", () => {
  it("finds calendars and major tags using the given color", () => {
    const calendars = [makeCalendar("cal-1", "我が家", "#e53935")];
    const tags = [makeTag("tag-1", "旅行", "#e53935")];

    const usage = findColorUsage("#e53935", calendars, tags);

    expect(usage.calendars).toEqual(calendars);
    expect(usage.tags).toEqual(tags);
  });

  it("returns empty arrays when nothing uses the color", () => {
    const usage = findColorUsage("#e53935", [makeCalendar("cal-1", "我が家", "#2f6fed")], []);

    expect(usage.calendars).toEqual([]);
    expect(usage.tags).toEqual([]);
  });

  it("excludes the calendar being edited from its own usage check", () => {
    const editing = makeCalendar("cal-1", "我が家", "#e53935");
    const other = makeCalendar("cal-2", "友人", "#e53935");

    const usage = findColorUsage("#e53935", [editing, other], [], { excludeCalendarId: "cal-1" });

    expect(usage.calendars).toEqual([other]);
  });

  it("excludes the tag being edited from its own usage check", () => {
    const editing = makeTag("tag-1", "旅行", "#e53935");
    const other = makeTag("tag-2", "仕事", "#e53935");

    const usage = findColorUsage("#e53935", [], [editing, other], { excludeTagId: "tag-1" });

    expect(usage.tags).toEqual([other]);
  });

  it("ignores mid/minor tags entirely, since their color is auto-derived (lightened) and never matches a raw palette hex", () => {
    const midTag = makeTag("tag-1", "誕生日", "#e53935", "mid");
    const minorTag = makeTag("tag-2", "母の日", "#e53935", "minor");

    const usage = findColorUsage("#e53935", [], [midTag, minorTag]);

    expect(usage.tags).toEqual([]);
  });
});

describe("hasColorUsage", () => {
  it("is true when either calendars or tags use the color", () => {
    expect(hasColorUsage({ calendars: [makeCalendar("cal-1", "我が家", "#e53935")], tags: [] })).toBe(true);
    expect(hasColorUsage({ calendars: [], tags: [makeTag("tag-1", "旅行", "#e53935")] })).toBe(true);
  });

  it("is false when nothing uses the color", () => {
    expect(hasColorUsage({ calendars: [], tags: [] })).toBe(false);
  });
});

describe("formatColorUsageMessage", () => {
  it("returns null when the color is unused", () => {
    expect(formatColorUsageMessage({ calendars: [], tags: [] })).toBeNull();
  });

  it("mentions a single shared calendar", () => {
    const usage = { calendars: [makeCalendar("cal-1", "我が家", "#e53935", "group")], tags: [] };

    expect(formatColorUsageMessage(usage)).toBe("この色は共有カレンダー「我が家」で使用中です");
  });

  it("labels a personal calendar distinctly from a shared one", () => {
    const usage = { calendars: [makeCalendar("cal-1", "Myカレンダー", "#e53935", "personal")], tags: [] };

    expect(formatColorUsageMessage(usage)).toBe("この色は個人用カレンダー「Myカレンダー」で使用中です");
  });

  it("mentions a single tag", () => {
    const usage = { calendars: [], tags: [makeTag("tag-1", "旅行", "#e53935")] };

    expect(formatColorUsageMessage(usage)).toBe("この色はタグ「旅行」で使用中です");
  });

  it("mentions both a shared calendar and a tag together, matching the requested phrasing", () => {
    const usage = {
      calendars: [makeCalendar("cal-1", "我が家", "#e53935", "group")],
      tags: [makeTag("tag-1", "旅行", "#e53935")],
    };

    expect(formatColorUsageMessage(usage)).toBe("この色は共有カレンダー「我が家」とタグ「旅行」で使用中です");
  });

  it("joins multiple calendars and multiple tags", () => {
    const usage = {
      calendars: [
        makeCalendar("cal-1", "我が家", "#e53935", "group"),
        makeCalendar("cal-2", "友人", "#e53935", "group"),
      ],
      tags: [makeTag("tag-1", "旅行", "#e53935"), makeTag("tag-2", "仕事", "#e53935")],
    };

    expect(formatColorUsageMessage(usage)).toBe(
      "この色は共有カレンダー「我が家」、共有カレンダー「友人」とタグ「旅行」「仕事」で使用中です"
    );
  });
});
