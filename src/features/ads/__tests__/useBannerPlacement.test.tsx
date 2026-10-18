import { act, renderHook } from "@testing-library/react-native";

import { useBannerPlacement } from "../useBannerPlacement";

const layoutEvent = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } }) as never;

describe("useBannerPlacement", () => {
  it("has no banner slots until the viewport and item heights are measured", async () => {
    const { result } = await renderHook(() => useBannerPlacement(12, 3));

    expect(result.current.afterIndexes.size).toBe(0);
  });

  it("computes the slots from the measured viewport and item heights", async () => {
    const { result } = await renderHook(() => useBannerPlacement(12, 3));

    await act(async () => {
      result.current.onViewportLayout(layoutEvent(600));
      for (let index = 0; index < 12; index += 1) {
        result.current.onItemLayout(index)(layoutEvent(100));
      }
    });

    expect(Array.from(result.current.afterIndexes)).toEqual([5, 8]);
  });

  it("ignores tiny height changes so layout updates cannot loop", async () => {
    const { result } = await renderHook(() => useBannerPlacement(3, 3));
    await act(async () => {
      result.current.onItemLayout(0)(layoutEvent(100));
    });
    const before = result.current.onItemLayout;

    await act(async () => {
      result.current.onItemLayout(0)(layoutEvent(100.2));
    });

    expect(result.current.onItemLayout).toBe(before);
  });

  it("forgets measurements when the list shrinks (e.g. after a filter)", async () => {
    const { result, rerender } = await renderHook(({ count }: { count: number }) => useBannerPlacement(count, 3), {
      initialProps: { count: 12 },
    });
    await act(async () => {
      result.current.onViewportLayout(layoutEvent(600));
      for (let index = 0; index < 12; index += 1) {
        result.current.onItemLayout(index)(layoutEvent(100));
      }
    });

    await rerender({ count: 4 });

    expect(Array.from(result.current.afterIndexes)).toEqual([]);
  });
});
