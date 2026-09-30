import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, type PanResponderGestureState } from "react-native";

import { moveItem } from "./reorder";

/**
 * Drives a single reorderable list's drag-and-drop: touching a row's drag
 * handle and moving the finger up/down reflows the other rows live (via
 * `order`), while the dragged row itself follows the finger continuously
 * (via `dragY`, `draggingId`). Nothing is persisted here - the caller reads
 * `order` once the user confirms and turns it into sort_order updates
 * (see reorder.ts's sequentialSortOrders).
 *
 * Rows are assumed to all share one fixed `rowHeight` - exact per-row
 * measurement would need onLayout bookkeeping for every row, which isn't
 * worth it for the short, single-line lists this is used on.
 */
export function useDragReorder(ids: string[], rowHeight: number) {
  const [order, setOrder] = useState<string[]>(ids);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Animated.Value must stay one stable, mutable instance across renders
  // (that's how .setValue()/transforms avoid re-rendering on every touch
  // move) - useState's lazy initializer gives that without reading a ref
  // during render.
  const [dragY] = useState(() => new Animated.Value(0));
  const dragStartIndex = useRef(0);
  const orderRef = useRef(order);

  // Keeps orderRef in sync for the PanResponder callbacks below (which are
  // created once via useMemo and would otherwise close over a stale `order`)
  // - done in an effect, not inline during render, per the rules of hooks.
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  /** Re-seeds the working order from fresh data - call when entering reorder
   * mode (or when the underlying list changes) so a stale drag never lingers. */
  const reset = (nextIds: string[]) => {
    setOrder(nextIds);
    setDraggingId(null);
    dragY.setValue(0);
  };

  const panHandlersById = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof PanResponder.create>["panHandlers"]>();
    return {
      get(id: string) {
        const cached = cache.get(id);
        if (cached) return cached;

        const handleRelease = () => {
          setDraggingId(null);
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        };

        const responder = PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 2,
          onPanResponderGrant: () => {
            dragStartIndex.current = orderRef.current.indexOf(id);
            setDraggingId(id);
            dragY.setValue(0);
          },
          onPanResponderMove: (_evt, gesture: PanResponderGestureState) => {
            dragY.setValue(gesture.dy);
            const currentIndex = orderRef.current.indexOf(id);
            const targetIndex = dragStartIndex.current + Math.round(gesture.dy / rowHeight);
            if (targetIndex !== currentIndex) {
              setOrder((prev) => moveItem(prev, id, targetIndex));
            }
          },
          onPanResponderRelease: handleRelease,
          onPanResponderTerminate: handleRelease,
        }).panHandlers;

        cache.set(id, responder);
        return responder;
      },
    };
  }, [rowHeight, dragY]);

  return { order, draggingId, dragY, panHandlersFor: panHandlersById.get, reset };
}
