import { fireEvent, render, within } from "@testing-library/react-native";
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

  it("shows an active indicator only when isActive is true", async () => {
    const { getByTestId, queryByTestId, rerender } = await render(
      <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
        <Text>中身</Text>
      </FilterButton>
    );

    expect(queryByTestId("history-filter-active-indicator")).toBeNull();

    await rerender(
      <FilterButton testID="history-filter" isActive onReset={jest.fn()}>
        <Text>中身</Text>
      </FilterButton>
    );

    expect(getByTestId("history-filter-active-indicator")).toBeTruthy();
  });

  it("fills the trigger with solid blue (instead of a small dot) while a filter is active, so it is obvious at a glance", async () => {
    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const { getByTestId } = await render(
      <FilterButton testID="history-filter" isActive onReset={jest.fn()}>
        <Text>中身</Text>
      </FilterButton>
    );

    const indicator = flattenStyle(getByTestId("history-filter-active-indicator").props.style);
    expect(indicator.backgroundColor).toBe("#2f6fed");
    expect(indicator.borderRadius).toBeGreaterThan(0);
  });

  function barColors(trigger: Parameters<typeof within>[0]): unknown[] {
    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    return within(trigger)
      .getAllByTestId("filter-icon-bar")
      .map((bar) => flattenStyle(bar.props.style).backgroundColor);
  }

  it("draws the filter icon in white on the blue fill when active", async () => {
    const { getByTestId } = await render(
      <FilterButton testID="history-filter" isActive onReset={jest.fn()}>
        <Text>中身</Text>
      </FilterButton>
    );

    expect(barColors(getByTestId("history-filter"))).toEqual(["#fff", "#fff", "#fff"]);
  });

  it("draws the filter icon in the normal dark gray on a plain background when not active", async () => {
    const { getByTestId } = await render(
      <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
        <Text>中身</Text>
      </FilterButton>
    );

    expect(barColors(getByTestId("history-filter"))).toEqual(["#444", "#444", "#444"]);
  });

  describe("「絞り込み」ボタン(onApply指定時)", () => {
    it("shows no apply button when onApply isn't given", async () => {
      const { getByTestId, queryByTestId } = await render(
        <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()}>
          <Text>中身</Text>
        </FilterButton>
      );

      await fireEvent.press(getByTestId("history-filter"));

      expect(queryByTestId("history-filter-apply")).toBeNull();
    });

    it("shows 「絞り込み」 to the left of 「閉じる」 when onApply is given", async () => {
      const { getByTestId } = await render(
        <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()} onApply={jest.fn()}>
          <Text>中身</Text>
        </FilterButton>
      );

      await fireEvent.press(getByTestId("history-filter"));

      const applyButton = getByTestId("history-filter-apply");
      expect(within(applyButton).getByText("絞り込み")).toBeTruthy();
      const closeButton = getByTestId("history-filter-close");
      expect(applyButton.parent).toBe(closeButton.parent);
      const siblings = applyButton.parent!.children;
      expect(siblings.indexOf(applyButton as never)).toBeLessThan(siblings.indexOf(closeButton as never));
    });

    it("calls onApply and closes the sheet when 「絞り込み」 is pressed", async () => {
      const onApply = jest.fn();
      const { getByTestId, queryByText } = await render(
        <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()} onApply={onApply}>
          <Text>中身</Text>
        </FilterButton>
      );

      await fireEvent.press(getByTestId("history-filter"));
      await fireEvent.press(getByTestId("history-filter-apply"));

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(queryByText("中身")).toBeNull();
    });

    it("closes without applying when 「閉じる」 is pressed", async () => {
      const onApply = jest.fn();
      const { getByTestId } = await render(
        <FilterButton testID="history-filter" isActive={false} onReset={jest.fn()} onApply={onApply}>
          <Text>中身</Text>
        </FilterButton>
      );

      await fireEvent.press(getByTestId("history-filter"));
      await fireEvent.press(getByTestId("history-filter-close"));

      expect(onApply).not.toHaveBeenCalled();
    });
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
