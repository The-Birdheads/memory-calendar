import { resolveMonthSwipeDirection } from "../monthSwipe";

describe("resolveMonthSwipeDirection", () => {
  it("returns 1 (next month) for a clear leftward swipe", () => {
    expect(resolveMonthSwipeDirection(-80, 0)).toBe(1);
  });

  it("returns -1 (previous month) for a clear rightward swipe", () => {
    expect(resolveMonthSwipeDirection(80, 0)).toBe(-1);
  });

  it("returns null when the swipe distance is below the threshold", () => {
    expect(resolveMonthSwipeDirection(20, 0)).toBeNull();
  });

  it("returns null when the gesture is more vertical than horizontal", () => {
    expect(resolveMonthSwipeDirection(60, 90)).toBeNull();
  });

  it("returns null for no movement", () => {
    expect(resolveMonthSwipeDirection(0, 0)).toBeNull();
  });
});
