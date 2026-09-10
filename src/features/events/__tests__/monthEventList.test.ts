import { buildMonthEventGroups } from "../monthEventList";
import type { Event } from "../types";

function makeEvent(id: string, startAt: string, endAt: string): Event {
  return {
    id,
    calendarId: "cal-1",
    seriesId: null,
    title: `event-${id}`,
    location: null,
    memo: null,
    url: null,
    categoryColor: "#2f6fed",
    startAt,
    endAt,
    isAllDay: false,
    reminderAt: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildMonthEventGroups", () => {
  it("groups events by the JST day they fall on, only for days within the given month", () => {
    const events = [
      makeEvent("e1", "2026-09-10T01:00:00.000Z", "2026-09-10T02:00:00.000Z"),
      makeEvent("e2", "2026-09-05T01:00:00.000Z", "2026-09-05T02:00:00.000Z"),
      // Padding day from the previous month (would appear on the grid but
      // not in "September's" list).
      makeEvent("e3", "2026-08-31T01:00:00.000Z", "2026-08-31T02:00:00.000Z"),
    ];

    const groups = buildMonthEventGroups(events, 2026, 9);

    expect(groups.map((g) => g.dateKey)).toEqual(["2026-09-05", "2026-09-10"]);
    expect(groups[0].label).toBe("9月5日 土曜日");
    expect(groups[0].events.map((e) => e.id)).toEqual(["e2"]);
    expect(groups[1].events.map((e) => e.id)).toEqual(["e1"]);
  });

  it("skips days with no events (only days that actually have something are listed)", () => {
    const events = [makeEvent("e1", "2026-09-10T01:00:00.000Z", "2026-09-10T02:00:00.000Z")];

    const groups = buildMonthEventGroups(events, 2026, 9);

    expect(groups).toHaveLength(1);
  });

  it("shows a multi-day event under every day it spans within the month", () => {
    const events = [makeEvent("e1", "2026-09-10T01:00:00.000Z", "2026-09-12T02:00:00.000Z")];

    const groups = buildMonthEventGroups(events, 2026, 9);

    expect(groups.map((g) => g.dateKey)).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("sorts each day's events chronologically by start time", () => {
    const events = [
      makeEvent("late", "2026-09-10T10:00:00.000Z", "2026-09-10T11:00:00.000Z"),
      makeEvent("early", "2026-09-10T01:00:00.000Z", "2026-09-10T02:00:00.000Z"),
    ];

    const groups = buildMonthEventGroups(events, 2026, 9);

    expect(groups[0].events.map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("returns an empty array when nothing falls within the month", () => {
    expect(buildMonthEventGroups([], 2026, 9)).toEqual([]);
  });
});
