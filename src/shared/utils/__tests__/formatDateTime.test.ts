import {
  formatDateOnly,
  formatDateTime,
  formatDateTimeRange,
  formatTime,
  jstNow,
  todayJstDateKey,
  toJstDateKey,
} from "../formatDateTime";

describe("formatDateTime", () => {
  it("formats a UTC ISO string as zero-padded YYYY/MM/DD hh:mm in JST (+9h)", () => {
    expect(formatDateTime("2026-01-05T09:03:00.000Z")).toBe("2026/01/05 18:03");
  });

  it("zero-pads single-digit months, days, hours, and minutes", () => {
    expect(formatDateTime("2026-09-01T00:05:00.000Z")).toBe("2026/09/01 09:05");
  });

  it("rolls over to the next JST day when the +9h shift crosses midnight", () => {
    expect(formatDateTime("2026-09-15T20:00:00.000Z")).toBe("2026/09/16 05:00");
  });
});

describe("formatDateOnly", () => {
  it("formats just the zero-padded YYYY/MM/DD portion, in JST", () => {
    expect(formatDateOnly("2026-09-15T10:30:00.000Z")).toBe("2026/09/15");
  });

  it("rolls over to the next JST day when the +9h shift crosses midnight", () => {
    expect(formatDateOnly("2026-09-15T20:00:00.000Z")).toBe("2026/09/16");
  });
});

describe("formatDateTimeRange", () => {
  it("joins the formatted start and end (JST) with a wave dash", () => {
    expect(formatDateTimeRange("2026-09-15T10:00:00.000Z", "2026-09-15T12:30:00.000Z")).toBe(
      "2026/09/15 19:00 〜 2026/09/15 21:30"
    );
  });

  it("omits the time when isAllDay is true", () => {
    expect(formatDateTimeRange("2026-09-15T10:00:00.000Z", "2026-09-17T12:30:00.000Z", true)).toBe(
      "2026/09/15 〜 2026/09/17"
    );
  });
});

describe("toJstDateKey", () => {
  it("returns the YYYY-MM-DD JST calendar day for a UTC instant", () => {
    expect(toJstDateKey("2026-09-15T10:00:00.000Z")).toBe("2026-09-15");
  });

  it("rolls over to the next JST day when the +9h shift crosses midnight", () => {
    expect(toJstDateKey("2026-09-15T20:00:00.000Z")).toBe("2026-09-16");
  });
});

describe("jstNow", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a Date whose UTC-* accessors read as the current JST wall-clock time", () => {
    jest.useFakeTimers();
    // 2026-09-15T20:00:00.000Z is 2026-09-16 05:00 JST.
    jest.setSystemTime(new Date("2026-09-15T20:00:00.000Z"));

    const now = jstNow();

    expect(now.getUTCFullYear()).toBe(2026);
    expect(now.getUTCMonth()).toBe(8); // September (0-indexed)
    expect(now.getUTCDate()).toBe(16);
    expect(now.getUTCHours()).toBe(5);
  });
});

describe("todayJstDateKey", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns today's JST calendar day, rolling over even right around UTC midnight", () => {
    jest.useFakeTimers();
    // 2026-09-15T20:00:00.000Z is 2026-09-16 05:00 JST.
    jest.setSystemTime(new Date("2026-09-15T20:00:00.000Z"));

    expect(todayJstDateKey()).toBe("2026-09-16");
  });
});

describe("formatTime", () => {
  it("formats just the zero-padded hh:mm portion, in JST", () => {
    expect(formatTime("2026-09-15T09:03:00.000Z")).toBe("18:03");
  });

  it("rolls over to the next JST day's hour when the +9h shift crosses midnight", () => {
    expect(formatTime("2026-09-15T20:00:00.000Z")).toBe("05:00");
  });
});
