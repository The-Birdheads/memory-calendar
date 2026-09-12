import { fireEvent, render } from "@testing-library/react-native";

import { BulkSelectionActionBar } from "../BulkSelectionActionBar";

describe("BulkSelectionActionBar", () => {
  it("shows the selected count and calls onClearSelection from '全選択解除'", async () => {
    const onClearSelection = jest.fn();
    const { getByText, getByTestId } = await render(
      <BulkSelectionActionBar
        testIDPrefix="bulk-bar"
        mode="assign"
        selectedEventCount={3}
        selectedTagNames={["行事"]}
        onClearSelection={onClearSelection}
        onConfirm={jest.fn()}
      />
    );

    expect(getByText("3件選択中")).toBeTruthy();
    await fireEvent.press(getByTestId("bulk-bar-clear"));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("disables 選択完了 when no events are selected", async () => {
    const { getByTestId } = await render(
      <BulkSelectionActionBar
        testIDPrefix="bulk-bar"
        mode="assign"
        selectedEventCount={0}
        selectedTagNames={["行事"]}
        onClearSelection={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(getByTestId("bulk-bar-confirm").props.accessibilityState?.disabled).toBe(true);
  });

  it("disables 選択完了 in assign mode when no tags are selected, even with events selected", async () => {
    const { getByTestId } = await render(
      <BulkSelectionActionBar
        testIDPrefix="bulk-bar"
        mode="assign"
        selectedEventCount={2}
        selectedTagNames={[]}
        onClearSelection={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(getByTestId("bulk-bar-confirm").props.accessibilityState?.disabled).toBe(true);
  });

  it("enables 選択完了 in remove mode with events selected, even without any tags", async () => {
    const { getByTestId } = await render(
      <BulkSelectionActionBar
        testIDPrefix="bulk-bar"
        mode="remove"
        selectedEventCount={2}
        selectedTagNames={[]}
        onClearSelection={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(getByTestId("bulk-bar-confirm").props.accessibilityState?.disabled).toBeFalsy();
  });

  it("shows a confirmation modal naming the tags in assign mode, and calls onConfirm only after the modal is confirmed", async () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText, queryByTestId } = await render(
      <BulkSelectionActionBar
        testIDPrefix="bulk-bar"
        mode="assign"
        selectedEventCount={2}
        selectedTagNames={["行事", "外出"]}
        onClearSelection={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    await fireEvent.press(getByTestId("bulk-bar-confirm"));

    expect(getByText("選択された予定にタグ「行事、外出」を設定してよろしいですか？")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId("bulk-bar-confirm-ok"));

    expect(onConfirm).toHaveBeenCalled();
    expect(queryByTestId("bulk-bar-confirm-modal")).toBeNull();
  });

  it("shows a different confirmation message in remove mode", async () => {
    const { getByTestId, getByText } = await render(
      <BulkSelectionActionBar
        testIDPrefix="bulk-bar"
        mode="remove"
        selectedEventCount={2}
        selectedTagNames={[]}
        onClearSelection={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("bulk-bar-confirm"));

    expect(getByText("選択された予定の全てのタグを削除してよろしいですか？")).toBeTruthy();
  });

  it("does not call onConfirm when the modal is cancelled", async () => {
    const onConfirm = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <BulkSelectionActionBar
        testIDPrefix="bulk-bar"
        mode="assign"
        selectedEventCount={1}
        selectedTagNames={["行事"]}
        onClearSelection={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    await fireEvent.press(getByTestId("bulk-bar-confirm"));
    await fireEvent.press(getByTestId("bulk-bar-confirm-cancel"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(queryByTestId("bulk-bar-confirm-modal")).toBeNull();
  });
});
