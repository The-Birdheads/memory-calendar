import { lightenHexColor } from "../color";

describe("lightenHexColor", () => {
  it("blends the color toward white by the given fraction", () => {
    expect(lightenHexColor("#000000", 0.5)).toBe("#808080");
  });

  it("returns white unchanged", () => {
    expect(lightenHexColor("#ffffff", 0.5)).toBe("#ffffff");
  });

  it("returns the original color when amount is 0", () => {
    expect(lightenHexColor("#2f6fed", 0)).toBe("#2f6fed");
  });

  it("moves fully to white when amount is 1", () => {
    expect(lightenHexColor("#2f6fed", 1)).toBe("#ffffff");
  });
});
