import { fireEvent, render } from "@testing-library/react-native";

import { EditTagForm } from "../EditTagForm";

const MAJOR_TAG = {
  id: "tag-1",
  calendarId: "cal-1",
  parentId: null,
  level: "major" as const,
  name: "行事",
  color: "#ff0000",
  createdAt: "2026-08-18T00:00:00.000Z",
};

const OTHER_MAJOR_TAG = {
  id: "tag-2",
  calendarId: "cal-1",
  parentId: null,
  level: "major" as const,
  name: "外出",
  color: "#00ff00",
  createdAt: "2026-08-18T00:01:00.000Z",
};

describe("EditTagForm", () => {
  it("pre-fills the form with the tag's current name and color", async () => {
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} onSave={jest.fn()} />
    );

    expect(getByTestId("edit-tag-name-input").props.value).toBe("行事");
    expect(getByTestId("edit-tag-color-input").props.value).toBe("#ff0000");
  });

  it("saves the edited name and color, keeping the level and parent unchanged", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} onSave={onSave} />
    );

    await fireEvent.changeText(getByTestId("edit-tag-name-input"), "行楽");
    await fireEvent.changeText(getByTestId("edit-tag-color-input"), "#123456");
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行楽",
      color: "#123456",
      level: "major",
      parentId: null,
    });
  });

  it("shows eligible parent options for the newly selected level and saves the chosen parent", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, OTHER_MAJOR_TAG]} onSave={onSave} />
    );

    await fireEvent.press(getByTestId("edit-tag-level-mid"));

    expect(getByTestId("edit-tag-parent-tag-2")).toBeTruthy();

    await fireEvent.press(getByTestId("edit-tag-parent-tag-2"));
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行事",
      color: "#ff0000",
      level: "mid",
      parentId: "tag-2",
    });
  });

  it("excludes the tag itself from its own eligible parent options", async () => {
    const midTag = { ...MAJOR_TAG, id: "tag-3", level: "mid" as const, parentId: "tag-1" };
    const { queryByTestId } = await render(
      <EditTagForm tag={midTag} allTags={[MAJOR_TAG, midTag]} onSave={jest.fn()} />
    );

    await fireEvent.press(queryByTestId("edit-tag-level-mid")!);

    expect(queryByTestId("edit-tag-parent-tag-3")).toBeNull();
  });
});
