import { flattenVisibleTagTree, getAncestorChainIds } from "../tagTree";

const TREE = [
  {
    id: "major-1",
    calendarId: "cal-1",
    parentId: null,
    level: "major" as const,
    name: "旅行",
    color: "#ff0000",
    createdAt: "2026-08-01T00:00:00.000Z",
    children: [
      {
        id: "mid-1",
        calendarId: "cal-1",
        parentId: "major-1",
        level: "mid" as const,
        name: "国内",
        color: "#ff8888",
        createdAt: "2026-08-01T00:00:00.000Z",
        children: [
          {
            id: "minor-1",
            calendarId: "cal-1",
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
    calendarId: "cal-1",
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
  { id: "major-1", calendarId: "cal-1", parentId: null, level: "major" as const, name: "旅行", color: "#ff0000", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "mid-1", calendarId: "cal-1", parentId: "major-1", level: "mid" as const, name: "国内", color: "#ff8888", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "minor-1", calendarId: "cal-1", parentId: "mid-1", level: "minor" as const, name: "温泉", color: "#ffcccc", createdAt: "2026-08-01T00:00:00.000Z" },
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
