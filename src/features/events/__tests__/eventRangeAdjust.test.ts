import { adjustEndForNewStart, jstHourMinute, withJstTime } from "../eventRangeAdjust";

const d = (iso: string) => new Date(iso);

describe("adjustEndForNewStart", () => {
  describe("時刻あり(終日ではない)", () => {
    it("leaves the end alone when the new start is still before it", () => {
      const end = d("2026-09-01T10:00:00.000Z");
      expect(adjustEndForNewStart(d("2026-09-01T09:00:00.000Z"), end, false)).toEqual(end);
    });

    it("moves the end to the start's day (keeping the end's time of day) when the start date moves past the end date", () => {
      // 終了 2026/09/01 19:00 JST / 開始を 2026/09/05 18:00 JST に変更 -> 終了は 09/05 19:00 JST
      const result = adjustEndForNewStart(d("2026-09-05T09:00:00.000Z"), d("2026-09-01T10:00:00.000Z"), false);
      expect(result).toEqual(d("2026-09-05T10:00:00.000Z"));
    });

    it("sets the end to one hour after the start when moving it to the start's day would still leave it before the start", () => {
      // 終了 09/01 10:00Z(19:00 JST) / 開始を 09/05 20:00 JST(11:00Z)に -> 同日の19:00では開始より前なので開始+1時間
      const result = adjustEndForNewStart(d("2026-09-05T11:00:00.000Z"), d("2026-09-01T10:00:00.000Z"), false);
      expect(result).toEqual(d("2026-09-05T12:00:00.000Z"));
    });

    it("sets the end to one hour after the start when, on the same day, the start time moves past the end time", () => {
      const result = adjustEndForNewStart(d("2026-09-01T11:30:00.000Z"), d("2026-09-01T10:00:00.000Z"), false);
      expect(result).toEqual(d("2026-09-01T12:30:00.000Z"));
    });

    it("leaves the end alone when start and end are exactly equal", () => {
      const end = d("2026-09-01T10:00:00.000Z");
      expect(adjustEndForNewStart(d("2026-09-01T10:00:00.000Z"), end, false)).toEqual(end);
    });

    it("compares days in JST, not UTC (15:30Z is already the next day in JST)", () => {
      // 開始 09/02 00:30 JST(09/01 15:30Z) / 終了 09/01 23:00 JST(14:00Z) -> 日付が開始より前
      // 同日(09/02)の23:00 JSTに寄せる
      const result = adjustEndForNewStart(d("2026-09-01T15:30:00.000Z"), d("2026-09-01T14:00:00.000Z"), false);
      expect(result).toEqual(d("2026-09-02T14:00:00.000Z"));
    });
  });

  describe("終日", () => {
    it("leaves the end alone when the start day is not after the end day", () => {
      const end = d("2026-09-03T00:00:00.000Z");
      expect(adjustEndForNewStart(d("2026-09-03T00:00:00.000Z"), end, true)).toEqual(end);
      expect(adjustEndForNewStart(d("2026-09-02T00:00:00.000Z"), end, true)).toEqual(end);
    });

    it("sets the end to the same day as the start when the start day moves past the end day", () => {
      const result = adjustEndForNewStart(d("2026-09-10T00:00:00.000Z"), d("2026-09-03T00:00:00.000Z"), true);
      expect(result).toEqual(d("2026-09-10T00:00:00.000Z"));
    });

    it("does not add an hour on the same day (time of day is irrelevant)", () => {
      const end = d("2026-09-03T01:00:00.000Z");
      expect(adjustEndForNewStart(d("2026-09-03T05:00:00.000Z"), end, true)).toEqual(end);
    });
  });
});

describe("jstHourMinute", () => {
  it("reads the hour and minute as JST wall-clock time", () => {
    expect(jstHourMinute(new Date("2026-09-01T09:05:00.000Z"))).toEqual({ hour: 18, minute: 5 });
  });

  it("rolls over midnight in JST (15:30Z is already 00:30 the next day)", () => {
    expect(jstHourMinute(new Date("2026-09-01T15:30:00.000Z"))).toEqual({ hour: 0, minute: 30 });
  });
});

describe("withJstTime", () => {
  it("replaces the time of day but keeps the JST calendar day", () => {
    // 2026-09-01 18:00 JST -> 2026-09-01 07:45 JST
    expect(withJstTime(new Date("2026-09-01T09:00:00.000Z"), 7, 45)).toEqual(new Date("2026-08-31T22:45:00.000Z"));
  });

  it("keeps the JST day even when the instant is on the previous UTC day", () => {
    // 2026-09-02 00:30 JST (= 09-01 15:30Z) -> 2026-09-02 23:10 JST
    expect(withJstTime(new Date("2026-09-01T15:30:00.000Z"), 23, 10)).toEqual(new Date("2026-09-02T14:10:00.000Z"));
  });

  it("round-trips with jstHourMinute", () => {
    const result = withJstTime(new Date("2026-09-01T09:00:00.000Z"), 21, 7);
    expect(jstHourMinute(result)).toEqual({ hour: 21, minute: 7 });
  });
});
