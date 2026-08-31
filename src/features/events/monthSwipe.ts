const SWIPE_DISTANCE_THRESHOLD = 50;

/**
 * Decides whether a completed pan gesture should navigate the calendar to
 * the next/previous month. Returns 1 (next month), -1 (previous month), or
 * null when the gesture wasn't a clear enough horizontal swipe.
 */
export function resolveMonthSwipeDirection(dx: number, dy: number): 1 | -1 | null {
  if (Math.abs(dx) < SWIPE_DISTANCE_THRESHOLD) {
    return null;
  }
  if (Math.abs(dy) > Math.abs(dx)) {
    return null;
  }
  return dx < 0 ? 1 : -1;
}
