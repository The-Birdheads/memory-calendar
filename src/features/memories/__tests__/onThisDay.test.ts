import { selectOnThisDayEntries } from "../onThisDay";
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

describe("selectOnThisDayEntries", () => {
  it("selects entries whose JST month-day matches today's, from a past year", () => {
    const entries = [
      makeEntry("e1", "2024-08-18T01:00:00.000Z"), // 同じ月日、2年前
      makeEntry("e2", "2025-08-18T01:00:00.000Z"), // 同じ月日、1年前
      makeEntry("e3", "2025-08-19T01:00:00.000Z"), // 月日が違う
    ];

    const result = selectOnThisDayEntries(entries, "2026-08-18");

    expect(result.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("excludes entries from today's own year (already visible at the top of the grid)", () => {
    const entries = [makeEntry("e1", "2026-08-18T01:00:00.000Z")];

    const result = selectOnThisDayEntries(entries, "2026-08-18");

    expect(result).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    const entries = [makeEntry("e1", "2026-01-01T01:00:00.000Z")];

    expect(selectOnThisDayEntries(entries, "2026-08-18")).toEqual([]);
  });

  it("returns an empty array for no entries", () => {
    expect(selectOnThisDayEntries([], "2026-08-18")).toEqual([]);
  });
});
