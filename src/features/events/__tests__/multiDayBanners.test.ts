import { buildMultiDayBanners, fillBannerGaps, MAX_MULTI_DAY_LANES } from "../multiDayBanners";
import { buildMonthGrid } from "../monthGrid";
import type { Event } from "../types";

// August 2026: the grid pads out to full weeks (Sun-Sat), so it also
// includes the last few days of July and the first few of September.
const AUGUST_2026_GRID = buildMonthGrid(new Date("2026-08-01T00:00:00.000Z"));

function makeEvent(id: string, startAt: string, endAt: string): Event {
  return {
    id,
    calendarId: "cal-1",
    seriesId: null,
    title: `イベント${id}`,
    location: null,
    memo: null,
    url: null,
    categoryColor: null,
    startAt,
    endAt,
    isAllDay: true,
    reminderAt: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: startAt,
    updatedAt: startAt,
  };
}

describe("buildMultiDayBanners", () => {
  it("excludes single-day events entirely", () => {
    const events = [makeEvent("e1", "2026-08-10T09:00:00.000Z", "2026-08-10T10:00:00.000Z")];

    const { banners, overflowEventIds } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    expect(banners).toHaveLength(0);
    expect(overflowEventIds.size).toBe(0);
  });

  it("places a multi-day event entirely within one week as a single banner spanning its columns", () => {
    // 2026-08-18 is a Tuesday; 08-18..08-20 (Tue-Thu) falls in one week.
    const events = [makeEvent("e1", "2026-08-18T09:00:00.000Z", "2026-08-20T10:00:00.000Z")];

    const { banners } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    expect(banners).toHaveLength(1);
    expect(banners[0]).toMatchObject({
      colStart: 2, // Tuesday
      colEnd: 4, // Thursday
      lane: 0,
      isStart: true,
      isEnd: true,
    });
  });

  it("splits an event that crosses a week boundary into one banner per week, clipped to that week, keeping the same lane and only capping the true start/end", () => {
    // 2026-08-14 (Fri) to 2026-08-17 (Mon) crosses the Sat/Sun boundary
    // between the week of 08-09..08-15 and the week of 08-16..08-22.
    const events = [makeEvent("e1", "2026-08-14T09:00:00.000Z", "2026-08-17T10:00:00.000Z")];

    const { banners } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    expect(banners).toHaveLength(2);
    const [firstWeekBanner, secondWeekBanner] = [...banners].sort((a, b) => a.weekIndex - b.weekIndex);

    expect(firstWeekBanner).toMatchObject({ colStart: 5, colEnd: 6, isStart: true, isEnd: false, lane: 0 }); // Fri-Sat
    expect(secondWeekBanner).toMatchObject({ colStart: 0, colEnd: 1, isStart: false, isEnd: true, lane: 0 }); // Sun-Mon
  });

  it("assigns overlapping multi-day events to different lanes", () => {
    const events = [
      makeEvent("e1", "2026-08-03T09:00:00.000Z", "2026-08-05T10:00:00.000Z"),
      makeEvent("e2", "2026-08-04T09:00:00.000Z", "2026-08-06T10:00:00.000Z"),
    ];

    const { banners } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    const laneByEventId = Object.fromEntries(banners.map((b) => [b.event.id, b.lane]));
    expect(laneByEventId.e1).not.toBe(laneByEventId.e2);
  });

  it("reuses a lane for a later event that starts only after the earlier one already ended", () => {
    const events = [
      makeEvent("e1", "2026-08-03T09:00:00.000Z", "2026-08-04T10:00:00.000Z"),
      makeEvent("e2", "2026-08-05T09:00:00.000Z", "2026-08-06T10:00:00.000Z"),
    ];

    const { banners } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    const laneByEventId = Object.fromEntries(banners.map((b) => [b.event.id, b.lane]));
    expect(laneByEventId.e1).toBe(0);
    expect(laneByEventId.e2).toBe(0);
  });

  it("keeps the same lane for one event across every week it spans, so it reads as one continuous bar", () => {
    // Spans three full weeks (08-03 Mon through 08-20 Thu), sharing weeks
    // with e2/e3 so it's forced into a non-zero lane, and that lane must
    // stay the same in every week it appears in.
    const events = [
      makeEvent("e1", "2026-08-03T09:00:00.000Z", "2026-08-20T10:00:00.000Z"),
      makeEvent("e2", "2026-08-03T09:00:00.000Z", "2026-08-04T10:00:00.000Z"),
    ];

    const { banners } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    const e1Banners = banners.filter((b) => b.event.id === "e1");
    expect(e1Banners.length).toBeGreaterThan(1);
    const lanes = new Set(e1Banners.map((b) => b.lane));
    expect(lanes.size).toBe(1);
  });

  it("overflows events beyond MAX_MULTI_DAY_LANES concurrent overlaps instead of stacking indefinitely", () => {
    const overlapping = Array.from({ length: MAX_MULTI_DAY_LANES + 1 }, (_, i) =>
      makeEvent(`e${i}`, "2026-08-03T09:00:00.000Z", "2026-08-05T10:00:00.000Z")
    );

    const { banners, overflowEventIds } = buildMultiDayBanners(overlapping, AUGUST_2026_GRID);

    expect(overflowEventIds.size).toBe(1);
    expect(banners.some((b) => overflowEventIds.has(b.event.id))).toBe(false);
  });

  it("reports how many lanes are in use per date, for the caller to reserve vertical space only on days a bar actually crosses (regression: previously reserved space for every day in the week, even ones with no overlapping bar)", () => {
    const events = [
      makeEvent("e1", "2026-08-03T09:00:00.000Z", "2026-08-04T10:00:00.000Z"),
      makeEvent("e2", "2026-08-03T09:00:00.000Z", "2026-08-04T10:00:00.000Z"),
    ];

    const { laneCountByDateKey } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    // 08-03/08-04 (Mon-Tue) は2つの複数日予定が重なっているのでlane数2。
    expect(laneCountByDateKey["2026-08-03"]).toBe(2);
    expect(laneCountByDateKey["2026-08-04"]).toBe(2);
    // 同じ週の他の日(バーが通らない日)には値が入らない。
    expect(laneCountByDateKey["2026-08-02"]).toBeUndefined();
    expect(laneCountByDateKey["2026-08-05"]).toBeUndefined();
  });
});

describe("fillBannerGaps", () => {
  it("fills a lane left empty by a multi-day bar that doesn't reach this date with a single-day event from that date (regression: this lane was previously left blank even when an event existed to fill it)", () => {
    // e1 (lane0) covers 08-02..08-03 only; e2 (lane1, forced there since it
    // overlaps e1 on 08-03) covers 08-03..08-04. So on 08-04, only e2 (lane1)
    // is active - lane0 is free even though laneCountByDateKey reserves 2 rows.
    const events = [
      makeEvent("e1", "2026-08-02T09:00:00.000Z", "2026-08-03T10:00:00.000Z"),
      makeEvent("e2", "2026-08-03T09:00:00.000Z", "2026-08-04T10:00:00.000Z"),
    ];
    const { banners, laneCountByDateKey } = buildMultiDayBanners(events, AUGUST_2026_GRID);
    const singleDayEvent = makeEvent("single-1", "2026-08-04T09:00:00.000Z", "2026-08-04T10:00:00.000Z");
    const singleDayEventsByDateKey = new Map([["2026-08-04", [singleDayEvent]]]);

    const { gapFills, filledEventIds } = fillBannerGaps(
      banners,
      laneCountByDateKey,
      AUGUST_2026_GRID,
      singleDayEventsByDateKey
    );

    expect(gapFills).toHaveLength(1);
    expect(gapFills[0]).toMatchObject({ event: singleDayEvent, lane: 0, col: 2 }); // 08-04 is a Tuesday
    expect(filledEventIds.has("single-1")).toBe(true);
  });

  it("leaves the gap unfilled when no single-day event exists on that date", () => {
    const events = [
      makeEvent("e1", "2026-08-03T09:00:00.000Z", "2026-08-04T10:00:00.000Z"),
      makeEvent("e2", "2026-08-03T09:00:00.000Z", "2026-08-05T10:00:00.000Z"),
    ];
    const { banners, laneCountByDateKey } = buildMultiDayBanners(events, AUGUST_2026_GRID);

    const { gapFills } = fillBannerGaps(banners, laneCountByDateKey, AUGUST_2026_GRID, new Map());

    expect(gapFills).toHaveLength(0);
  });

  it("does not touch dates with no reserved lanes at all, even if single-day events exist there", () => {
    const singleDayEvent = makeEvent("single-1", "2026-08-10T09:00:00.000Z", "2026-08-10T10:00:00.000Z");
    const singleDayEventsByDateKey = new Map([["2026-08-10", [singleDayEvent]]]);

    const { gapFills } = fillBannerGaps([], {}, AUGUST_2026_GRID, singleDayEventsByDateKey);

    expect(gapFills).toHaveLength(0);
  });

  it("fills only as many gap lanes as there are free, leaving extra events on that date unfilled", () => {
    // Same setup as above: only lane0 is free on 08-04 (lane1 is occupied by
    // e2), so only one of the two single-day candidates should be placed.
    const events = [
      makeEvent("e1", "2026-08-02T09:00:00.000Z", "2026-08-03T10:00:00.000Z"),
      makeEvent("e2", "2026-08-03T09:00:00.000Z", "2026-08-04T10:00:00.000Z"),
    ];
    const { banners, laneCountByDateKey } = buildMultiDayBanners(events, AUGUST_2026_GRID);
    const first = makeEvent("single-1", "2026-08-04T09:00:00.000Z", "2026-08-04T10:00:00.000Z");
    const second = makeEvent("single-2", "2026-08-04T11:00:00.000Z", "2026-08-04T12:00:00.000Z");
    const singleDayEventsByDateKey = new Map([["2026-08-04", [first, second]]]);

    const { gapFills, filledEventIds } = fillBannerGaps(
      banners,
      laneCountByDateKey,
      AUGUST_2026_GRID,
      singleDayEventsByDateKey
    );

    expect(gapFills).toHaveLength(1);
    expect(gapFills[0]).toMatchObject({ event: first, lane: 0 });
    expect(filledEventIds.has("single-1")).toBe(true);
    expect(filledEventIds.has("single-2")).toBe(false);
  });
});
