import { expandEventDateKeys } from "../eventDateKeys";

describe("expandEventDateKeys", () => {
  it("returns a single date key for a same-day event", () => {
    expect(expandEventDateKeys("2026-09-01T09:00:00.000Z", "2026-09-01T10:00:00.000Z")).toEqual([
      "2026-09-01",
    ]);
  });

  it("returns every date key from start through end, inclusive", () => {
    expect(expandEventDateKeys("2026-09-01T09:00:00.000Z", "2026-09-03T10:00:00.000Z")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("spans across a month boundary", () => {
    expect(expandEventDateKeys("2026-09-29T09:00:00.000Z", "2026-10-01T10:00:00.000Z")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
  });

  it("keys by the JST calendar day, not the raw UTC date", () => {
    // 2026-09-01T20:00:00.000Z is 2026-09-02 05:00 JST - a late-night event
    // stored in UTC should appear on its JST day, not the UTC one.
    expect(expandEventDateKeys("2026-09-01T20:00:00.000Z", "2026-09-01T21:00:00.000Z")).toEqual([
      "2026-09-02",
    ]);
  });

  it("falls back to just the start date when end is before start (malformed data)", () => {
    expect(expandEventDateKeys("2026-09-05T09:00:00.000Z", "2026-09-01T10:00:00.000Z")).toEqual([
      "2026-09-05",
    ]);
  });
});
