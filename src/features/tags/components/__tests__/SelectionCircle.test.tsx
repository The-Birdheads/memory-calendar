import { fireEvent, render } from "@testing-library/react-native";

import { SelectionCircle } from "../SelectionCircle";

describe("SelectionCircle", () => {
  it("shows an empty circle (no checkmark) when not selected", async () => {
    const { getByTestId, queryByText } = await render(
      <SelectionCircle testID="sel-event-1" isSelected={false} onPress={jest.fn()} />
    );

    expect(getByTestId("sel-event-1")).toBeTruthy();
    expect(queryByText("✓")).toBeNull();
  });

  it("shows a checkmark when selected", async () => {
    const { getByText } = await render(
      <SelectionCircle testID="sel-event-1" isSelected={true} onPress={jest.fn()} />
    );

    expect(getByText("✓")).toBeTruthy();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <SelectionCircle testID="sel-event-1" isSelected={false} onPress={onPress} />
    );

    await fireEvent.press(getByTestId("sel-event-1"));

    expect(onPress).toHaveBeenCalled();
  });
});
