import { formatDayHeaderLabel } from "../formatDayHeaderLabel";

describe("formatDayHeaderLabel", () => {
  it("formats a date key with its weekday", () => {
    expect(formatDayHeaderLabel("2026-08-27")).toBe("8月27日 木曜日");
  });

  it("formats a single-digit day without zero-padding", () => {
    expect(formatDayHeaderLabel("2026-09-01")).toBe("9月1日 火曜日");
  });

  it("formats a Sunday", () => {
    expect(formatDayHeaderLabel("2026-08-23")).toBe("8月23日 日曜日");
  });
});
