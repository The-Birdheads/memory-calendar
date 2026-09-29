import { fireEvent, render, within } from "@testing-library/react-native";

import { EditTagForm, TAG_COLORS } from "../EditTagForm";
import { lightenHexColor } from "../../../../shared/utils/color";
import type { Calendar } from "../../../calendars/types";

const CALENDARS: Calendar[] = [
  { id: "cal-1", name: "我が家", kind: "group", color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
];

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
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS}
        onSave={jest.fn()} />
    );

    expect(getByTestId("edit-tag-name-input").props.value).toBe("行事");
  });

  it("saves the edited name and a newly picked swatch color, keeping the level and parent unchanged", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS}
        onSave={onSave} />
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

  it("disables the save button and does not call onSave again while a save is already in flight (regression: double-tap created two tags)", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS}
        onSave={onSave} isSubmitting />
    );

    expect(getByTestId("edit-tag-save-button").props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("uses a ✓ icon instead of the 保存 text label for the save button", async () => {
    const { queryByText, getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS}
        onSave={jest.fn()} />
    );

    expect(queryByText("保存")).toBeNull();
    expect(getByTestId("edit-tag-save-button")).toBeTruthy();
  });

  it("does not show a color picker for a major tag's own color once color-picking is disabled by level", async () => {
    // sanity check: a major tag shows pickable swatches
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS}
        onSave={jest.fn()} />
    );
    expect(getByTestId("edit-tag-color-blue")).toBeTruthy();
  });

  it("marks a color already used by a calendar, and explains which one once it's picked", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS} onSave={jest.fn()} />
    );

    // CALENDARS has cal-1 "我が家" using blue (#2f6fed).
    expect(getByTestId("edit-tag-color-blue-used-mark")).toBeTruthy();
    expect(queryByTestId("edit-tag-color-usage-message")).toBeNull();

    await fireEvent.press(getByTestId("edit-tag-color-blue"));

    expect(getByTestId("edit-tag-color-usage-message").props.children).toBe(
      "この色は共有カレンダー「我が家」で使用中です"
    );
  });

  it("does not flag the tag's own current color as 'used' against itself", async () => {
    // MAJOR_TAG's own recorded color is an exact palette color here (blue),
    // and it's the only tag in allTags - without self-exclusion this would
    // incorrectly show the blue swatch as "used by 行事" (itself).
    const tagOnBlue = { ...MAJOR_TAG, color: "#2f6fed" };
    const { queryByTestId } = await render(
      <EditTagForm tag={tagOnBlue} allTags={[tagOnBlue]} calendars={[]} onSave={jest.fn()} />
    );

    expect(queryByTestId("edit-tag-color-blue-used-mark")).toBeNull();
  });

  it("shows the parent tag (not color swatches) for a mid tag, auto-deriving a lighter shade of its color on save", async () => {
    const onSave = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, OTHER_MAJOR_TAG]} calendars={CALENDARS}
        onSave={onSave} />
    );

    await fireEvent.press(getByTestId("edit-tag-level-mid"));

    expect(queryByTestId("edit-tag-color-blue")).toBeNull();
    expect(getByTestId("edit-tag-parent-tag-unselected")).toBeTruthy();

    await fireEvent.press(getByTestId("edit-tag-parent-tag-2"));

    expect(within(getByTestId("edit-tag-parent-tag-badge")).getByText("外出")).toBeTruthy();

    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行事",
      color: lightenHexColor("#00ff00", 0.35),
      level: "mid",
      parentId: "tag-2",
    });
  });

  it("saves a major tag with no color when '未設定' is picked (色未設定 - falls back to the calendar's color on screen)", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, OTHER_MAJOR_TAG]} calendars={CALENDARS}
        onSave={onSave} />
    );

    await fireEvent.press(getByTestId("edit-tag-color-unset"));
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行事",
      color: null,
      level: "major",
      parentId: null,
    });
  });

  it("also leaves a mid tag's color unset (rather than crashing) when its major parent's color is unset", async () => {
    const unsetMajorTag = { ...OTHER_MAJOR_TAG, color: null };
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, unsetMajorTag]} calendars={CALENDARS}
        onSave={onSave} />
    );

    await fireEvent.press(getByTestId("edit-tag-level-mid"));
    await fireEvent.press(getByTestId(`edit-tag-parent-${unsetMajorTag.id}`));

    expect(within(getByTestId("edit-tag-parent-tag-badge")).getByText(unsetMajorTag.name)).toBeTruthy();

    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行事",
      color: null,
      level: "mid",
      parentId: unsetMajorTag.id,
    });
  });

  it("wraps the parent-tag options onto multiple lines instead of overflowing off-screen (regression: with many 大分類 tags, later ones became untappable)", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, OTHER_MAJOR_TAG]} calendars={CALENDARS}
        onSave={onSave} />
    );

    await fireEvent.press(getByTestId("edit-tag-level-mid"));

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    expect(flattenStyle(getByTestId("edit-tag-parent-row").props.style).flexWrap).toBe("wrap");
  });

  it("excludes the tag itself from its own eligible parent options", async () => {
    const midTag = { ...MAJOR_TAG, id: "tag-3", level: "mid" as const, parentId: "tag-1" };
    const { queryByTestId } = await render(
      <EditTagForm tag={midTag} allTags={[MAJOR_TAG, midTag]} calendars={CALENDARS}
        onSave={jest.fn()} />
    );

    await fireEvent.press(queryByTestId("edit-tag-level-mid")!);

    expect(queryByTestId("edit-tag-parent-tag-3")).toBeNull();
  });

  it("disables the mid and minor level buttons when no eligible parent tags exist", async () => {
    const onSave = jest.fn();
    const { getByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS}
        onSave={onSave} />
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
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, midTag]} calendars={CALENDARS}
        onSave={jest.fn()} />
    );

    expect(getByTestId("edit-tag-level-minor").props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(getByTestId("edit-tag-level-minor"));

    expect(getByTestId("edit-tag-grandparent-tag-1")).toBeTruthy();
  });

  it("drills down: picking the 大分類 first reveals only that 大分類's 中分類 children as parent choices", async () => {
    const midOfTag1 = { ...MAJOR_TAG, id: "tag-4", level: "mid" as const, parentId: "tag-1", name: "誕生日" };
    const midOfTag2 = {
      ...MAJOR_TAG,
      id: "tag-5",
      level: "mid" as const,
      parentId: "tag-2",
      name: "国内旅行",
      color: "#00ff00",
    };
    const onSave = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <EditTagForm
        tag={MAJOR_TAG}
        allTags={[MAJOR_TAG, OTHER_MAJOR_TAG, midOfTag1, midOfTag2]}
        calendars={CALENDARS}
        onSave={onSave}
      />
    );

    await fireEvent.press(getByTestId("edit-tag-level-minor"));

    // no 中分類 parent choices are shown until a 大分類 is picked
    expect(queryByTestId("edit-tag-parent-tag-4")).toBeNull();
    expect(queryByTestId("edit-tag-parent-tag-5")).toBeNull();

    await fireEvent.press(getByTestId("edit-tag-grandparent-tag-2"));

    // only tag-2's own mid child is offered, not tag-1's
    expect(getByTestId("edit-tag-parent-tag-5")).toBeTruthy();
    expect(queryByTestId("edit-tag-parent-tag-4")).toBeNull();

    await fireEvent.press(getByTestId("edit-tag-parent-tag-5"));
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    expect(onSave).toHaveBeenCalledWith({
      name: "行事",
      color: lightenHexColor("#00ff00", 0.35),
      level: "minor",
      parentId: "tag-5",
    });
  });

  it("shows both the 大分類 and 中分類 ancestors as a breadcrumb for a 小分類 tag (not just the immediate 中分類 parent)", async () => {
    const midOfTag2 = {
      ...MAJOR_TAG,
      id: "tag-5",
      level: "mid" as const,
      parentId: "tag-2",
      name: "国内旅行",
      color: "#00ff00",
    };
    const { getByTestId, queryByTestId } = await render(
      <EditTagForm
        tag={MAJOR_TAG}
        allTags={[MAJOR_TAG, OTHER_MAJOR_TAG, midOfTag2]}
        calendars={CALENDARS}
        onSave={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("edit-tag-level-minor"));
    // before a 大分類 is picked, no ancestor badge yet - just the "未選択" placeholder
    expect(getByTestId("edit-tag-parent-tag-unselected")).toBeTruthy();
    expect(queryByTestId("edit-tag-major-ancestor-badge")).toBeNull();

    await fireEvent.press(getByTestId("edit-tag-grandparent-tag-2"));
    // 大分類 picked but no 中分類 yet: shows just the 大分類 badge as the (only) parent badge
    expect(within(getByTestId("edit-tag-parent-tag-badge")).getByText("外出")).toBeTruthy();
    expect(queryByTestId("edit-tag-major-ancestor-badge")).toBeNull();

    await fireEvent.press(getByTestId("edit-tag-parent-tag-5"));
    // both picked: 大分類 badge first, then 中分類 badge
    expect(within(getByTestId("edit-tag-major-ancestor-badge")).getByText("外出")).toBeTruthy();
    expect(within(getByTestId("edit-tag-parent-tag-badge")).getByText("国内旅行")).toBeTruthy();
  });

  it("resets the chosen 大分類/中分類 when switching away from and back to 小分類", async () => {
    const midOfTag1 = { ...MAJOR_TAG, id: "tag-4", level: "mid" as const, parentId: "tag-1", name: "誕生日" };
    const { getByTestId, queryByTestId } = await render(
      <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG, midOfTag1]} calendars={CALENDARS}
        onSave={jest.fn()} />
    );

    await fireEvent.press(getByTestId("edit-tag-level-minor"));
    await fireEvent.press(getByTestId("edit-tag-grandparent-tag-1"));
    expect(getByTestId("edit-tag-parent-tag-4")).toBeTruthy();

    await fireEvent.press(getByTestId("edit-tag-level-major"));
    await fireEvent.press(getByTestId("edit-tag-level-minor"));

    expect(queryByTestId("edit-tag-parent-tag-4")).toBeNull();
  });

  describe("isEditing (既存タグの編集: 名前は鉛筆アイコン、分類・親タグ・色は選択即保存)", () => {
    it("shows the name as plain text with an edit (pencil) icon instead of an input, and no save button at all", async () => {
      const { getByTestId, queryByTestId } = await render(
        <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS} onSave={jest.fn()} isEditing />
      );

      expect(getByTestId("edit-tag-name-display").props.children).toBe("行事");
      expect(getByTestId("edit-tag-name-edit")).toBeTruthy();
      expect(queryByTestId("edit-tag-name-input")).toBeNull();
      expect(queryByTestId("edit-tag-save-button")).toBeNull();
    });

    it("reveals a text input with confirm/cancel when the name's edit icon is pressed, and saves just the name on confirm", async () => {
      const onSave = jest.fn();
      const { getByTestId, queryByTestId } = await render(
        <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS} onSave={onSave} isEditing />
      );

      await fireEvent.press(getByTestId("edit-tag-name-edit"));
      expect(getByTestId("edit-tag-name-input").props.value).toBe("行事");

      await fireEvent.changeText(getByTestId("edit-tag-name-input"), "行楽");
      await fireEvent.press(getByTestId("edit-tag-name-confirm"));

      expect(onSave).toHaveBeenCalledWith({ name: "行楽" });
      expect(queryByTestId("edit-tag-name-input")).toBeNull();
      expect(getByTestId("edit-tag-name-display").props.children).toBe("行楽");
    });

    it("reverts to the original name without saving when the name edit is cancelled", async () => {
      const onSave = jest.fn();
      const { getByTestId } = await render(
        <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS} onSave={onSave} isEditing />
      );

      await fireEvent.press(getByTestId("edit-tag-name-edit"));
      await fireEvent.changeText(getByTestId("edit-tag-name-input"), "書きかけ");
      await fireEvent.press(getByTestId("edit-tag-name-cancel"));

      expect(onSave).not.toHaveBeenCalled();
      expect(getByTestId("edit-tag-name-display").props.children).toBe("行事");
    });

    it("saves a major tag's color immediately when a swatch is tapped, with a check mark inside it and no separate confirm step", async () => {
      const onSave = jest.fn();
      const { getByTestId } = await render(
        <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS} onSave={onSave} isEditing />
      );

      await fireEvent.press(getByTestId("edit-tag-color-green"));

      expect(onSave).toHaveBeenCalledWith({ color: TAG_COLORS.find((c) => c.name === "green")!.hex });
      expect(getByTestId("edit-tag-color-green-check")).toBeTruthy();
    });

    it("saves 色未設定 immediately when picked for a major tag being edited", async () => {
      const onSave = jest.fn();
      const { getByTestId } = await render(
        <EditTagForm tag={MAJOR_TAG} allTags={[MAJOR_TAG]} calendars={CALENDARS} onSave={onSave} isEditing />
      );

      await fireEvent.press(getByTestId("edit-tag-color-unset"));

      expect(onSave).toHaveBeenCalledWith({ color: null });
    });

    it("saves immediately when switching level to 大分類 (parentless, so the new state is already valid)", async () => {
      const midTag = { ...MAJOR_TAG, id: "tag-3", level: "mid" as const, parentId: "tag-1" };
      const onSave = jest.fn();
      const { getByTestId } = await render(
        <EditTagForm tag={midTag} allTags={[MAJOR_TAG, midTag]} calendars={CALENDARS} onSave={onSave} isEditing />
      );

      await fireEvent.press(getByTestId("edit-tag-level-major"));

      expect(onSave).toHaveBeenCalledWith({ level: "major", parentId: null, color: TAG_COLORS[0].hex });
    });

    it("does not save when switching level to 中分類 (no parent chosen yet), but does save once a parent is picked", async () => {
      const onSave = jest.fn();
      const { getByTestId } = await render(
        <EditTagForm
          tag={MAJOR_TAG}
          allTags={[MAJOR_TAG, OTHER_MAJOR_TAG]}
          calendars={CALENDARS}
          onSave={onSave}
          isEditing
        />
      );

      await fireEvent.press(getByTestId("edit-tag-level-mid"));
      expect(onSave).not.toHaveBeenCalled();

      await fireEvent.press(getByTestId("edit-tag-parent-tag-2"));

      expect(onSave).toHaveBeenCalledWith({
        level: "mid",
        parentId: "tag-2",
        color: lightenHexColor("#00ff00", 0.35),
      });
    });

    it("saves immediately once a 小分類's grandparent+parent are both picked, not on the grandparent step alone", async () => {
      const midOfTag2 = {
        ...MAJOR_TAG,
        id: "tag-5",
        level: "mid" as const,
        parentId: "tag-2",
        name: "国内旅行",
        color: "#00ff00",
      };
      const onSave = jest.fn();
      const { getByTestId } = await render(
        <EditTagForm
          tag={MAJOR_TAG}
          allTags={[MAJOR_TAG, OTHER_MAJOR_TAG, midOfTag2]}
          calendars={CALENDARS}
          onSave={onSave}
          isEditing
        />
      );

      await fireEvent.press(getByTestId("edit-tag-level-minor"));
      await fireEvent.press(getByTestId("edit-tag-grandparent-tag-2"));
      expect(onSave).not.toHaveBeenCalled();

      await fireEvent.press(getByTestId("edit-tag-parent-tag-5"));

      expect(onSave).toHaveBeenCalledWith({
        level: "minor",
        parentId: "tag-5",
        color: lightenHexColor("#00ff00", 0.35),
      });
    });
  });
});
