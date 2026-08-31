import { formatEventDateRangeLabel } from "../formatEventDateRangeLabel";

describe("formatEventDateRangeLabel", () => {
  it("shows a single date, with no time, when the event starts and ends the same day", () => {
    expect(formatEventDateRangeLabel("2026-09-10T10:00:00.000Z", "2026-09-10T12:00:00.000Z")).toBe(
      "2026/09/10"
    );
  });

  it("shows a date range, with no time, when the event spans multiple days", () => {
    expect(formatEventDateRangeLabel("2026-09-10T10:00:00.000Z", "2026-09-12T18:00:00.000Z")).toBe(
      "2026/09/10〜2026/09/12"
    );
  });
});
