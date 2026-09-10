import { groupMemoriesByYearMonth } from "../groupByYearMonth";
import type { MemoryEntry } from "../types";

function makeEntry(id: string, startAt: string): MemoryEntry {
  return {
    id,
    calendarId: "cal-1",
    title: `event-${id}`,
    startAt,
    endAt: startAt,
    isAllDay: false,
    location: null,
    memo: null,
    categoryColor: "#2f6fed",
    createdBy: "user-1",
    updatedBy: "user-1",
    thumbnailStoragePath: `${id}/a.jpg`,
  } as unknown as MemoryEntry;
}

describe("groupMemoriesByYearMonth", () => {
  it("groups consecutive entries sharing the same JST year-month under one header", () => {
    const entries = [
      makeEntry("e1", "2026-08-20T01:00:00.000Z"),
      makeEntry("e2", "2026-08-10T01:00:00.000Z"),
      makeEntry("e3", "2026-07-15T01:00:00.000Z"),
    ];

    const groups = groupMemoriesByYearMonth(entries);

    expect(groups.map((g) => g.yearMonth)).toEqual(["2026-08", "2026-07"]);
    expect(groups[0].label).toBe("2026年8月");
    expect(groups[0].entries.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(groups[1].entries.map((e) => e.id)).toEqual(["e3"]);
  });

  it("splits into a new group even if the same year-month reappears non-consecutively", () => {
    const entries = [
      makeEntry("e1", "2026-08-20T01:00:00.000Z"),
      makeEntry("e2", "2026-07-15T01:00:00.000Z"),
      makeEntry("e3", "2026-08-10T01:00:00.000Z"),
    ];

    const groups = groupMemoriesByYearMonth(entries);

    expect(groups.map((g) => g.yearMonth)).toEqual(["2026-08", "2026-07", "2026-08"]);
  });

  it("returns an empty array for no entries", () => {
    expect(groupMemoriesByYearMonth([])).toEqual([]);
  });

  it("keeps a JST day just after UTC midnight in the previous JST month when it's still the previous month", () => {
    // 2026-08-01T00:30:00Z is 2026-08-01T09:30 JST - not a boundary case,
    // but 2026-07-31T15:30:00Z is 2026-08-01T00:30 JST (JST already rolled
    // over to August even though the UTC instant is still July 31).
    const entries = [makeEntry("e1", "2026-07-31T15:30:00.000Z")];

    const groups = groupMemoriesByYearMonth(entries);

    expect(groups[0].yearMonth).toBe("2026-08");
  });
});
