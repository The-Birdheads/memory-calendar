import { photoAdAfterCardIndexes } from "../photoGridAds";

// 1行に2枚(カード)並ぶ写真の一覧で、10行ごと(=20枚ごと、月をまたいで数える)に広告を入れる位置。
describe("photoAdAfterCardIndexes", () => {
  it("puts a banner after every 10th row, counting rows across the months", () => {
    // 月A: 24枚(12行)、月B: 24枚(12行)
    const result = photoAdAfterCardIndexes([
      { key: "2026-09", cardCount: 24 },
      { key: "2026-08", cardCount: 24 },
    ]);

    // 全体の10行目 = 月Aの10行目(19枚目=インデックス19の後)、20行目 = 月Bの8行目(インデックス15の後)
    expect(Array.from(result.get("2026-09") ?? [])).toEqual([19]);
    expect(Array.from(result.get("2026-08") ?? [])).toEqual([15]);
  });

  it("puts no banner when there are fewer than 10 rows in total", () => {
    const result = photoAdAfterCardIndexes([
      { key: "a", cardCount: 8 },
      { key: "b", cardCount: 9 },
    ]);

    expect(Array.from(result.get("a") ?? [])).toEqual([]);
    expect(Array.from(result.get("b") ?? [])).toEqual([]);
  });

  it("counts a half-filled last row of a month as a row", () => {
    // 月A: 5枚(3行) 月B: 15枚(8行)... 合計11行 -> 10行目は月Bの7行目(インデックス13の後)
    const result = photoAdAfterCardIndexes([
      { key: "a", cardCount: 5 },
      { key: "b", cardCount: 15 },
    ]);

    expect(Array.from(result.get("a") ?? [])).toEqual([]);
    expect(Array.from(result.get("b") ?? [])).toEqual([13]);
  });

  it("puts the banner after the last row of a month when the 10th row ends it (and more months follow)", () => {
    const result = photoAdAfterCardIndexes([
      { key: "a", cardCount: 20 },
      { key: "b", cardCount: 4 },
    ]);

    expect(Array.from(result.get("a") ?? [])).toEqual([19]);
  });

  it("never puts a banner after the very last row (nothing follows it)", () => {
    const result = photoAdAfterCardIndexes([{ key: "a", cardCount: 20 }]);

    expect(Array.from(result.get("a") ?? [])).toEqual([]);
  });

  it("handles an empty list", () => {
    expect(photoAdAfterCardIndexes([]).size).toBe(0);
  });
});
