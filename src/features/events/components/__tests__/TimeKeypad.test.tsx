import { fireEvent, render } from "@testing-library/react-native";

import { TimeKeypad } from "../TimeKeypad";

function setup() {
  const onDigit = jest.fn();
  const onQuickValue = jest.fn();
  const onDone = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <TimeKeypad
      testIDPrefix="keypad"
      doneTestID="done"
      cancelTestID="cancel"
      onDigit={onDigit}
      onQuickValue={onQuickValue}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
  return { utils, onDigit, onQuickValue, onDone, onCancel };
}

describe("TimeKeypad", () => {
  it("has the digit keys 0-9 plus the 00 and 30 shortcuts", async () => {
    const { utils } = setup();
    const { getByTestId } = await utils;

    for (const label of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "30"]) {
      expect(getByTestId(`keypad-key-${label}`)).toBeTruthy();
    }
  });

  it("lays the keys out like a phone keypad, 7-8-9 on top and 0-00-30 at the bottom", async () => {
    const { utils } = setup();
    const { getByTestId } = await utils;

    const rows = ["keypad-row-0", "keypad-row-1", "keypad-row-2", "keypad-row-3"].map((id) =>
      getByTestId(id).props.children.map((child: { props: { testID: string } }) => child.props.testID.replace("keypad-key-", ""))
    );

    expect(rows).toEqual([
      ["7", "8", "9"],
      ["4", "5", "6"],
      ["1", "2", "3"],
      ["0", "00", "30"],
    ]);
  });

  it("calls onDigit with the number for a digit key", async () => {
    const { utils, onDigit } = setup();
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("keypad-key-7"));
    await fireEvent.press(getByTestId("keypad-key-0"));

    expect(onDigit).toHaveBeenNthCalledWith(1, 7);
    expect(onDigit).toHaveBeenNthCalledWith(2, 0);
  });

  it("calls onQuickValue with 0 for the 00 key and 30 for the 30 key (not onDigit)", async () => {
    const { utils, onDigit, onQuickValue } = setup();
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("keypad-key-00"));
    await fireEvent.press(getByTestId("keypad-key-30"));

    expect(onQuickValue).toHaveBeenNthCalledWith(1, 0);
    expect(onQuickValue).toHaveBeenNthCalledWith(2, 30);
    expect(onDigit).not.toHaveBeenCalled();
  });

  it("has a 完了 button in the toolbar above the keys", async () => {
    const { utils, onDone } = setup();
    const { getByTestId, getByText } = await utils;

    expect(getByText("完了")).toBeTruthy();
    await fireEvent.press(getByTestId("done"));

    expect(onDone).toHaveBeenCalled();
  });

  it("has a キャンセル button next to 完了 in the toolbar", async () => {
    const { utils, onCancel, onDone } = setup();
    const { getByTestId, getByText } = await utils;

    expect(getByText("キャンセル")).toBeTruthy();
    await fireEvent.press(getByTestId("cancel"));

    expect(onCancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
