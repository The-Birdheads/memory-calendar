import { fireEvent, render } from "@testing-library/react-native";

import { DeleteTagConfirmModal } from "../DeleteTagConfirmModal";

describe("DeleteTagConfirmModal", () => {
  it("shows a generic warning when the tag has no children", async () => {
    const { getByText } = await render(
      <DeleteTagConfirmModal visible onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(getByText("このタグが設定された予定への紐付けも削除されます")).toBeTruthy();
  });

  it("shows a warning about descendant tags when hasChildren is true", async () => {
    const { getByText } = await render(
      <DeleteTagConfirmModal visible hasChildren onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(
      getByText("配下の中分類・小分類タグと、それらが設定された予定への紐付けも削除されます")
    ).toBeTruthy();
  });

  it("renders nothing when not visible", async () => {
    const { queryByTestId } = await render(
      <DeleteTagConfirmModal visible={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    );

    expect(queryByTestId("delete-tag-confirm-button")).toBeNull();
  });

  it("calls onConfirm when the delete button is pressed", async () => {
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <DeleteTagConfirmModal visible onConfirm={onConfirm} onCancel={jest.fn()} />
    );

    await fireEvent.press(getByTestId("delete-tag-confirm-button"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is pressed", async () => {
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <DeleteTagConfirmModal visible onConfirm={jest.fn()} onCancel={onCancel} />
    );

    await fireEvent.press(getByTestId("delete-tag-cancel-button"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
