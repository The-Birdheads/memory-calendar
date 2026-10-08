import { matchesKeyword } from "../keywordFilter";

describe("matchesKeyword", () => {
  it("matches everything when the keyword is empty or only whitespace", () => {
    expect(matchesKeyword("夏祭り", "")).toBe(true);
    expect(matchesKeyword("夏祭り", "   ")).toBe(true);
  });

  it("matches when the title contains the keyword", () => {
    expect(matchesKeyword("夏祭りに行く", "祭り")).toBe(true);
    expect(matchesKeyword("夏祭りに行く", "花火")).toBe(false);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(matchesKeyword("Team Meeting", "  meeting ")).toBe(true);
  });

  it("requires every space-separated word (half- or full-width space) to be contained, in any order", () => {
    expect(matchesKeyword("渋谷でランチ", "ランチ 渋谷")).toBe(true);
    expect(matchesKeyword("渋谷でランチ", "ランチ\u3000渋谷")).toBe(true);
    expect(matchesKeyword("渋谷でランチ", "ランチ 新宿")).toBe(false);
  });
});
