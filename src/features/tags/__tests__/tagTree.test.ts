import { flattenTagTree, flattenVisibleTagTree, getAncestorChainIds, sortTagsHierarchically } from "../tagTree";

const TREE = [
  {
    id: "major-1",
    parentId: null,
    level: "major" as const,
    name: "旅行",
    color: "#ff0000",
    createdAt: "2026-08-01T00:00:00.000Z",
    children: [
      {
        id: "mid-1",
        parentId: "major-1",
        level: "mid" as const,
        name: "国内",
        color: "#ff8888",
        createdAt: "2026-08-01T00:00:00.000Z",
        children: [
          {
            id: "minor-1",
            parentId: "mid-1",
            level: "minor" as const,
            name: "温泉",
            color: "#ffcccc",
            createdAt: "2026-08-01T00:00:00.000Z",
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "major-2",
    parentId: null,
    level: "major" as const,
    name: "仕事",
    color: "#00ff00",
    createdAt: "2026-08-01T00:00:00.000Z",
    children: [],
  },
];

describe("flattenVisibleTagTree", () => {
  it("shows only top-level nodes when nothing is expanded", () => {
    const result = flattenVisibleTagTree(TREE, []);

    expect(result.map((node) => node.id)).toEqual(["major-1", "major-2"]);
  });

  it("shows a node's children once the node itself is expanded", () => {
    const result = flattenVisibleTagTree(TREE, ["major-1"]);

    expect(result.map((node) => node.id)).toEqual(["major-1", "mid-1", "major-2"]);
  });

  it("drills down multiple levels when each ancestor is expanded", () => {
    const result = flattenVisibleTagTree(TREE, ["major-1", "mid-1"]);

    expect(result.map((node) => node.id)).toEqual(["major-1", "mid-1", "minor-1", "major-2"]);
  });

  it("does not show a node's children when only a sibling is expanded", () => {
    const result = flattenVisibleTagTree(TREE, ["major-2"]);

    expect(result.map((node) => node.id)).toEqual(["major-1", "major-2"]);
  });
});

const FLAT_TAGS = [
  { id: "major-1", parentId: null, level: "major" as const, name: "旅行", color: "#ff0000", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "mid-1", parentId: "major-1", level: "mid" as const, name: "国内", color: "#ff8888", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "minor-1", parentId: "mid-1", level: "minor" as const, name: "温泉", color: "#ffcccc", createdAt: "2026-08-01T00:00:00.000Z" },
];

describe("getAncestorChainIds", () => {
  it("returns the tag id plus every ancestor up to the root", () => {
    expect(getAncestorChainIds("minor-1", FLAT_TAGS)).toEqual(["minor-1", "mid-1", "major-1"]);
  });

  it("returns just the tag id for a top-level tag", () => {
    expect(getAncestorChainIds("major-1", FLAT_TAGS)).toEqual(["major-1"]);
  });

  it("returns an empty array when the tag id is not found", () => {
    expect(getAncestorChainIds("missing", FLAT_TAGS)).toEqual([]);
  });

  it("returns an empty array when the tag id is undefined", () => {
    expect(getAncestorChainIds(undefined, FLAT_TAGS)).toEqual([]);
  });
});

// 大分類A → 中分類A-1 → 小分類A-1-a → 小分類A-1-b → 中分類A-2 → 大分類B
const ORDERING_TREE = [
  {
    id: "major-a",
    parentId: null,
    level: "major" as const,
    name: "A",
    color: "#ff0000",
    createdAt: "2026-08-01T00:00:00.000Z",
    children: [
      {
        id: "mid-a1",
        parentId: "major-a",
        level: "mid" as const,
        name: "A-1",
        color: "#ff8888",
        createdAt: "2026-08-01T00:00:00.000Z",
        children: [
          {
            id: "minor-a1a",
            parentId: "mid-a1",
            level: "minor" as const,
            name: "A-1-a",
            color: "#ffcccc",
            createdAt: "2026-08-01T00:00:00.000Z",
            children: [],
          },
          {
            id: "minor-a1b",
            parentId: "mid-a1",
            level: "minor" as const,
            name: "A-1-b",
            color: "#ffcccc",
            createdAt: "2026-08-01T00:00:00.000Z",
            children: [],
          },
        ],
      },
      {
        id: "mid-a2",
        parentId: "major-a",
        level: "mid" as const,
        name: "A-2",
        color: "#ff8888",
        createdAt: "2026-08-01T00:00:00.000Z",
        children: [],
      },
    ],
  },
  {
    id: "major-b",
    parentId: null,
    level: "major" as const,
    name: "B",
    color: "#00ff00",
    createdAt: "2026-08-01T00:00:00.000Z",
    children: [],
  },
];

describe("flattenTagTree", () => {
  it("flattens depth-first: a node, then all of its descendants, before moving to the next sibling", () => {
    const result = flattenTagTree(ORDERING_TREE);

    expect(result.map((tag) => tag.id)).toEqual([
      "major-a",
      "mid-a1",
      "minor-a1a",
      "minor-a1b",
      "mid-a2",
      "major-b",
    ]);
  });
});

describe("sortTagsHierarchically", () => {
  const allTagsFlat = flattenTagTree(ORDERING_TREE);

  it("reorders an arbitrarily-ordered subset of tags into the canonical 大分類→中分類→小分類 depth-first order", () => {
    const shuffled = allTagsFlat.filter((tag) =>
      ["minor-a1b", "major-b", "mid-a1", "major-a"].includes(tag.id)
    );
    // Deliberately not already in the canonical order.
    const reversed = [...shuffled].reverse();

    const sorted = sortTagsHierarchically(reversed, allTagsFlat);

    expect(sorted.map((tag) => tag.id)).toEqual(["major-a", "mid-a1", "minor-a1b", "major-b"]);
  });

  it("does not mutate the input array", () => {
    const input = [allTagsFlat[5], allTagsFlat[0]];
    const copy = [...input];

    sortTagsHierarchically(input, allTagsFlat);

    expect(input).toEqual(copy);
  });
});
