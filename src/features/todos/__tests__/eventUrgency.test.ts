import { getEventUrgency } from "../eventUrgency";

describe("getEventUrgency", () => {
  it("returns 'overdue' when the event's JST date is before today", () => {
    // 2026-09-03T15:00:00Z + 9h = 2026-09-04 00:00 JST
    expect(getEventUrgency("2026-09-03T15:00:00.000Z", "2026-09-05")).toBe("overdue");
  });

  it("returns 'today' when the event's JST date is today", () => {
    // 2026-09-05T15:00:00Z + 9h = 2026-09-06 00:00 JST
    expect(getEventUrgency("2026-09-05T15:00:00.000Z", "2026-09-06")).toBe("today");
  });

  it("returns 'tomorrow' when the event's JST date is exactly one day after today", () => {
    expect(getEventUrgency("2026-09-07T01:00:00.000Z", "2026-09-06")).toBe("tomorrow");
  });

  it("returns 'none' when the event's JST date is two or more days after today", () => {
    expect(getEventUrgency("2026-09-08T01:00:00.000Z", "2026-09-05")).toBe("none");
  });

  it("handles a JST date crossing a month boundary for 'tomorrow'", () => {
    // 2026-09-30 JST -> tomorrow is 2026-10-01 JST
    expect(getEventUrgency("2026-09-30T20:00:00.000Z", "2026-09-30")).toBe("tomorrow");
  });
});
