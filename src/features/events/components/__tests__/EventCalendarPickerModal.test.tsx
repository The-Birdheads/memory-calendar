import { fireEvent, render } from "@testing-library/react-native";

import { EventCalendarPickerModal } from "../EventCalendarPickerModal";
import type { Calendar } from "../../../calendars/types";

function calendar(id: string, name: string, kind: Calendar["kind"] = "group"): Calendar {
  return { id, name, kind, color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" };
}

const CALENDARS = [calendar("cal-1", "我が家"), calendar("cal-2", "友人グループ"), calendar("cal-3", "Myカレンダー", "personal")];

describe("EventCalendarPickerModal", () => {
  it("renders nothing when not visible", async () => {
    const { queryByTestId } = await render(
      <EventCalendarPickerModal
        visible={false}
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(queryByTestId("event-calendar-picker-confirm")).toBeNull();
  });

  it("lists every calendar and marks the current one as checked", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventCalendarPickerModal
        visible
        calendars={CALENDARS}
        currentCalendarId="cal-2"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(getByTestId("event-calendar-picker-option-cal-1")).toBeTruthy();
    expect(getByTestId("event-calendar-picker-option-cal-2")).toBeTruthy();
    expect(getByTestId("event-calendar-picker-option-cal-3")).toBeTruthy();
    expect(getByTestId("event-calendar-picker-option-cal-2-checked")).toBeTruthy();
    expect(queryByTestId("event-calendar-picker-option-cal-1-checked")).toBeNull();
  });

  it("selecting a different row and confirming calls onConfirm with that calendar", async () => {
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <EventCalendarPickerModal
        visible
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));
    await fireEvent.press(getByTestId("event-calendar-picker-confirm"));

    expect(onConfirm).toHaveBeenCalledWith(CALENDARS[1]);
  });

  it("confirming without changing the selection calls onCancel instead of onConfirm", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <EventCalendarPickerModal
        visible
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await fireEvent.press(getByTestId("event-calendar-picker-confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("re-selecting a row and then the original again still confirms as a no-op", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <EventCalendarPickerModal
        visible
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));
    await fireEvent.press(getByTestId("event-calendar-picker-option-cal-1"));
    await fireEvent.press(getByTestId("event-calendar-picker-confirm"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the close button or backdrop is pressed", async () => {
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <EventCalendarPickerModal
        visible
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );

    await fireEvent.press(getByTestId("event-calendar-picker-close"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByTestId("event-calendar-picker-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("resets the selection back to the current calendar each time it reopens", async () => {
    const onConfirm = jest.fn();
    const { getByTestId, rerender } = await render(
      <EventCalendarPickerModal
        visible
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));

    await rerender(
      <EventCalendarPickerModal
        visible={false}
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    await rerender(
      <EventCalendarPickerModal
        visible
        calendars={CALENDARS}
        currentCalendarId="cal-1"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    expect(getByTestId("event-calendar-picker-option-cal-1-checked")).toBeTruthy();
  });
});
