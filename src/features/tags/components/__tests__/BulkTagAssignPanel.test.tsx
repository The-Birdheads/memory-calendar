import { fireEvent, render } from "@testing-library/react-native";

import { BulkTagAssignPanel } from "../BulkTagAssignPanel";
import type { TagTreeNode } from "../../types";

const TAG_TREE: TagTreeNode[] = [
  {
    id: "tag-1",
    parentId: null,
    level: "major",
    name: "行事",
    color: "#ff0000",
    createdAt: "2026-08-18T00:00:00.000Z",
    children: [],
  },
  {
    id: "tag-2",
    parentId: null,
    level: "major",
    name: "外出",
    color: "#00ff00",
    createdAt: "2026-08-18T00:01:00.000Z",
    children: [],
  },
];

describe("BulkTagAssignPanel", () => {
  it("shows a tag picker and the 'まとめて付与' heading in assign mode", async () => {
    const { getByText, getByTestId } = await render(
      <BulkTagAssignPanel
        testIDPrefix="bulk-tag"
        tagTree={TAG_TREE}
        mode="assign"
        selectedTagIds={[]}
        onToggleTag={jest.fn()}
        onSwitchToRemoveMode={jest.fn()}
        onSwitchToAssignMode={jest.fn()}
      />
    );

    expect(getByText("まとめて付与したいタグを選択してください")).toBeTruthy();
    expect(getByTestId("bulk-tag-tag-picker-tag-tag-1")).toBeTruthy();
    expect(getByTestId("bulk-tag-tag-picker-tag-tag-2")).toBeTruthy();
  });

  it("calls onToggleTag when a tag chip is pressed", async () => {
    const onToggleTag = jest.fn();
    const { getByTestId } = await render(
      <BulkTagAssignPanel
        testIDPrefix="bulk-tag"
        tagTree={TAG_TREE}
        mode="assign"
        selectedTagIds={[]}
        onToggleTag={onToggleTag}
        onSwitchToRemoveMode={jest.fn()}
        onSwitchToAssignMode={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("bulk-tag-tag-picker-tag-tag-1"));

    expect(onToggleTag).toHaveBeenCalledWith("tag-1");
  });

  it("switches to remove mode when 'まとめて削除' is pressed", async () => {
    const onSwitchToRemoveMode = jest.fn();
    const { getByTestId } = await render(
      <BulkTagAssignPanel
        testIDPrefix="bulk-tag"
        tagTree={TAG_TREE}
        mode="assign"
        selectedTagIds={[]}
        onToggleTag={jest.fn()}
        onSwitchToRemoveMode={onSwitchToRemoveMode}
        onSwitchToAssignMode={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("bulk-tag-switch-to-remove"));

    expect(onSwitchToRemoveMode).toHaveBeenCalled();
  });

  it("shows a removal message (no tag picker) in remove mode, with a way back to assign mode", async () => {
    const onSwitchToAssignMode = jest.fn();
    const { getByText, getByTestId, queryByTestId } = await render(
      <BulkTagAssignPanel
        testIDPrefix="bulk-tag"
        tagTree={TAG_TREE}
        mode="remove"
        selectedTagIds={[]}
        onToggleTag={jest.fn()}
        onSwitchToRemoveMode={jest.fn()}
        onSwitchToAssignMode={onSwitchToAssignMode}
      />
    );

    expect(getByText("選択した予定の全てのタグを削除します")).toBeTruthy();
    expect(queryByTestId("bulk-tag-tag-picker-tag-tag-1")).toBeNull();

    await fireEvent.press(getByTestId("bulk-tag-switch-to-assign"));
    expect(onSwitchToAssignMode).toHaveBeenCalled();
  });

  it("places the 'まとめて削除' button to the right of the heading in assign mode", async () => {
    const { getByText, getByTestId } = await render(
      <BulkTagAssignPanel
        testIDPrefix="bulk-tag"
        tagTree={TAG_TREE}
        mode="assign"
        selectedTagIds={[]}
        onToggleTag={jest.fn()}
        onSwitchToRemoveMode={jest.fn()}
        onSwitchToAssignMode={jest.fn()}
      />
    );

    expect(getByText("まとめて削除")).toBeTruthy();
    expect(getByTestId("bulk-tag-switch-to-remove")).toBeTruthy();
  });

  it("places a 'まとめて付与' button to the right of the heading in remove mode", async () => {
    const { getByText, getByTestId } = await render(
      <BulkTagAssignPanel
        testIDPrefix="bulk-tag"
        tagTree={TAG_TREE}
        mode="remove"
        selectedTagIds={[]}
        onToggleTag={jest.fn()}
        onSwitchToRemoveMode={jest.fn()}
        onSwitchToAssignMode={jest.fn()}
      />
    );

    expect(getByText("まとめて付与")).toBeTruthy();
    expect(getByTestId("bulk-tag-switch-to-assign")).toBeTruthy();
  });
});
