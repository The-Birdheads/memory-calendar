export interface MonthGridCell {
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildMonthGrid(date: Date): MonthGridCell[][] {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));

  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const totalDaysBeforeRoundUp = Math.round(
    (lastOfMonth.getTime() - gridStart.getTime()) / (24 * 60 * 60 * 1000) + 1
  );
  const totalCells = Math.ceil(totalDaysBeforeRoundUp / 7) * 7;

  const cells: MonthGridCell[] = [];
  const cursor = new Date(gridStart);
  for (let i = 0; i < totalCells; i += 1) {
    cells.push({
      dateKey: toDateKey(cursor),
      day: cursor.getUTCDate(),
      isCurrentMonth: cursor.getUTCMonth() === month && cursor.getUTCFullYear() === year,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const weeks: MonthGridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}
