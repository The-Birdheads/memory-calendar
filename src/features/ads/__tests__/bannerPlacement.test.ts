import { computeBannerAfterIndexes, withBannerSlots } from "../bannerPlacement";

const heights = (count: number, each: number) => Array.from({ length: count }, () => each);

describe("computeBannerAfterIndexes", () => {
  it("puts a banner after every Nth item once the content is past the first screen", () => {
    // 1画面(600)に収まらない: 1件100、3件ごと。3件目の下は300(1画面の中)、6件目の下は600(1画面の下端)
    expect(computeBannerAfterIndexes({ itemHeights: heights(12, 100), interval: 3, viewportHeight: 600 })).toEqual([
      5, 8,
    ]);
  });

  it("never puts a banner inside the first screen, even when the interval would place one there", () => {
    expect(computeBannerAfterIndexes({ itemHeights: heights(12, 100), interval: 2, viewportHeight: 600 })).toEqual([
      5, 7, 9,
    ]);
  });

  it("puts no banner when everything fits on the first screen", () => {
    expect(computeBannerAfterIndexes({ itemHeights: heights(5, 100), interval: 2, viewportHeight: 1000 })).toEqual([]);
  });

  it("puts no banner when the viewport height is not measured yet", () => {
    expect(computeBannerAfterIndexes({ itemHeights: heights(12, 100), interval: 3, viewportHeight: null })).toEqual([]);
  });

  it("does not put a banner after the last item (nothing follows it)", () => {
    expect(computeBannerAfterIndexes({ itemHeights: heights(3, 400), interval: 3, viewportHeight: 600 })).toEqual([]);
    expect(computeBannerAfterIndexes({ itemHeights: heights(6, 400), interval: 3, viewportHeight: 600 })).toEqual([2]);
  });

  it("uses the average of the measured heights for items not measured yet", () => {
    // 先頭の3件だけ測れている(各200)。残りは平均の200として扱う。
    const itemHeights = [200, 200, 200, undefined, undefined, undefined, undefined, undefined];
    expect(computeBannerAfterIndexes({ itemHeights, interval: 3, viewportHeight: 500 })).toEqual([2, 5]);
  });

  it("falls back to the given height when nothing is measured yet", () => {
    const itemHeights = Array.from({ length: 9 }, () => undefined);
    expect(
      computeBannerAfterIndexes({ itemHeights, interval: 3, viewportHeight: 500, fallbackHeight: 100 })
    ).toEqual([5]);
  });

  it("puts a banner after every item when the interval is 1 (past the first screen)", () => {
    expect(computeBannerAfterIndexes({ itemHeights: heights(6, 300), interval: 1, viewportHeight: 500 })).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(computeBannerAfterIndexes({ itemHeights: [], interval: 3, viewportHeight: 600 })).toEqual([]);
  });
});

describe("withBannerSlots", () => {
  it("interleaves banner slots after the given item indexes", () => {
    const result = withBannerSlots(["a", "b", "c", "d"], new Set([1, 2]));

    expect(result).toEqual([
      { kind: "item", item: "a", index: 0 },
      { kind: "item", item: "b", index: 1 },
      { kind: "banner", key: "banner-after-1" },
      { kind: "item", item: "c", index: 2 },
      { kind: "banner", key: "banner-after-2" },
      { kind: "item", item: "d", index: 3 },
    ]);
  });

  it("returns just the items when there are no banner slots", () => {
    expect(withBannerSlots(["a", "b"], new Set())).toEqual([
      { kind: "item", item: "a", index: 0 },
      { kind: "item", item: "b", index: 1 },
    ]);
  });
});
