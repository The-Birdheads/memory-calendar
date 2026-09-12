import { fireEvent, render } from "@testing-library/react-native";

import { DateRangeFilterSection } from "../DateRangeFilterSection";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return function MockDateTimePicker({ testID, onChange }: any) {
    return React.createElement(TextInput, {
      testID,
      onChangeText: (text: string) => onChange({ type: "set" }, new Date(text)),
    });
  };
});

describe("DateRangeFilterSection", () => {
  it("shows 'すべて' active and no date buttons when not filtering", async () => {
    const { getByTestId, queryByTestId } = await render(
      <DateRangeFilterSection testIDPrefix="todos-period" startDate={null} endDate={null} onChange={jest.fn()} />
    );

    expect(getByTestId("todos-period-enable")).toBeTruthy();
    expect(queryByTestId("todos-period-start-button")).toBeNull();
    expect(queryByTestId("todos-period-end-button")).toBeNull();
  });

  it("enabling the filter sets both start and end to today", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <DateRangeFilterSection testIDPrefix="todos-period" startDate={null} endDate={null} onChange={onChange} />
    );

    await fireEvent.press(getByTestId("todos-period-enable"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
    const [{ startDate, endDate }] = onChange.mock.calls[0];
    expect(startDate).toBe(endDate);
  });

  it("shows the current start/end dates once filtering is active", async () => {
    const { getByTestId, getByText } = await render(
      <DateRangeFilterSection
        testIDPrefix="todos-period"
        startDate="2026-09-01"
        endDate="2026-09-10"
        onChange={jest.fn()}
      />
    );

    expect(getByTestId("todos-period-start-button")).toBeTruthy();
    expect(getByTestId("todos-period-end-button")).toBeTruthy();
    expect(getByText("開始 2026-09-01")).toBeTruthy();
    expect(getByText("終了 2026-09-10")).toBeTruthy();
  });

  it("opens and closes the start-date picker", async () => {
    const { getByTestId, queryByTestId } = await render(
      <DateRangeFilterSection
        testIDPrefix="todos-period"
        startDate="2026-09-01"
        endDate="2026-09-10"
        onChange={jest.fn()}
      />
    );

    expect(queryByTestId("todos-period-start-picker")).toBeNull();

    await fireEvent.press(getByTestId("todos-period-start-button"));
    expect(getByTestId("todos-period-start-picker")).toBeTruthy();

    await fireEvent.press(getByTestId("todos-period-picker-done"));
    expect(queryByTestId("todos-period-start-picker")).toBeNull();
  });

  it("picking a new start date calls onChange with the new start and unchanged end", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <DateRangeFilterSection
        testIDPrefix="todos-period"
        startDate="2026-09-01"
        endDate="2026-09-10"
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("todos-period-start-button"));
    const picker = getByTestId("todos-period-start-picker");
    fireEvent.changeText(picker, "2026-09-05T00:00:00.000Z");

    expect(onChange).toHaveBeenCalledWith({ startDate: "2026-09-05", endDate: "2026-09-10" });
  });

  it("clears both dates when 'すべて' is pressed while filtering", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <DateRangeFilterSection
        testIDPrefix="todos-period"
        startDate="2026-09-01"
        endDate="2026-09-10"
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("todos-period-all"));

    expect(onChange).toHaveBeenCalledWith({ startDate: null, endDate: null });
  });
});
