import {
  CELL_BOTTOM_PADDING,
  CELL_TOP_AREA,
  EVENT_ROW_GAP,
  EVENT_ROW_HEIGHT,
  LANE_HEIGHT,
  computeCellEventCapacity,
  splitCellEvents,
} from "../monthCellCapacity";

// 行の高さ H のとき、予定を n 行並べるのに要る高さ。
function heightFor(rows: number, lanes = 0): number {
  return (
    CELL_TOP_AREA + lanes * LANE_HEIGHT + rows * EVENT_ROW_HEIGHT + (rows - 1) * EVENT_ROW_GAP + CELL_BOTTOM_PADDING
  );
}

describe("computeCellEventCapacity", () => {
  it("fits exactly the rows that fit in the cell below the date badge", () => {
    expect(computeCellEventCapacity(heightFor(4), 0)).toBe(4);
    expect(computeCellEventCapacity(heightFor(5), 0)).toBe(5);
  });

  it("does not count a row that would be cut off", () => {
    expect(computeCellEventCapacity(heightFor(4) + EVENT_ROW_HEIGHT, 0)).toBe(4);
    expect(computeCellEventCapacity(heightFor(4) - 1, 0)).toBe(3);
  });

  it("grows with a taller row (a month with fewer weeks gives each day more room)", () => {
    expect(computeCellEventCapacity(heightFor(6), 0)).toBeGreaterThan(computeCellEventCapacity(heightFor(4), 0));
  });

  it("loses a row for each multi-day banner lane running through the cell", () => {
    expect(computeCellEventCapacity(heightFor(5, 1), 1)).toBe(5);
    // バー1本(16)は予定1行(14+間隔1)より少し高いので、2本通ると予定は2行分少なくなる。
    expect(computeCellEventCapacity(heightFor(5, 1), 2)).toBe(3);
  });

  it("is never negative", () => {
    expect(computeCellEventCapacity(10, 0)).toBe(0);
    expect(computeCellEventCapacity(heightFor(2), 5)).toBe(0);
  });
});

describe("splitCellEvents", () => {
  const events = ["a", "b", "c", "d", "e", "f", "g"];

  it("shows every event when they all fit", () => {
    expect(splitCellEvents(events.slice(0, 4), heightFor(4), 0)).toEqual({
      visible: ["a", "b", "c", "d"],
      hiddenCount: 0,
    });
  });

  it("shows as many events as fit, using the last row for +N, when they don't all fit", () => {
    // 4行入る枠に7件: 3件 + 最後の行に「+4」
    expect(splitCellEvents(events, heightFor(4), 0)).toEqual({ visible: ["a", "b", "c"], hiddenCount: 4 });
  });

  it("shows only +N when a single row fits and there is more than one event", () => {
    expect(splitCellEvents(["a", "b"], heightFor(1), 0)).toEqual({ visible: [], hiddenCount: 2 });
  });

  it("shows the lone event when one row fits and there is only one", () => {
    expect(splitCellEvents(["a"], heightFor(1), 0)).toEqual({ visible: ["a"], hiddenCount: 0 });
  });

  it("shows only +N when no row fits at all", () => {
    expect(splitCellEvents(["a", "b"], 10, 0)).toEqual({ visible: [], hiddenCount: 2 });
  });

  it("adapts to a taller cell: the same 7 events show more of them", () => {
    expect(splitCellEvents(events, heightFor(6), 0)).toEqual({
      visible: ["a", "b", "c", "d", "e"],
      hiddenCount: 2,
    });
  });

  it("accounts for banner lanes taking space at the top of the cell", () => {
    expect(splitCellEvents(events, heightFor(4, 1), 1)).toEqual({ visible: ["a", "b", "c"], hiddenCount: 4 });
    expect(splitCellEvents(events, heightFor(4, 1), 2)).toEqual({ visible: ["a"], hiddenCount: 6 });
  });

  it("falls back to the old fixed limit of 3 (plus +N) until the row height is measured", () => {
    expect(splitCellEvents(events, null, 0)).toEqual({ visible: ["a", "b", "c"], hiddenCount: 4 });
    expect(splitCellEvents(events.slice(0, 3), null, 0)).toEqual({ visible: ["a", "b", "c"], hiddenCount: 0 });
  });

  it("has nothing hidden for a cell with no events", () => {
    expect(splitCellEvents([], heightFor(4), 0)).toEqual({ visible: [], hiddenCount: 0 });
  });
});
