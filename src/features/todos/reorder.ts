/**
 * Pure helpers behind the ToDo reorder feature - kept free of
 * React/gesture code so they're easy to unit test. The button handling
 * itself (useSelectionReorder) just calls moveItem for each ↑/↓ press; on
 * confirm, the caller reassigns every row in the final order a fresh
 * sequential sort_order (see sequentialSortOrders) - lists here are short,
 * so writing every row is simpler and more robust than fractional-indexing
 * just the rows that moved.
 */

/** Moves the item with `id` to `targetIndex` in `order`, leaving everything
 * else in the same relative order. A no-op if `id` isn't found or the index
 * is already correct. */
export function moveItem(order: string[], id: string, targetIndex: number): string[] {
  const currentIndex = order.indexOf(id);
  if (currentIndex === -1) return order;

  const clampedTarget = Math.max(0, Math.min(order.length - 1, targetIndex));
  if (clampedTarget === currentIndex) return order;

  const next = [...order];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(clampedTarget, 0, moved);
  return next;
}

/** Assigns each id in `order` a fresh sequential sort_order (1, 2, 3, ...),
 * for persisting after a reorder is confirmed. */
export function sequentialSortOrders(order: string[]): { id: string; sortOrder: number }[] {
  return order.map((id, index) => ({ id, sortOrder: index + 1 }));
}
