function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Returns every "YYYY-MM-DD" date key an event touches, from its start date
 * through its end date inclusive, so a multi-day event can be shown on the
 * calendar for each day it spans instead of only its start date.
 */
export function expandEventDateKeys(startAt: string, endAt: string): string[] {
  const startKey = toDateKey(startAt);
  const endKey = toDateKey(endAt);

  if (endKey <= startKey) {
    return [startKey];
  }

  const keys: string[] = [];
  const cursor = new Date(`${startKey}T00:00:00.000Z`);
  const end = new Date(`${endKey}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKey(cursor.toISOString()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}
