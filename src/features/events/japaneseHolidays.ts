function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const firstOffset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + firstOffset + (n - 1) * 7;
  return new Date(Date.UTC(year, month, day));
}

// Standard approximation formula for the equinox days, valid for 1980-2099.
function vernalEquinoxDate(year: number): Date {
  const day = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return new Date(Date.UTC(year, 2, day));
}

function autumnalEquinoxDate(year: number): Date {
  const day = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  return new Date(Date.UTC(year, 8, day));
}

/**
 * The fixed-rule national holidays (国民の祝日) for a given year, per the
 * standard JIS rules currently in effect. Does not model the one-off
 * 2020/2021 Olympic-related date shifts.
 */
function baseHolidays(year: number): { date: Date; name: string }[] {
  const holidays = [
    { date: new Date(Date.UTC(year, 0, 1)), name: "元日" },
    { date: nthWeekdayOfMonth(year, 0, 1, 2), name: "成人の日" },
    { date: new Date(Date.UTC(year, 1, 11)), name: "建国記念の日" },
    { date: vernalEquinoxDate(year), name: "春分の日" },
    { date: new Date(Date.UTC(year, 3, 29)), name: "昭和の日" },
    { date: new Date(Date.UTC(year, 4, 3)), name: "憲法記念日" },
    { date: new Date(Date.UTC(year, 4, 4)), name: "みどりの日" },
    { date: new Date(Date.UTC(year, 4, 5)), name: "こどもの日" },
    { date: nthWeekdayOfMonth(year, 6, 1, 3), name: "海の日" },
    { date: new Date(Date.UTC(year, 7, 11)), name: "山の日" },
    { date: nthWeekdayOfMonth(year, 8, 1, 3), name: "敬老の日" },
    { date: autumnalEquinoxDate(year), name: "秋分の日" },
    { date: nthWeekdayOfMonth(year, 9, 1, 2), name: "スポーツの日" },
    { date: new Date(Date.UTC(year, 10, 3)), name: "文化の日" },
    { date: new Date(Date.UTC(year, 10, 23)), name: "勤労感謝の日" },
  ];
  if (year >= 2020) {
    holidays.push({ date: new Date(Date.UTC(year, 1, 23)), name: "天皇誕生日" });
  }
  return holidays;
}

/**
 * Builds the full holiday map for a year, including 振替休日 (a holiday that
 * falls on Sunday moves to the next non-holiday day) and 国民の休日 (a
 * non-holiday day sandwiched between two holidays becomes a holiday too).
 * Includes the surrounding years so substitute holidays near a year
 * boundary resolve correctly.
 */
function buildHolidayMapForYear(year: number): Map<string, string> {
  const all = [year - 1, year, year + 1].flatMap((y) => baseHolidays(y));

  const map = new Map<string, string>();
  for (const holiday of all) {
    map.set(toDateKey(holiday.date), holiday.name);
  }

  for (const holiday of all) {
    if (holiday.date.getUTCDay() === 0) {
      const substitute = new Date(holiday.date);
      do {
        substitute.setUTCDate(substitute.getUTCDate() + 1);
      } while (map.has(toDateKey(substitute)));
      map.set(toDateKey(substitute), "振替休日");
    }
  }

  for (const key of Array.from(map.keys())) {
    const date = new Date(`${key}T00:00:00.000Z`);
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);
    const nextKey = toDateKey(next);
    if (map.has(nextKey)) continue;
    const dayAfterNext = new Date(next);
    dayAfterNext.setUTCDate(dayAfterNext.getUTCDate() + 1);
    if (map.has(toDateKey(dayAfterNext))) {
      map.set(nextKey, "国民の休日");
    }
  }

  return map;
}

const holidayCacheByYear = new Map<number, Map<string, string>>();

function getHolidayMapForYear(year: number): Map<string, string> {
  let cached = holidayCacheByYear.get(year);
  if (!cached) {
    cached = buildHolidayMapForYear(year);
    holidayCacheByYear.set(year, cached);
  }
  return cached;
}

/** Returns the holiday name for a "YYYY-MM-DD" date key, or null if it isn't a holiday. */
export function getJapaneseHolidayName(dateKey: string): string | null {
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  return getHolidayMapForYear(year).get(dateKey) ?? null;
}

/** Returns whether a "YYYY-MM-DD" date key is a Japanese national holiday. */
export function isJapaneseHoliday(dateKey: string): boolean {
  return getJapaneseHolidayName(dateKey) !== null;
}
