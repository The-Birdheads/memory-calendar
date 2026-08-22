import { computeDateRange } from "../dateRange";

describe("computeDateRange", () => {
  it("returns the first and last instant of the month for month view", () => {
    const range = computeDateRange("month", new Date("2026-08-18T10:30:00.000Z"));

    expect(range).toEqual({
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-08-31T23:59:59.999Z",
    });
  });

  it("returns the first and last instant of the week (Sun-Sat) for week view", () => {
    // 2026-08-18 is a Tuesday, so the week runs 08-16 (Sun) to 08-22 (Sat)
    const range = computeDateRange("week", new Date("2026-08-18T10:30:00.000Z"));

    expect(range).toEqual({
      start: "2026-08-16T00:00:00.000Z",
      end: "2026-08-22T23:59:59.999Z",
    });
  });

  it("returns the first and last instant of the day for day view", () => {
    const range = computeDateRange("day", new Date("2026-08-18T10:30:00.000Z"));

    expect(range).toEqual({
      start: "2026-08-18T00:00:00.000Z",
      end: "2026-08-18T23:59:59.999Z",
    });
  });
});
