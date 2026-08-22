import { fireEvent, render } from "@testing-library/react-native";

import { TagTreeSection } from "../TagTreeSection";

const TREE = [
  {
    id: "tag-1",
    calendarId: "cal-1",
    parentId: null,
    level: "major" as const,
    name: "行事",
    color: "#ff0000",
    createdAt: "2026-08-18T00:00:00.000Z",
    children: [
      {
        id: "tag-2",
        calendarId: "cal-1",
        parentId: "tag-1",
        level: "mid" as const,
        name: "誕生日",
        color: "#00ff00",
        createdAt: "2026-08-18T00:01:00.000Z",
        children: [],
      },
    ],
  },
];

describe("TagTreeSection", () => {
  it("renders the tag tree including nested children", async () => {
    const { getByTestId, getByText } = await render(
      <TagTreeSection tagTree={TREE} onCreateTag={jest.fn()} />
    );

    expect(getByTestId("tag-item-tag-1")).toBeTruthy();
    expect(getByTestId("tag-item-tag-2")).toBeTruthy();
    expect(getByText("行事")).toBeTruthy();
    expect(getByText("誕生日")).toBeTruthy();
  });

  it("creates a major tag with the entered name and color by default", async () => {
    const onCreateTag = jest.fn();
    const { getByTestId } = await render(
      <TagTreeSection tagTree={[]} onCreateTag={onCreateTag} />
    );

    await fireEvent.changeText(getByTestId("tag-name-input"), "食事");
    await fireEvent.changeText(getByTestId("tag-color-input"), "#123456");
    await fireEvent.press(getByTestId("tag-create-submit"));

    expect(onCreateTag).toHaveBeenCalledWith({
      name: "食事",
      color: "#123456",
      level: "major",
      parentId: undefined,
    });
  });

  it("shows eligible parent tags and includes the selected parent when mid level is chosen", async () => {
    const onCreateTag = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <TagTreeSection tagTree={TREE} onCreateTag={onCreateTag} />
    );

    expect(queryByTestId("tag-parent-tag-1")).toBeNull();

    await fireEvent.press(getByTestId("tag-level-mid"));

    expect(getByTestId("tag-parent-tag-1")).toBeTruthy();
    expect(queryByTestId("tag-parent-tag-2")).toBeNull();

    await fireEvent.changeText(getByTestId("tag-name-input"), "旅行");
    await fireEvent.press(getByTestId("tag-parent-tag-1"));
    await fireEvent.press(getByTestId("tag-create-submit"));

    expect(onCreateTag).toHaveBeenCalledWith({
      name: "旅行",
      color: expect.any(String),
      level: "mid",
      parentId: "tag-1",
    });
  });

  it("immediately reflects a newly created tag when the tagTree prop updates", async () => {
    const { getByText, queryByText, rerender } = await render(
      <TagTreeSection tagTree={TREE} onCreateTag={jest.fn()} />
    );

    expect(queryByText("新しいタグ")).toBeNull();

    const updatedTree = [
      ...TREE,
      {
        id: "tag-3",
        calendarId: "cal-1",
        parentId: null,
        level: "major" as const,
        name: "新しいタグ",
        color: "#123456",
        createdAt: "2026-08-18T00:02:00.000Z",
        children: [],
      },
    ];
    await rerender(<TagTreeSection tagTree={updatedTree} onCreateTag={jest.fn()} />);

    expect(getByText("新しいタグ")).toBeTruthy();
  });
});
