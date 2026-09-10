import { groupEventsByYearMonth } from "../groupByYearMonth";
import type { Event } from "../../events/types";

function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: "event-x",
    calendarId: "cal-1",
    seriesId: null,
    title: "event",
    location: null,
    memo: null,
    url: null,
    categoryColor: null,
    startAt: "2026-08-01T01:00:00.000Z",
    endAt: "2026-08-01T02:00:00.000Z",
    isAllDay: false,
    reminderAt: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupEventsByYearMonth", () => {
  it("groups consecutive events that fall in the same JST year-month", () => {
    const events = [
      makeEvent({ id: "event-1", startAt: "2026-09-10T01:00:00.000Z" }), // 2026-09 JST
      makeEvent({ id: "event-2", startAt: "2026-09-03T01:00:00.000Z" }), // 2026-09 JST
    ];

    const groups = groupEventsByYearMonth(events);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("2026年9月");
    expect(groups[0].events.map((e) => e.id)).toEqual(["event-1", "event-2"]);
  });

  it("starts a new group when the year-month changes, preserving input order", () => {
    const events = [
      makeEvent({ id: "event-1", startAt: "2026-09-10T01:00:00.000Z" }),
      makeEvent({ id: "event-2", startAt: "2026-08-20T01:00:00.000Z" }),
      makeEvent({ id: "event-3", startAt: "2026-08-05T01:00:00.000Z" }),
    ];

    const groups = groupEventsByYearMonth(events);

    expect(groups.map((g) => g.label)).toEqual(["2026年9月", "2026年8月"]);
    expect(groups[0].events.map((e) => e.id)).toEqual(["event-1"]);
    expect(groups[1].events.map((e) => e.id)).toEqual(["event-2", "event-3"]);
  });

  it("handles a JST month rollover at the UTC boundary", () => {
    // 2026-08-31T15:00:00Z + 9h = 2026-09-01 JST
    const events = [makeEvent({ id: "event-1", startAt: "2026-08-31T15:00:00.000Z" })];

    const groups = groupEventsByYearMonth(events);

    expect(groups[0].label).toBe("2026年9月");
  });

  it("returns an empty array for no events", () => {
    expect(groupEventsByYearMonth([])).toEqual([]);
  });
});
