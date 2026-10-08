import { chunk, IN_QUERY_CHUNK_SIZE } from "../chunk";

describe("chunk", () => {
  it("returns no chunks for an empty list", () => {
    expect(chunk([])).toEqual([]);
  });

  it("splits a list into chunks of the given size, keeping order and a shorter last chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("keeps a list that fits in one chunk as a single chunk", () => {
    expect(chunk(["a", "b"], 10)).toEqual([["a", "b"]]);
  });

  it("defaults to a size small enough to keep an .in() query URL short (<= 100 ids)", () => {
    expect(IN_QUERY_CHUNK_SIZE).toBeLessThanOrEqual(100);
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const chunks = chunk(ids);
    expect(chunks.every((c) => c.length <= IN_QUERY_CHUNK_SIZE)).toBe(true);
    expect(chunks.flat()).toEqual(ids);
  });
});
