import { fireEvent, render } from "@testing-library/react-native";

import { DeleteAccountConfirmModal } from "../DeleteAccountConfirmModal";

describe("DeleteAccountConfirmModal", () => {
  it("shows the consequences of deleting the account when visible", async () => {
    const { getByText } = await render(
      <DeleteAccountConfirmModal visible onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(getByText("アカウントを削除しますか?")).toBeTruthy();
    expect(getByText(/この操作は取り消せません/)).toBeTruthy();
  });

  it("renders nothing when not visible", async () => {
    const { queryByTestId } = await render(
      <DeleteAccountConfirmModal visible={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(queryByTestId("delete-account-confirm-button")).toBeNull();
  });

  it("uses icons instead of text for the cancel/delete buttons", async () => {
    const { queryByText, getByTestId } = await render(
      <DeleteAccountConfirmModal visible onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(queryByText("キャンセル")).toBeNull();
    expect(queryByText("削除する")).toBeNull();
    expect(getByTestId("delete-account-cancel-button")).toBeTruthy();
    expect(getByTestId("delete-account-confirm-button")).toBeTruthy();
  });

  it("calls onConfirm when the delete button is pressed", async () => {
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <DeleteAccountConfirmModal visible onConfirm={onConfirm} onCancel={jest.fn()} />
    );

    await fireEvent.press(getByTestId("delete-account-confirm-button"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is pressed", async () => {
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <DeleteAccountConfirmModal visible onConfirm={jest.fn()} onCancel={onCancel} />
    );

    await fireEvent.press(getByTestId("delete-account-cancel-button"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel (not onConfirm) when tapping outside the card, on the backdrop", async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <DeleteAccountConfirmModal visible onConfirm={onConfirm} onCancel={onCancel} />
    );

    await fireEvent.press(getByTestId("delete-account-backdrop"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
