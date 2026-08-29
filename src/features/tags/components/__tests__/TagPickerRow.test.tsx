import { fireEvent, render } from "@testing-library/react-native";

import { TagPickerRow } from "../TagPickerRow";

const TAGS = [
  { id: "tag-a", calendarId: "cal-1", parentId: null, level: "major" as const, name: "旅行", color: "#ff0000", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "tag-b", calendarId: "cal-1", parentId: null, level: "major" as const, name: "仕事", color: "#00ff00", createdAt: "2026-08-01T00:00:00.000Z" },
];

describe("TagPickerRow", () => {
  it("renders nothing when there are no available tags", async () => {
    const { queryByText } = await render(
      <TagPickerRow testIDPrefix="event-create" availableTags={[]} selectedTagIds={[]} onToggle={jest.fn()} />
    );

    expect(queryByText("タグ")).toBeNull();
  });

  it("renders a chip for each available tag, using the given testID prefix", async () => {
    const { getByTestId } = await render(
      <TagPickerRow testIDPrefix="event-edit" availableTags={TAGS} selectedTagIds={[]} onToggle={jest.fn()} />
    );

    expect(getByTestId("event-edit-tag-tag-a")).toBeTruthy();
    expect(getByTestId("event-edit-tag-tag-b")).toBeTruthy();
  });

  it("calls onToggle with the tag id when a chip is pressed", async () => {
    const onToggle = jest.fn();
    const { getByTestId } = await render(
      <TagPickerRow testIDPrefix="event-create" availableTags={TAGS} selectedTagIds={[]} onToggle={onToggle} />
    );

    await fireEvent.press(getByTestId("event-create-tag-tag-a"));

    expect(onToggle).toHaveBeenCalledWith("tag-a");
  });
});
