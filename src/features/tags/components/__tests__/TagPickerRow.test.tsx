import { fireEvent, render } from "@testing-library/react-native";

import { TagPickerRow } from "../TagPickerRow";

const TREE = [
  {
    id: "tag-a",
    calendarId: "cal-1",
    parentId: null,
    level: "major" as const,
    name: "旅行",
    color: "#ff0000",
    createdAt: "2026-08-01T00:00:00.000Z",
    children: [
      {
        id: "tag-a1",
        calendarId: "cal-1",
        parentId: "tag-a",
        level: "mid" as const,
        name: "国内",
        color: "#ff8888",
        createdAt: "2026-08-01T00:00:00.000Z",
        children: [],
      },
    ],
  },
  {
    id: "tag-b",
    calendarId: "cal-1",
    parentId: null,
    level: "major" as const,
    name: "仕事",
    color: "#00ff00",
    createdAt: "2026-08-01T00:00:00.000Z",
    children: [],
  },
];

describe("TagPickerRow", () => {
  it("renders nothing when the tag tree is empty", async () => {
    const { queryByText } = await render(
      <TagPickerRow testIDPrefix="event-create" tagTree={[]} selectedTagIds={[]} onToggle={jest.fn()} />
    );

    expect(queryByText("タグ")).toBeNull();
  });

  it("shows only top-level (major) tags at first, using the given testID prefix", async () => {
    const { getByTestId, queryByTestId } = await render(
      <TagPickerRow testIDPrefix="event-edit" tagTree={TREE} selectedTagIds={[]} onToggle={jest.fn()} />
    );

    expect(getByTestId("event-edit-tag-tag-a")).toBeTruthy();
    expect(getByTestId("event-edit-tag-tag-b")).toBeTruthy();
    expect(queryByTestId("event-edit-tag-tag-a1")).toBeNull();
  });

  it("reveals a tag's children once it is selected", async () => {
    const { getByTestId } = await render(
      <TagPickerRow testIDPrefix="event-create" tagTree={TREE} selectedTagIds={["tag-a"]} onToggle={jest.fn()} />
    );

    expect(getByTestId("event-create-tag-tag-a1")).toBeTruthy();
  });

  it("calls onToggle with the tag id when a chip is pressed", async () => {
    const onToggle = jest.fn();
    const { getByTestId } = await render(
      <TagPickerRow testIDPrefix="event-create" tagTree={TREE} selectedTagIds={[]} onToggle={onToggle} />
    );

    await fireEvent.press(getByTestId("event-create-tag-tag-a"));

    expect(onToggle).toHaveBeenCalledWith("tag-a");
  });

  it("shows its own 「タグ」 label by default", async () => {
    const { getByText } = await render(
      <TagPickerRow testIDPrefix="event-create" tagTree={TREE} selectedTagIds={[]} onToggle={jest.fn()} />
    );

    expect(getByText("タグ")).toBeTruthy();
  });

  it("omits its own 「タグ」 label when hideLabel is set, for embedding under a caller-supplied heading", async () => {
    const { queryByText, getByTestId } = await render(
      <TagPickerRow testIDPrefix="event-create" tagTree={TREE} selectedTagIds={[]} onToggle={jest.fn()} hideLabel />
    );

    expect(queryByText("タグ")).toBeNull();
    expect(getByTestId("event-create-tag-tag-a")).toBeTruthy();
  });
});
