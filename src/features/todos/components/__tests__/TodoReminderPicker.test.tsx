import { fireEvent, render } from "@testing-library/react-native";

import { TodoReminderPicker } from "../TodoReminderPicker";
import { computeEventReminderAt } from "../../../events/reminderCompute";

const EVENT_START_AT = "2026-09-10T01:00:00.000Z"; // 2026-09-10 10:00 JST

describe("TodoReminderPicker", () => {
  it("shows the all-day options (当日/1日前/2日前) when isAllDay is true", async () => {
    const { getByText, queryByText } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay
        eventStartAt={EVENT_START_AT}
        reminderAt={null}
        onChange={jest.fn()}
      />
    );

    expect(getByText("当日")).toBeTruthy();
    expect(getByText("1日前")).toBeTruthy();
    expect(getByText("2日前")).toBeTruthy();
    expect(queryByText("開始時")).toBeNull();
  });

  it("shows the timed options (開始時/10分前/1時間前) when isAllDay is false", async () => {
    const { getByText, queryByText } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={null}
        onChange={jest.fn()}
      />
    );

    expect(getByText("開始時")).toBeTruthy();
    expect(getByText("10分前")).toBeTruthy();
    expect(getByText("1時間前")).toBeTruthy();
    expect(queryByText("当日")).toBeNull();
  });

  it("marks the option matching the current reminderAt as checked", async () => {
    const candidate = computeEventReminderAt("before_10m", EVENT_START_AT);
    const { getByTestId, queryByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={candidate}
        onChange={jest.fn()}
      />
    );

    expect(getByTestId("todo-reminder-option-before_10m-checked")).toBeTruthy();
    expect(queryByTestId("todo-reminder-option-before_1h-checked")).toBeNull();
  });

  it("calls onChange with the computed absolute time when an unchecked option is pressed", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={null}
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("todo-reminder-option-before_1h"));

    expect(onChange).toHaveBeenCalledWith(computeEventReminderAt("before_1h", EVENT_START_AT));
  });

  it("calls onChange with null (clears) when the already-checked option is pressed again", async () => {
    const onChange = jest.fn();
    const candidate = computeEventReminderAt("before_1h", EVENT_START_AT);
    const { getByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={candidate}
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("todo-reminder-option-before_1h"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("selecting a new option replaces the previous one (single-select, unlike the event picker's multi-select)", async () => {
    const onChange = jest.fn();
    const previous = computeEventReminderAt("before_1h", EVENT_START_AT);
    const { getByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={previous}
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("todo-reminder-option-before_10m"));

    expect(onChange).toHaveBeenCalledWith(computeEventReminderAt("before_10m", EVENT_START_AT));
  });

  it("opens a value/unit wheel picker when 「カスタム時刻...」 is pressed, defaulting to 10分", async () => {
    const { getByTestId, queryByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={null}
        onChange={jest.fn()}
      />
    );

    expect(queryByTestId("todo-reminder-custom-value-picker")).toBeNull();

    await fireEvent.press(getByTestId("todo-reminder-option-custom"));

    expect(getByTestId("todo-reminder-custom-value-picker")).toBeTruthy();
    expect(getByTestId("todo-reminder-custom-unit-picker")).toBeTruthy();
  });

  it("calls onChange with the computed custom time when confirmed, and closes the picker", async () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={null}
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("todo-reminder-option-custom"));
    await fireEvent.press(getByTestId("todo-reminder-custom-value-picker-option-3"));
    await fireEvent.press(getByTestId("todo-reminder-custom-unit-picker-option-day"));
    await fireEvent.press(getByTestId("todo-reminder-custom-picker-confirm"));

    expect(onChange).toHaveBeenCalledWith(computeEventReminderAt("custom", EVENT_START_AT, { value: 3, unit: "day" }));
    expect(queryByTestId("todo-reminder-custom-value-picker")).toBeNull();
  });

  it("shows the current reminder as a checked custom row (with its formatted time) when it doesn't match any preset", async () => {
    const customValue = computeEventReminderAt("custom", EVENT_START_AT, { value: 3, unit: "day" });
    const { getByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={customValue}
        onChange={jest.fn()}
      />
    );

    expect(getByTestId("todo-reminder-custom-current-checked")).toBeTruthy();
  });

  it("clears the reminder when the custom current row is pressed", async () => {
    const onChange = jest.fn();
    const customValue = computeEventReminderAt("custom", EVENT_START_AT, { value: 3, unit: "day" });
    const { getByTestId } = await render(
      <TodoReminderPicker
        testIDPrefix="todo-reminder"
        isAllDay={false}
        eventStartAt={EVENT_START_AT}
        reminderAt={customValue}
        onChange={onChange}
      />
    );

    await fireEvent.press(getByTestId("todo-reminder-custom-current"));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
