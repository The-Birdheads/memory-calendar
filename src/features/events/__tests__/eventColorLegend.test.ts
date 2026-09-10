import { buildEventColorLegend } from "../eventColorLegend";
import type { EventWithTagColor } from "../types";
import type { Tag } from "../../tags/types";
import type { Calendar } from "../../calendars/types";

function makeEvent(id: string, overrides: Partial<EventWithTagColor> = {}): EventWithTagColor {
  return {
    id,
    calendarId: "cal-1",
    seriesId: null,
    title: `event-${id}`,
    location: null,
    memo: null,
    url: null,
    categoryColor: null,
    startAt: "2026-09-10T01:00:00.000Z",
    endAt: "2026-09-10T02:00:00.000Z",
    isAllDay: false,
    reminderAt: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tagColor: null,
    photoCount: 0,
    commentCount: 0,
    ...overrides,
  };
}

function makeTag(id: string, name: string, color: string): Tag {
  return { id, parentId: null, level: "major", name, color, createdAt: "2026-01-01T00:00:00.000Z" };
}

function makeCalendar(id: string, name: string, color: string): Calendar {
  return { id, name, kind: "group", color, createdBy: "user-1", createdAt: "2026-01-01T00:00:00.000Z" };
}

const CALENDARS = [makeCalendar("cal-1", "我が家", "#2f6fed"), makeCalendar("cal-2", "友人グループ", "#43a047")];

describe("buildEventColorLegend", () => {
  it("labels a tagged event with its matching tag's name", () => {
    const events = [makeEvent("e1", { tagColor: "#e53935" })];
    const tagsByEventId = { e1: [makeTag("tag-1", "誕生日", "#e53935")] };

    const legend = buildEventColorLegend(events, tagsByEventId, CALENDARS);

    expect(legend).toEqual([{ color: "#e53935", label: "誕生日" }]);
  });

  it("labels an untagged event with its calendar's own name", () => {
    const events = [makeEvent("e1", { calendarId: "cal-1" })];

    const legend = buildEventColorLegend(events, {}, CALENDARS);

    expect(legend).toEqual([{ color: "#2f6fed", label: "我が家" }]);
  });

  it("falls back to 'その他' when the event's calendar can't be found", () => {
    const events = [makeEvent("e1", { calendarId: "cal-unknown" })];

    const legend = buildEventColorLegend(events, {}, CALENDARS);

    expect(legend).toEqual([{ color: "#999999", label: "その他" }]);
  });

  it("dedupes entries sharing the same resolved color, keeping the first label seen", () => {
    const events = [
      makeEvent("e1", { tagColor: "#e53935" }),
      makeEvent("e2", { tagColor: "#e53935" }),
    ];
    const tagsByEventId = {
      e1: [makeTag("tag-1", "誕生日", "#e53935")],
      e2: [makeTag("tag-1", "誕生日", "#e53935")],
    };

    const legend = buildEventColorLegend(events, tagsByEventId, CALENDARS);

    expect(legend).toHaveLength(1);
  });

  it("returns entries in first-seen order across a mix of tagged and untagged events", () => {
    const events = [
      makeEvent("e1", { calendarId: "cal-2" }),
      makeEvent("e2", { tagColor: "#e53935" }),
    ];
    const tagsByEventId = { e2: [makeTag("tag-1", "誕生日", "#e53935")] };

    const legend = buildEventColorLegend(events, tagsByEventId, CALENDARS);

    expect(legend).toEqual([
      { color: "#43a047", label: "友人グループ" },
      { color: "#e53935", label: "誕生日" },
    ]);
  });

  it("returns an empty array for no events", () => {
    expect(buildEventColorLegend([], {}, CALENDARS)).toEqual([]);
  });
});
