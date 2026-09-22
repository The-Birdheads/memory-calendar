import { normalizeUrl } from "../url";

describe("normalizeUrl", () => {
  it("leaves a URL with an https scheme unchanged", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("leaves a URL with an http scheme unchanged", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("leaves a URL with a non-http scheme unchanged (e.g. mailto:)", () => {
    expect(normalizeUrl("mailto:foo@example.com")).toBe("mailto:foo@example.com");
  });

  it("prepends https:// to a bare domain with no scheme", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("prepends https:// to a www-prefixed domain with no scheme", () => {
    expect(normalizeUrl("www.example.com/path?x=1")).toBe("https://www.example.com/path?x=1");
  });

  it("trims surrounding whitespace before checking/normalizing", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
  });
});
