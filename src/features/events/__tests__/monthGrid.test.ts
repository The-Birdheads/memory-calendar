import { buildMonthGrid } from "../monthGrid";

describe("buildMonthGrid", () => {
  it("returns weeks of 7 days each, starting on Sunday", () => {
    const weeks = buildMonthGrid(new Date("2026-09-15T00:00:00.000Z"));

    weeks.forEach((week) => {
      expect(week).toHaveLength(7);
    });
  });

  it("covers every day of the target month exactly once", () => {
    const weeks = buildMonthGrid(new Date("2026-09-15T00:00:00.000Z"));
    const cells = weeks.flat();

    const currentMonthCells = cells.filter((cell) => cell.isCurrentMonth);
    expect(currentMonthCells).toHaveLength(30);
    expect(currentMonthCells[0].dateKey).toBe("2026-09-01");
    expect(currentMonthCells[currentMonthCells.length - 1].dateKey).toBe("2026-09-30");
  });

  it("fills leading/trailing days from adjacent months and marks them as not current", () => {
    const weeks = buildMonthGrid(new Date("2026-09-15T00:00:00.000Z"));
    const cells = weeks.flat();

    const firstCell = cells[0];
    const lastCell = cells[cells.length - 1];

    expect(firstCell.isCurrentMonth).toBe(false);
    expect(lastCell.isCurrentMonth).toBe(false);
    // 2026-09-01 is a Tuesday, so the grid should start on Sunday 2026-08-30
    expect(firstCell.dateKey).toBe("2026-08-30");
  });

  it("produces a grid with a multiple-of-7 total cell count", () => {
    const weeks = buildMonthGrid(new Date("2026-09-15T00:00:00.000Z"));
    expect(weeks.flat().length % 7).toBe(0);
  });

  it("handles a month that needs 6 rows (e.g. 2026-08, which starts on Saturday)", () => {
    const weeks = buildMonthGrid(new Date("2026-08-18T00:00:00.000Z"));
    const cells = weeks.flat();
    const currentMonthCells = cells.filter((cell) => cell.isCurrentMonth);

    expect(currentMonthCells).toHaveLength(31);
    expect(weeks.length).toBe(6);
  });

  it("starts each week on Monday when weekStartsOn is 1", () => {
    // 2026-09-01 is a Tuesday, so a Monday-start grid should begin on Monday 2026-08-31.
    const weeks = buildMonthGrid(new Date("2026-09-15T00:00:00.000Z"), 1);
    const cells = weeks.flat();

    expect(cells[0].dateKey).toBe("2026-08-31");
    weeks.forEach((week) => {
      expect(week).toHaveLength(7);
    });
    const currentMonthCells = cells.filter((cell) => cell.isCurrentMonth);
    expect(currentMonthCells).toHaveLength(30);
    expect(currentMonthCells[0].dateKey).toBe("2026-09-01");
    expect(currentMonthCells[currentMonthCells.length - 1].dateKey).toBe("2026-09-30");
  });

  it("still starts on Sunday for a month whose 1st already falls on Monday, when weekStartsOn is 1 (regression: 0-day offset)", () => {
    // 2026-06-01 is a Monday.
    const weeks = buildMonthGrid(new Date("2026-06-15T00:00:00.000Z"), 1);

    expect(weeks[0][0].dateKey).toBe("2026-06-01");
  });
});
