import { applyTimeDigit, applyTimeValue } from "../timeDigits";

describe("applyTimeDigit - 時(hh)", () => {
  it("waits for the second digit after a first digit that can be a tens digit (0, 1, 2)", () => {
    expect(applyTimeDigit("hour", "", 0)).toEqual({ value: 0, buffer: "0", done: false });
    expect(applyTimeDigit("hour", "", 1)).toEqual({ value: 1, buffer: "1", done: false });
    expect(applyTimeDigit("hour", "", 2)).toEqual({ value: 2, buffer: "2", done: false });
  });

  it("treats a first digit that cannot be a tens digit (3-9, since 30 doesn't exist) as the ones digit and finishes", () => {
    expect(applyTimeDigit("hour", "", 3)).toEqual({ value: 3, buffer: "", done: true });
    expect(applyTimeDigit("hour", "", 9)).toEqual({ value: 9, buffer: "", done: true });
  });

  it("combines the two digits and finishes", () => {
    expect(applyTimeDigit("hour", "1", 8)).toEqual({ value: 18, buffer: "", done: true });
    expect(applyTimeDigit("hour", "0", 7)).toEqual({ value: 7, buffer: "", done: true });
    expect(applyTimeDigit("hour", "2", 3)).toEqual({ value: 23, buffer: "", done: true });
  });

  it("ignores a second digit that would make an hour above 23", () => {
    expect(applyTimeDigit("hour", "2", 4)).toBeNull();
    expect(applyTimeDigit("hour", "2", 9)).toBeNull();
  });
});

describe("applyTimeDigit - 分(mm)", () => {
  it("waits for the second digit after 0-5", () => {
    expect(applyTimeDigit("minute", "", 0)).toEqual({ value: 0, buffer: "0", done: false });
    expect(applyTimeDigit("minute", "", 5)).toEqual({ value: 5, buffer: "5", done: false });
  });

  it("treats a first digit of 6-9 (60 and above don't exist) as the ones digit and finishes", () => {
    expect(applyTimeDigit("minute", "", 6)).toEqual({ value: 6, buffer: "", done: true });
    expect(applyTimeDigit("minute", "", 9)).toEqual({ value: 9, buffer: "", done: true });
  });

  it("combines the two digits and finishes", () => {
    expect(applyTimeDigit("minute", "3", 0)).toEqual({ value: 30, buffer: "", done: true });
    expect(applyTimeDigit("minute", "5", 9)).toEqual({ value: 59, buffer: "", done: true });
  });
});

describe("applyTimeDigit - あり得ない組み合わせ", () => {
  it("never produces a value out of range, whatever digits are typed", () => {
    for (const field of ["hour", "minute"] as const) {
      const max = field === "hour" ? 23 : 59;
      for (let first = 0; first <= 9; first += 1) {
        const firstResult = applyTimeDigit(field, "", first);
        expect(firstResult).not.toBeNull();
        expect(firstResult!.value).toBeLessThanOrEqual(max);
        if (!firstResult!.done) {
          for (let second = 0; second <= 9; second += 1) {
            const secondResult = applyTimeDigit(field, firstResult!.buffer, second);
            if (secondResult) expect(secondResult.value).toBeLessThanOrEqual(max);
          }
        }
      }
    }
  });
});

describe("applyTimeValue (00 / 30 キー)", () => {
  it("puts 00 into the hour (00 exists) and finishes the field", () => {
    expect(applyTimeValue("hour", 0)).toEqual({ value: 0, buffer: "", done: true });
  });

  it("ignores 30 for the hour (there is no 30 o'clock)", () => {
    expect(applyTimeValue("hour", 30)).toBeNull();
  });

  it("puts 00 and 30 into the minutes", () => {
    expect(applyTimeValue("minute", 0)).toEqual({ value: 0, buffer: "", done: true });
    expect(applyTimeValue("minute", 30)).toEqual({ value: 30, buffer: "", done: true });
  });
});
