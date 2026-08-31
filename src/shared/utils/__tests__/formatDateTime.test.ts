import { formatDateOnly, formatDateTime, formatDateTimeRange, formatTime } from "../formatDateTime";

describe("formatDateTime", () => {
  it("formats an ISO string as zero-padded YYYY/MM/DD hh:mm", () => {
    expect(formatDateTime("2026-01-05T09:03:00.000Z")).toBe("2026/01/05 09:03");
  });

  it("zero-pads single-digit months, days, hours, and minutes", () => {
    expect(formatDateTime("2026-09-01T00:05:00.000Z")).toBe("2026/09/01 00:05");
  });
});

describe("formatDateOnly", () => {
  it("formats just the zero-padded YYYY/MM/DD portion", () => {
    expect(formatDateOnly("2026-09-15T10:30:00.000Z")).toBe("2026/09/15");
  });
});

describe("formatDateTimeRange", () => {
  it("joins the formatted start and end with a wave dash", () => {
    expect(formatDateTimeRange("2026-09-15T10:00:00.000Z", "2026-09-15T12:30:00.000Z")).toBe(
      "2026/09/15 10:00 〜 2026/09/15 12:30"
    );
  });

  it("omits the time when isAllDay is true", () => {
    expect(formatDateTimeRange("2026-09-15T10:00:00.000Z", "2026-09-17T12:30:00.000Z", true)).toBe(
      "2026/09/15 〜 2026/09/17"
    );
  });
});

describe("formatTime", () => {
  it("formats just the zero-padded hh:mm portion", () => {
    expect(formatTime("2026-09-15T09:03:00.000Z")).toBe("09:03");
  });
});
