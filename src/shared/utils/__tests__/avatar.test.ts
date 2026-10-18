import { avatarColor, avatarInitial } from "../avatar";

describe("avatarInitial", () => {
  it("uses the first character of the display name", () => {
    expect(avatarInitial("山田太郎")).toBe("山");
  });

  it("upper-cases a latin initial", () => {
    expect(avatarInitial("alice")).toBe("A");
  });

  it("trims leading whitespace before taking the first character", () => {
    expect(avatarInitial("  taro")).toBe("T");
  });

  it("keeps an emoji (a surrogate pair) whole instead of splitting it", () => {
    expect(avatarInitial("🍎りんご")).toBe("🍎");
  });

  it("falls back to ? when the name is missing or blank", () => {
    expect(avatarInitial(null)).toBe("?");
    expect(avatarInitial("")).toBe("?");
    expect(avatarInitial("   ")).toBe("?");
  });
});

describe("avatarColor", () => {
  it("returns the same color for the same user id every time", () => {
    expect(avatarColor("user-1")).toBe(avatarColor("user-1"));
  });

  it("returns a hex color from the palette", () => {
    expect(avatarColor("user-1")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("spreads different users over more than one color", () => {
    const colors = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => avatarColor(id)));
    expect(colors.size).toBeGreaterThan(1);
  });
});
