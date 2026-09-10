import { fireEvent, render } from "@testing-library/react-native";

import { EventReminderPicker } from "../EventReminderPicker";
import type { EventReminder } from "../../types";

function reminder(
  kind: EventReminder["kind"],
  custom: { id?: string; value: number; unit: EventReminder["customUnit"] } | null = null
): EventReminder {
  return {
    id: custom?.id ?? `reminder-${kind}`,
    eventId: "event-1",
    userId: "user-1",
    kind,
    customValue: custom?.value ?? null,
    customUnit: custom?.unit ?? null,
    remindAt: "2026-09-06T00:00:00.000Z",
  };
}

describe("EventReminderPicker", () => {
  it("shows the all-day options (当日/1日前/2日前) when isAllDay is true", async () => {
    const { getByText, queryByText } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay reminders={[]} onAdd={jest.fn()} onRemove={jest.fn()} />
    );

    expect(getByText("当日")).toBeTruthy();
    expect(getByText("1日前")).toBeTruthy();
    expect(getByText("2日前")).toBeTruthy();
    expect(queryByText("開始時")).toBeNull();
    expect(queryByText("10分前")).toBeNull();
    expect(queryByText("1時間前")).toBeNull();
  });

  it("shows the timed options (開始時/10分前/1時間前) when isAllDay is false", async () => {
    const { getByText, queryByText } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay={false} reminders={[]} onAdd={jest.fn()} onRemove={jest.fn()} />
    );

    expect(getByText("開始時")).toBeTruthy();
    expect(getByText("10分前")).toBeTruthy();
    expect(getByText("1時間前")).toBeTruthy();
    expect(queryByText("当日")).toBeNull();
  });

  it("marks options present in `reminders` as checked", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventReminderPicker
        testIDPrefix="event-reminder"
        isAllDay
        reminders={[reminder("on_day")]}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    expect(getByTestId("event-reminder-option-on_day-checked")).toBeTruthy();
    expect(queryByTestId("event-reminder-option-day_before_1-checked")).toBeNull();
  });

  it("calls onAdd when an unchecked option is pressed", async () => {
    const onAdd = jest.fn();
    const { getByTestId } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay reminders={[]} onAdd={onAdd} onRemove={jest.fn()} />
    );

    await fireEvent.press(getByTestId("event-reminder-option-day_before_1"));

    expect(onAdd).toHaveBeenCalledWith("day_before_1");
  });

  it("calls onRemove with the matching reminder when an already-checked option is pressed", async () => {
    const onRemove = jest.fn();
    const existing = reminder("on_day");
    const { getByTestId } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay reminders={[existing]} onAdd={jest.fn()} onRemove={onRemove} />
    );

    await fireEvent.press(getByTestId("event-reminder-option-on_day"));

    expect(onRemove).toHaveBeenCalledWith(existing);
  });

  it("always shows a 「カスタム時刻...」 row to add another custom reminder", async () => {
    const { getByText } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay reminders={[]} onAdd={jest.fn()} onRemove={jest.fn()} />
    );

    expect(getByText("カスタム時刻...")).toBeTruthy();
  });

  it("opens a value/unit wheel picker when 「カスタム時刻...」 is pressed, defaulting to 10分", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay={false} reminders={[]} onAdd={jest.fn()} onRemove={jest.fn()} />
    );

    expect(queryByTestId("event-reminder-custom-value-picker")).toBeNull();

    await fireEvent.press(getByTestId("event-reminder-option-custom"));

    expect(getByTestId("event-reminder-custom-value-picker")).toBeTruthy();
    expect(getByTestId("event-reminder-custom-unit-picker")).toBeTruthy();
    expect(getByTestId("event-reminder-custom-value-picker-option-10")).toBeTruthy();
    expect(getByTestId("event-reminder-custom-unit-picker-option-minute")).toBeTruthy();
  });

  it("offers values 1 through 24 regardless of the selected unit", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay={false} reminders={[]} onAdd={jest.fn()} onRemove={jest.fn()} />
    );

    await fireEvent.press(getByTestId("event-reminder-option-custom"));

    expect(getByTestId("event-reminder-custom-value-picker-option-1")).toBeTruthy();
    expect(getByTestId("event-reminder-custom-value-picker-option-24")).toBeTruthy();
    expect(queryByTestId("event-reminder-custom-value-picker-option-25")).toBeNull();
    expect(getByTestId("event-reminder-custom-unit-picker-option-week")).toBeTruthy();
  });

  it("adds a custom reminder with the picked value and unit when confirmed", async () => {
    const onAdd = jest.fn();
    const { getByTestId } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay={false} reminders={[]} onAdd={onAdd} onRemove={jest.fn()} />
    );

    await fireEvent.press(getByTestId("event-reminder-option-custom"));
    await fireEvent.press(getByTestId("event-reminder-custom-value-picker-option-3"));
    await fireEvent.press(getByTestId("event-reminder-custom-unit-picker-option-day"));
    await fireEvent.press(getByTestId("event-reminder-custom-picker-confirm"));

    expect(onAdd).toHaveBeenCalledWith("custom", { value: 3, unit: "day" });
  });

  it("closes the custom picker after confirming", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventReminderPicker testIDPrefix="event-reminder" isAllDay={false} reminders={[]} onAdd={jest.fn()} onRemove={jest.fn()} />
    );

    await fireEvent.press(getByTestId("event-reminder-option-custom"));
    await fireEvent.press(getByTestId("event-reminder-custom-picker-confirm"));

    expect(queryByTestId("event-reminder-custom-value-picker")).toBeNull();
  });

  it("shows each existing custom reminder as its own checked row, above the 「カスタム時刻...」 row, and removes it when pressed again", async () => {
    const onRemove = jest.fn();
    const customA = reminder("custom", { id: "reminder-custom-a", value: 30, unit: "minute" });
    const customB = reminder("custom", { id: "reminder-custom-b", value: 2, unit: "day" });
    const { getByText, getByTestId, toJSON } = await render(
      <EventReminderPicker
        testIDPrefix="event-reminder"
        isAllDay={false}
        reminders={[customA, customB]}
        onAdd={jest.fn()}
        onRemove={onRemove}
      />
    );

    expect(getByText("30分前")).toBeTruthy();
    expect(getByText("2日前")).toBeTruthy();
    expect(getByTestId("event-reminder-custom-reminder-custom-a-checked")).toBeTruthy();
    expect(getByTestId("event-reminder-custom-reminder-custom-b-checked")).toBeTruthy();

    const tree = JSON.stringify(toJSON());
    const customBIndex = tree.indexOf("30分前");
    const addTriggerIndex = tree.indexOf("カスタム時刻...");
    expect(customBIndex).toBeGreaterThan(-1);
    expect(customBIndex).toBeLessThan(addTriggerIndex);

    await fireEvent.press(getByTestId("event-reminder-custom-reminder-custom-a"));

    expect(onRemove).toHaveBeenCalledWith(customA);
  });
});
