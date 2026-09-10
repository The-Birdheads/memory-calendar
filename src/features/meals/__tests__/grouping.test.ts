import { groupMealsByDate, groupMealsByMonth } from "../grouping";
import type { MealRecord, MealSlot } from "../types";

function makeRecord(id: string, mealDate: string, slot: MealSlot = "dinner"): MealRecord {
  return {
    id,
    calendarId: "cal-1",
    mealDate,
    slot,
    title: `meal-${id}`,
    rating: null,
    url: null,
    memo: null,
    createdBy: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("groupMealsByDate", () => {
  it("groups consecutive records sharing the same mealDate under one header", () => {
    const records = [
      makeRecord("r1", "2026-09-10"),
      makeRecord("r2", "2026-09-10"),
      makeRecord("r3", "2026-09-11"),
    ];

    const groups = groupMealsByDate(records);

    expect(groups.map((g) => g.mealDate)).toEqual(["2026-09-10", "2026-09-11"]);
    expect(groups[0].label).toBe("9月10日 木曜日");
    expect(groups[0].records.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(groups[1].records.map((r) => r.id)).toEqual(["r3"]);
  });

  it("orders each day's own records 間食→夕食→昼食→朝食 (snack, dinner, lunch, breakfast), not chronologically", () => {
    const records = [
      makeRecord("breakfast", "2026-09-10", "breakfast"),
      makeRecord("lunch", "2026-09-10", "lunch"),
      makeRecord("dinner", "2026-09-10", "dinner"),
      makeRecord("snack", "2026-09-10", "snack"),
    ];

    const groups = groupMealsByDate(records);

    expect(groups[0].records.map((r) => r.id)).toEqual(["snack", "dinner", "lunch", "breakfast"]);
  });

  it("keeps same-slot records in their original relative order (stable sort)", () => {
    const records = [
      makeRecord("snack-a", "2026-09-10", "snack"),
      makeRecord("dinner-a", "2026-09-10", "dinner"),
      makeRecord("snack-b", "2026-09-10", "snack"),
    ];

    const groups = groupMealsByDate(records);

    expect(groups[0].records.map((r) => r.id)).toEqual(["snack-a", "snack-b", "dinner-a"]);
  });

  it("returns an empty array for no records", () => {
    expect(groupMealsByDate([])).toEqual([]);
  });
});

describe("groupMealsByMonth", () => {
  it("groups consecutive records sharing the same YYYY-MM prefix under one header", () => {
    const records = [
      makeRecord("r1", "2026-08-20"),
      makeRecord("r2", "2026-08-10"),
      makeRecord("r3", "2026-07-15"),
    ];

    const groups = groupMealsByMonth(records);

    expect(groups.map((g) => g.yearMonth)).toEqual(["2026-08", "2026-07"]);
    expect(groups[0].label).toBe("2026年8月");
    expect(groups[0].records.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(groups[1].records.map((r) => r.id)).toEqual(["r3"]);
  });

  it("returns an empty array for no records", () => {
    expect(groupMealsByMonth([])).toEqual([]);
  });
});
