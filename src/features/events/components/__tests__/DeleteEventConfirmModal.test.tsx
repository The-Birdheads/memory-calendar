import { fireEvent, render } from "@testing-library/react-native";

import { DeleteEventConfirmModal } from "../DeleteEventConfirmModal";

describe("DeleteEventConfirmModal", () => {
  it("shows the memory-data warning when visible", async () => {
    const { getByText } = await render(
      <DeleteEventConfirmModal visible onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(getByText("この予定に紐づく思い出データ(写真・コメント)も削除されます")).toBeTruthy();
  });

  it("renders nothing when not visible", async () => {
    const { queryByTestId } = await render(
      <DeleteEventConfirmModal visible={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(queryByTestId("delete-event-confirm-button")).toBeNull();
  });

  it("calls onConfirm when the delete button is pressed", async () => {
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <DeleteEventConfirmModal visible onConfirm={onConfirm} onCancel={jest.fn()} />
    );

    await fireEvent.press(getByTestId("delete-event-confirm-button"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is pressed", async () => {
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <DeleteEventConfirmModal visible onConfirm={jest.fn()} onCancel={onCancel} />
    );

    await fireEvent.press(getByTestId("delete-event-cancel-button"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
