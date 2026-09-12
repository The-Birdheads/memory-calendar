import { isDateKeyInRange } from "../dateRangeFilter";

describe("isDateKeyInRange", () => {
  it("is true for any date when both bounds are null (no filter)", () => {
    expect(isDateKeyInRange("2026-01-01", null, null)).toBe(true);
    expect(isDateKeyInRange("2099-12-31", null, null)).toBe(true);
  });

  it("respects only a start bound when end is null", () => {
    expect(isDateKeyInRange("2026-09-10", "2026-09-10", null)).toBe(true);
    expect(isDateKeyInRange("2026-09-09", "2026-09-10", null)).toBe(false);
  });

  it("respects only an end bound when start is null", () => {
    expect(isDateKeyInRange("2026-09-10", null, "2026-09-10")).toBe(true);
    expect(isDateKeyInRange("2026-09-11", null, "2026-09-10")).toBe(false);
  });

  it("requires the date to fall within both bounds when both are set", () => {
    expect(isDateKeyInRange("2026-09-05", "2026-09-01", "2026-09-10")).toBe(true);
    expect(isDateKeyInRange("2026-09-01", "2026-09-01", "2026-09-10")).toBe(true);
    expect(isDateKeyInRange("2026-09-10", "2026-09-01", "2026-09-10")).toBe(true);
    expect(isDateKeyInRange("2026-08-31", "2026-09-01", "2026-09-10")).toBe(false);
    expect(isDateKeyInRange("2026-09-11", "2026-09-01", "2026-09-10")).toBe(false);
  });
});
