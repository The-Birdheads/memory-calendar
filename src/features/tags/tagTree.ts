import type { Tag, TagTreeNode } from "./types";

/** Flattens a tag tree into a flat list of every tag (major/mid/minor alike),
 * in depth-first order - used wherever code needs "all of the caller's tags"
 * rather than the nested tree shape (parent lookups, color-collision checks,
 * etc.). */
export function flattenTagTree(nodes: TagTreeNode[]): Tag[] {
  return nodes.flatMap((node) => [node, ...flattenTagTree(node.children)]);
}

/**
 * Flattens a tag tree into a display list where a node's children are only
 * included when the node itself is "expanded" (its id is in `expandedIds`).
 * Top-level (major) nodes are always included. Used to drill down through
 * 大分類 → 中分類 → 小分類 one level at a time instead of showing every tag
 * flat at once.
 */
export function flattenVisibleTagTree(nodes: TagTreeNode[], expandedIds: Set<string> | string[]): TagTreeNode[] {
  const expanded = expandedIds instanceof Set ? expandedIds : new Set(expandedIds);
  const result: TagTreeNode[] = [];

  const walk = (list: TagTreeNode[]) => {
    for (const node of list) {
      result.push(node);
      if (expanded.has(node.id)) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return result;
}

/** Returns [tagId, ...its ancestors' ids] by walking parentId pointers, or [] if tagId is not found. */
export function getAncestorChainIds(tagId: string | undefined, allTags: Tag[]): string[] {
  const chain: string[] = [];
  let current = allTags.find((tag) => tag.id === tagId);

  while (current) {
    chain.push(current.id);
    const parentId: string | null = current.parentId;
    current = parentId ? allTags.find((tag) => tag.id === parentId) : undefined;
  }

  return chain;
}
