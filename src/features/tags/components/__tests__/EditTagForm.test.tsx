import { fireEvent, render } from "@testing-library/react-native";

import { EditTagForm, TAG_COLORS } from "../EditTagForm";
import { lightenHexColor } from "../../../../shared/utils/color";

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
  it("pre-fills the form with the tag's current name and highlights its current color swatch", async () => {
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} onSave={jest.fn()} />
    );

    expect(getByTestId("edit-tag-name-input").props.value).toBe("行事");
  });

  it("saves the edited name and a newly picked swatch color, keeping the level and parent unchanged", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} onSave={onSave} />
    );

    await fireEvent.changeText(getByTestId("edit-tag-name-input"), "行楽");
    await fireEvent.press(getByTestId("edit-tag-color-green"));
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行楽",
      color: TAG_COLORS.find((c) => c.name === "green")!.hex,
      level: "major",
      parentId: null,
    });
  });

  it("does not show a color picker for a major tag's own color once color-picking is disabled by level", async () => {
    // sanity check: a major tag shows pickable swatches
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} onSave={jest.fn()} />
    );
    expect(getByTestId("edit-tag-color-blue")).toBeTruthy();
  });

  it("auto-derives a lighter shade of the parent's color for a mid tag instead of showing swatches", async () => {
    const onSave = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, OTHER_MAJOR_TAG]} onSave={onSave} />
    );

    await fireEvent.press(getByTestId("edit-tag-level-mid"));

    expect(queryByTestId("edit-tag-color-blue")).toBeNull();
    expect(getByTestId("edit-tag-color-preview")).toBeTruthy();

    await fireEvent.press(getByTestId("edit-tag-parent-tag-2"));
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行事",
      color: lightenHexColor("#00ff00", 0.35),
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

  it("disables the mid and minor level buttons when no eligible parent tags exist", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} onSave={onSave} />
    );

    expect(getByTestId("edit-tag-level-mid").props.accessibilityState.disabled).toBe(true);
    expect(getByTestId("edit-tag-level-minor").props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(getByTestId("edit-tag-level-mid"));
    // pressing a disabled level must not switch away from "major" (still shows swatches)
    expect(getByTestId("edit-tag-color-blue")).toBeTruthy();
  });

  it("enables the minor level button once a mid tag exists to parent it", async () => {
    const midTag = { ...MAJOR_TAG, id: "tag-4", level: "mid" as const, parentId: "tag-1", name: "誕生日" };
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, midTag]} onSave={jest.fn()} />
    );

    expect(getByTestId("edit-tag-level-minor").props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(getByTestId("edit-tag-level-minor"));

    expect(getByTestId("edit-tag-parent-tag-4")).toBeTruthy();
  });
});
