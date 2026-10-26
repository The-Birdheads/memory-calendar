/**
 * @jest-environment node
 */
import { chunk, excludeLogged, lookbackStart, REMINDER_LOOKBACK_MS } from "../dueReminders";

describe("lookbackStart", () => {
  it("is the lookback window before now, as an ISO string", () => {
    const now = new Date("2026-10-26T10:00:00.000Z");

    expect(lookbackStart(now)).toBe(new Date(now.getTime() - REMINDER_LOOKBACK_MS).toISOString());
    expect(REMINDER_LOOKBACK_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("excludeLogged", () => {
  it("drops the reminders that already have a notification_log row, keeping the order of the rest", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

    expect(excludeLogged(rows, new Set(["b", "d"]))).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("keeps everything when nothing was logged, and returns nothing when everything was", () => {
    const rows = [{ id: "a" }, { id: "b" }];

    expect(excludeLogged(rows, new Set())).toEqual(rows);
    expect(excludeLogged(rows, new Set(["a", "b"]))).toEqual([]);
  });
});

describe("chunk", () => {
  it("splits a list into groups of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no groups for an empty list", () => {
    expect(chunk([], 3)).toEqual([]);
  });
});
