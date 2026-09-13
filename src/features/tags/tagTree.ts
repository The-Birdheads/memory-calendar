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

/**
 * タグが表示される全ての箇所(予定のタグバッジ、予定詳細の現在のタグ一覧
 * など)で共通の並び順にするための並べ替え。渡された`tags`(何らかの予定に
 * 付いているタグの部分集合で、順序は不定)を、`allTagsFlat`
 * (`flattenTagTree(tagTree)`の depth-first 順 - 大分類A→中分類A-1→
 * 小分類A-1-a→小分類A-1-b→中分類A-2→大分類B)における位置を基準に
 * 並べ替える。`tags`自体は変更しない。
 */
export function sortTagsHierarchically<T extends Tag>(tags: T[], allTagsFlat: Tag[]): T[] {
  const orderIndex = new Map(allTagsFlat.map((tag, index) => [tag.id, index]));
  return [...tags].sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
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
