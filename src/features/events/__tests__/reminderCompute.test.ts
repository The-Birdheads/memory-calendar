import { computeEventReminderAt } from "../reminderCompute";

describe("computeEventReminderAt", () => {
  const START_AT = "2026-09-10T01:00:00.000Z"; // 2026-09-10 10:00 JST

  it("computes 当日(on_day) as JST 9:00 on the event's own JST calendar day", () => {
    expect(computeEventReminderAt("on_day", START_AT)).toBe("2026-09-10T00:00:00.000Z"); // JST 09:00
  });

  it("computes 1日前(day_before_1) as JST 9:00 the day before", () => {
    expect(computeEventReminderAt("day_before_1", START_AT)).toBe("2026-09-09T00:00:00.000Z");
  });

  it("computes 2日前(day_before_2) as JST 9:00 two days before", () => {
    expect(computeEventReminderAt("day_before_2", START_AT)).toBe("2026-09-08T00:00:00.000Z");
  });

  it("computes 開始時(at_start) as the event's own start time", () => {
    expect(computeEventReminderAt("at_start", START_AT)).toBe(START_AT);
  });

  it("computes 10分前(before_10m) as 10 minutes before start", () => {
    expect(computeEventReminderAt("before_10m", START_AT)).toBe("2026-09-10T00:50:00.000Z");
  });

  it("computes 1時間前(before_1h) as 1 hour before start", () => {
    expect(computeEventReminderAt("before_1h", START_AT)).toBe("2026-09-10T00:00:00.000Z");
  });

  it("computes a custom offset in minutes", () => {
    expect(computeEventReminderAt("custom", START_AT, { value: 30, unit: "minute" })).toBe(
      "2026-09-10T00:30:00.000Z"
    );
  });

  it("computes a custom offset in hours", () => {
    expect(computeEventReminderAt("custom", START_AT, { value: 3, unit: "hour" })).toBe("2026-09-09T22:00:00.000Z");
  });

  it("computes a custom offset in days", () => {
    expect(computeEventReminderAt("custom", START_AT, { value: 2, unit: "day" })).toBe("2026-09-08T01:00:00.000Z");
  });

  it("computes a custom offset in weeks", () => {
    expect(computeEventReminderAt("custom", START_AT, { value: 1, unit: "week" })).toBe("2026-09-03T01:00:00.000Z");
  });

  it("uses the event's JST calendar day even when its UTC timestamp falls late in the previous UTC day", () => {
    // 2026-09-01 15:30 UTC = 2026-09-02 00:30 JST, so the event's own JST
    // day is the 2nd - 1日前 should land on JST 9:00 the 1st (UTC 00:00).
    expect(computeEventReminderAt("day_before_1", "2026-09-01T15:30:00.000Z")).toBe("2026-09-01T00:00:00.000Z");
  });
});
