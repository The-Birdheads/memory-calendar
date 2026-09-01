import { computeDateRange } from "../dateRange";

describe("computeDateRange", () => {
  it("returns the first and last instant of the month (JST) for month view", () => {
    const range = computeDateRange("month", new Date("2026-08-18T10:30:00.000Z"));

    // 2026-08-01 00:00 JST through 2026-08-31 23:59:59.999 JST, expressed as
    // the equivalent absolute UTC instants (JST = UTC+9).
    expect(range).toEqual({
      start: "2026-07-31T15:00:00.000Z",
      end: "2026-08-31T14:59:59.999Z",
    });
  });

  it("returns the first and last instant of the week (Sun-Sat, JST) for week view", () => {
    // 2026-08-18 is a Tuesday, so the week runs 08-16 (Sun) to 08-22 (Sat).
    const range = computeDateRange("week", new Date("2026-08-18T10:30:00.000Z"));

    expect(range).toEqual({
      start: "2026-08-15T15:00:00.000Z",
      end: "2026-08-22T14:59:59.999Z",
    });
  });

  it("returns the first and last instant of the day (JST) for day view", () => {
    const range = computeDateRange("day", new Date("2026-08-18T10:30:00.000Z"));

    expect(range).toEqual({
      start: "2026-08-17T15:00:00.000Z",
      end: "2026-08-18T14:59:59.999Z",
    });
  });
});
