import { moveItem, sequentialSortOrders } from "../reorder";

describe("moveItem", () => {
  it("moves an item earlier in the list", () => {
    expect(moveItem(["a", "b", "c", "d"], "c", 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("moves an item later in the list", () => {
    expect(moveItem(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("clamps the target index to the list bounds", () => {
    expect(moveItem(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], "c", -5)).toEqual(["c", "a", "b"]);
  });

  it("is a no-op when the target index equals the current index", () => {
    const order = ["a", "b", "c"];
    expect(moveItem(order, "b", 1)).toBe(order);
  });

  it("is a no-op when the id isn't in the list", () => {
    const order = ["a", "b", "c"];
    expect(moveItem(order, "missing", 0)).toBe(order);
  });
});

describe("sequentialSortOrders", () => {
  it("assigns 1, 2, 3... in the given order", () => {
    expect(sequentialSortOrders(["c", "a", "b"])).toEqual([
      { id: "c", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
      { id: "b", sortOrder: 3 },
    ]);
  });

  it("returns an empty array for an empty list", () => {
    expect(sequentialSortOrders([])).toEqual([]);
  });
});
