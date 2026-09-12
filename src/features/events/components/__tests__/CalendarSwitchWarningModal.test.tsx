import { fireEvent, render } from "@testing-library/react-native";

import { CalendarSwitchWarningModal } from "../CalendarSwitchWarningModal";

describe("CalendarSwitchWarningModal", () => {
  it("renders nothing when not visible", async () => {
    const { queryByTestId } = await render(
      <CalendarSwitchWarningModal
        visible={false}
        fromKind="personal"
        fromName="Myカレンダー"
        toKind="group"
        toName="我が家"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(queryByTestId("event-calendar-switch-warning-confirm")).toBeNull();
  });

  it("shows only the sharing warning for personal -> group", async () => {
    const { getByTestId, queryByTestId } = await render(
      <CalendarSwitchWarningModal
        visible
        fromKind="personal"
        fromName="Myカレンダー"
        toKind="group"
        toName="我が家"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(getByTestId("event-calendar-switch-warning-message-0").props.children).toContain("「我が家」");
    expect(queryByTestId("event-calendar-switch-warning-message-1")).toBeNull();
  });

  it("shows both warnings for group -> a different group", async () => {
    const { getByTestId } = await render(
      <CalendarSwitchWarningModal
        visible
        fromKind="group"
        fromName="我が家"
        toKind="group"
        toName="友人グループ"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(getByTestId("event-calendar-switch-warning-message-0").props.children).toContain("「友人グループ」");
    expect(getByTestId("event-calendar-switch-warning-message-1").props.children).toContain("「我が家」");
  });

  it("calls onConfirm when OK is pressed", async () => {
    const onConfirm = jest.fn();
    const { getByTestId } = await render(
      <CalendarSwitchWarningModal
        visible
        fromKind="group"
        fromName="我が家"
        toKind="personal"
        toName="Myカレンダー"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("event-calendar-switch-warning-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when ✕ or the backdrop is pressed", async () => {
    const onCancel = jest.fn();
    const { getByTestId } = await render(
      <CalendarSwitchWarningModal
        visible
        fromKind="group"
        fromName="我が家"
        toKind="personal"
        toName="Myカレンダー"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );

    await fireEvent.press(getByTestId("event-calendar-switch-warning-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByTestId("event-calendar-switch-warning-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
