import { fireEvent, render } from "@testing-library/react-native";

import { LeaveOrDeleteCalendarConfirmModal } from "../LeaveOrDeleteCalendarConfirmModal";

describe("LeaveOrDeleteCalendarConfirmModal", () => {
  it("shows a leave-only warning when other members remain", async () => {
    const { getByText, getByTestId } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible willDeleteEntirely={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(getByText("このカレンダーから抜けますか?")).toBeTruthy();
    expect(getByTestId("leave-or-delete-calendar-confirm-button")).toBeTruthy();
  });

  it("shows a full-deletion warning when the caller is the only member", async () => {
    const { getByText } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible willDeleteEntirely onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(getByText("カレンダーを削除しますか?")).toBeTruthy();
    expect(
      getByText("あなたが唯一のメンバーのため、このカレンダーとすべての予定データが完全に削除されます")
    ).toBeTruthy();
  });

  it("renders nothing when not visible", async () => {
    const { queryByTestId } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible={false} willDeleteEntirely={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(queryByTestId("leave-or-delete-calendar-confirm-button")).toBeNull();
  });

  it("calls onConfirm when the confirm button is pressed", async () => {
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible willDeleteEntirely={false} onConfirm={onConfirm} onCancel={jest.fn()} />
    );

    await fireEvent.press(getByTestId("leave-or-delete-calendar-confirm-button"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is pressed", async () => {
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible willDeleteEntirely={false} onConfirm={jest.fn()} onCancel={onCancel} />
    );

    await fireEvent.press(getByTestId("leave-or-delete-calendar-cancel-button"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses icons/glyphs instead of text for cancel and delete, but keeps the 抜ける text since it isn't a delete action", async () => {
    const { queryByText, getByTestId } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible willDeleteEntirely onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(queryByText("キャンセル")).toBeNull();
    expect(queryByText("削除する")).toBeNull();
    expect(getByTestId("leave-or-delete-calendar-cancel-button")).toBeTruthy();
    expect(getByTestId("leave-or-delete-calendar-confirm-button")).toBeTruthy();
  });

  it("keeps the 抜ける text label when leaving without deleting, since it isn't a destructive action with a matching icon", async () => {
    const { getByText, queryByText } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible willDeleteEntirely={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(getByText("抜ける")).toBeTruthy();
    expect(queryByText("キャンセル")).toBeNull();
  });

  it("calls onCancel (not onConfirm) when tapping outside the card, on the backdrop", async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <LeaveOrDeleteCalendarConfirmModal visible willDeleteEntirely={false} onConfirm={onConfirm} onCancel={onCancel} />
    );

    await fireEvent.press(getByTestId("leave-or-delete-calendar-backdrop"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
