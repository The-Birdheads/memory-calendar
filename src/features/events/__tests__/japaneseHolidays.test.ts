import { getJapaneseHolidayName, isJapaneseHoliday } from "../japaneseHolidays";

describe("isJapaneseHoliday / getJapaneseHolidayName", () => {
  it("recognizes fixed-date holidays", () => {
    expect(isJapaneseHoliday("2026-01-01")).toBe(true);
    expect(getJapaneseHolidayName("2026-01-01")).toBe("元日");
    expect(getJapaneseHolidayName("2026-11-03")).toBe("文化の日");
    expect(getJapaneseHolidayName("2026-08-11")).toBe("山の日");
  });

  it("recognizes the nth-weekday holidays", () => {
    // 成人の日 = 2nd Monday of January
    expect(getJapaneseHolidayName("2025-01-13")).toBe("成人の日");
    // 海の日 = 3rd Monday of July
    expect(getJapaneseHolidayName("2026-07-20")).toBe("海の日");
  });

  it("computes the vernal and autumnal equinox days for known years", () => {
    expect(getJapaneseHolidayName("2024-03-20")).toBe("春分の日");
    expect(getJapaneseHolidayName("2024-09-22")).toBe("秋分の日");
    expect(getJapaneseHolidayName("2025-09-23")).toBe("秋分の日");
  });

  it("moves a Sunday holiday to the substitute holiday (振替休日) on the next day", () => {
    // 2024-11-03 (文化の日) fell on a Sunday.
    expect(getJapaneseHolidayName("2024-11-03")).toBe("文化の日");
    expect(getJapaneseHolidayName("2024-11-04")).toBe("振替休日");
  });

  it("returns false/null for an ordinary weekday", () => {
    expect(isJapaneseHoliday("2026-06-15")).toBe(false);
    expect(getJapaneseHolidayName("2026-06-15")).toBeNull();
  });
});
