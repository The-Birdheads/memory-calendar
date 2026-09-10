import { fireEvent, render } from "@testing-library/react-native";

import { CalendarSwitchChip } from "../CalendarSwitchChip";
import type { Calendar } from "../../types";

const CALENDAR: Calendar = {
  id: "cal-1",
  name: "我が家",
  kind: "group",
  color: "#2f6fed",
  createdBy: "user-1",
  createdAt: "2026-08-17T00:00:00.000Z",
};

describe("CalendarSwitchChip", () => {
  it("renders the calendar's name", async () => {
    const { getByText } = await render(
      <CalendarSwitchChip calendar={CALENDAR} isActive={false} onPress={jest.fn()} />
    );

    expect(getByText("我が家")).toBeTruthy();
  });

  it("shows a checkmark when active, and hides it when inactive", async () => {
    const { getByTestId, queryByTestId, rerender } = await render(
      <CalendarSwitchChip calendar={CALENDAR} isActive={false} onPress={jest.fn()} testID="chip-cal-1" />
    );

    expect(queryByTestId("chip-cal-1-check")).toBeNull();

    await rerender(<CalendarSwitchChip calendar={CALENDAR} isActive onPress={jest.fn()} testID="chip-cal-1" />);

    expect(getByTestId("chip-cal-1-check")).toBeTruthy();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <CalendarSwitchChip calendar={CALENDAR} isActive={false} onPress={onPress} testID="chip-cal-1" />
    );

    fireEvent.press(getByTestId("chip-cal-1"));

    expect(onPress).toHaveBeenCalled();
  });
});
