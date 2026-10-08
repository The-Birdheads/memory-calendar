import { act, renderHook } from "@testing-library/react-native";

import { useSelectionReorder } from "../useSelectionReorder";

describe("useSelectionReorder", () => {
  it("starts with the given order and nothing selected", async () => {
    const { result } = await renderHook(() => useSelectionReorder(["a", "b", "c"]));

    expect(result.current.order).toEqual(["a", "b", "c"]);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.canMoveUp).toBe(false);
    expect(result.current.canMoveDown).toBe(false);
  });

  it("selects a row, and tapping the selected row again deselects it", async () => {
    const { result } = await renderHook(() => useSelectionReorder(["a", "b", "c"]));

    await act(async () => result.current.select("b"));
    expect(result.current.selectedId).toBe("b");

    await act(async () => result.current.select("b"));
    expect(result.current.selectedId).toBeNull();
  });

  it("moves the selected row up one place, keeping it selected so it can be moved again", async () => {
    const { result } = await renderHook(() => useSelectionReorder(["a", "b", "c"]));

    await act(async () => result.current.select("c"));
    await act(async () => result.current.moveSelectedUp());
    expect(result.current.order).toEqual(["a", "c", "b"]);
    expect(result.current.selectedId).toBe("c");

    await act(async () => result.current.moveSelectedUp());
    expect(result.current.order).toEqual(["c", "a", "b"]);
  });

  it("moves the selected row down one place", async () => {
    const { result } = await renderHook(() => useSelectionReorder(["a", "b", "c"]));

    await act(async () => result.current.select("a"));
    await act(async () => result.current.moveSelectedDown());

    expect(result.current.order).toEqual(["b", "a", "c"]);
  });

  it("reports canMoveUp/canMoveDown false at the ends of the list, and a move there is a no-op", async () => {
    const { result } = await renderHook(() => useSelectionReorder(["a", "b", "c"]));

    await act(async () => result.current.select("a"));
    expect(result.current.canMoveUp).toBe(false);
    expect(result.current.canMoveDown).toBe(true);
    await act(async () => result.current.moveSelectedUp());
    expect(result.current.order).toEqual(["a", "b", "c"]);

    await act(async () => result.current.select("a")); // deselect
    await act(async () => result.current.select("c"));
    expect(result.current.canMoveUp).toBe(true);
    expect(result.current.canMoveDown).toBe(false);
    await act(async () => result.current.moveSelectedDown());
    expect(result.current.order).toEqual(["a", "b", "c"]);
  });

  it("does nothing when moving with no row selected", async () => {
    const { result } = await renderHook(() => useSelectionReorder(["a", "b"]));

    await act(async () => result.current.moveSelectedDown());

    expect(result.current.order).toEqual(["a", "b"]);
  });

  it("reset re-seeds the order from fresh data and clears the selection", async () => {
    const { result } = await renderHook(() => useSelectionReorder(["a", "b", "c"]));
    await act(async () => result.current.select("a"));
    await act(async () => result.current.moveSelectedDown());

    await act(async () => result.current.reset(["x", "y"]));

    expect(result.current.order).toEqual(["x", "y"]);
    expect(result.current.selectedId).toBeNull();
  });
});
