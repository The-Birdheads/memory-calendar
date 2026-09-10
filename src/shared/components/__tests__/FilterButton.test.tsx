import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { FilterButton } from "../FilterButton";

describe("FilterButton", () => {
  it("shows the trigger button but not its content until pressed", async () => {
    const { getByTestId, queryByText } = await render(
      <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
        <Text>カレンダーの中身</Text>
      </FilterButton>
    );

    expect(getByTestId("history-filter")).toBeTruthy();
    expect(queryByText("カレンダーの中身")).toBeNull();
  });

  it("opens the sheet (showing its children) when the trigger is pressed, and closes it again", async () => {
    const { getByTestId, getByText, queryByText } = await render(
      <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
        <Text>カレンダーの中身</Text>
      </FilterButton>
    );

    await fireEvent.press(getByTestId("history-filter"));
    expect(getByText("カレンダーの中身")).toBeTruthy();

    await fireEvent.press(getByTestId("history-filter-close"));
    expect(queryByText("カレンダーの中身")).toBeNull();
  });

  it("shows an active-indicator dot only when isActive is true", async () => {
    const { getByTestId, queryByTestId, rerender } = await render(
      <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
        <Text>中身</Text>
      </FilterButton>
    );

    expect(queryByTestId("history-filter-active-dot")).toBeNull();

    await rerender(
      <FilterButton testID="history-filter" isActive onReset={jest.fn()}>
        <Text>中身</Text>
      </FilterButton>
    );

    expect(getByTestId("history-filter-active-dot")).toBeTruthy();
  });

  it("closes the sheet when the area outside it is pressed", async () => {
    const { getByTestId, getByText, queryByText } = await render(
      <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
        <Text>カレンダーの中身</Text>
      </FilterButton>
    );

    await fireEvent.press(getByTestId("history-filter"));
    expect(getByText("カレンダーの中身")).toBeTruthy();

    await fireEvent.press(getByTestId("history-filter-overlay"));
    expect(queryByText("カレンダーの中身")).toBeNull();
  });

  it("does not close the sheet when its own content is pressed", async () => {
    const { getByTestId, getByText } = await render(
      <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
        <Text>カレンダーの中身</Text>
      </FilterButton>
    );

    await fireEvent.press(getByTestId("history-filter"));
    await fireEvent.press(getByText("カレンダーの中身"));

    expect(getByText("カレンダーの中身")).toBeTruthy();
  });

  it("calls onReset when the reset link is pressed, without closing the sheet", async () => {
    const onReset = jest.fn();
    const { getByTestId, getByText } = await render(
      <FilterButton testID="history-filter" isActive onReset={onReset}>
        <Text>中身</Text>
      </FilterButton>
    );

    await fireEvent.press(getByTestId("history-filter"));
    await fireEvent.press(getByTestId("history-filter-reset"));

    expect(onReset).toHaveBeenCalled();
    // Still open - the caller may want to keep adjusting after resetting.
    expect(getByText("中身")).toBeTruthy();
  });
});
