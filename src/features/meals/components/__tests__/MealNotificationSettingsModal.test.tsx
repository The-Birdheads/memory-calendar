import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { MealNotificationSettingsModal } from "../MealNotificationSettingsModal";
import { DEFAULT_MEAL_NOTIFICATION_SETTINGS, type MealNotificationSettings } from "../../notificationSettings";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return function MockTimePicker({ testID, onChange, locale, mode }: any) {
    return React.createElement(TextInput, {
      testID,
      locale,
      mode,
      // The test types a "HH:MM" string; the mock turns it into a Date like the native picker would.
      onChangeText: (text: string) => {
        const [h, m] = text.split(":").map(Number);
        const date = new Date();
        date.setHours(h, m, 0, 0);
        onChange({ type: "set" }, date);
      },
    });
  };
});

const ON: MealNotificationSettings = { ...DEFAULT_MEAL_NOTIFICATION_SETTINGS, enabled: true };

function renderModal(settings: MealNotificationSettings, overrides: Partial<{ onChange: jest.Mock; onClose: jest.Mock }> = {}) {
  const onChange = overrides.onChange ?? jest.fn();
  const onClose = overrides.onClose ?? jest.fn();
  const utils = render(<MealNotificationSettingsModal visible settings={settings} onChange={onChange} onClose={onClose} />);
  return { onChange, onClose, utils };
}

describe("MealNotificationSettingsModal", () => {
  it("renders nothing while not visible", async () => {
    const { queryByTestId } = await render(
      <MealNotificationSettingsModal visible={false} settings={ON} onChange={jest.fn()} onClose={jest.fn()} />
    );

    expect(queryByTestId("meal-notify-master")).toBeNull();
  });

  it("shows only the master '予定に登録した献立の通知' switch while it is off", async () => {
    const { utils } = renderModal(DEFAULT_MEAL_NOTIFICATION_SETTINGS);
    const { getByText, getByTestId, queryByTestId } = await utils;

    expect(getByText("献立の通知")).toBeTruthy();
    expect(getByText("予定に登録した献立の通知")).toBeTruthy();
    expect(getByTestId("meal-notify-master").props.accessibilityState).toMatchObject({ checked: false });
    expect(queryByTestId("meal-notify-slot-breakfast")).toBeNull();
    expect(queryByTestId("meal-notify-time-breakfast")).toBeNull();
  });

  it("turns the master on via onChange, keeping the other settings", async () => {
    const { onChange, utils } = renderModal(DEFAULT_MEAL_NOTIFICATION_SETTINGS);
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("meal-notify-master"));

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_MEAL_NOTIFICATION_SETTINGS, enabled: true });
  });

  it("shows a switch for each of 朝食/昼食/夕食/間食 once the master is on, with each enabled slot's time", async () => {
    const { utils } = renderModal(ON);
    const { getByText, getByTestId } = await utils;

    for (const slot of ["breakfast", "lunch", "dinner", "snack"]) {
      expect(getByTestId(`meal-notify-slot-${slot}`)).toBeTruthy();
    }
    for (const label of ["朝食", "昼食", "夕食", "間食"]) {
      expect(getByText(label)).toBeTruthy();
    }
    // Defaults: 8:00 / 12:00 / 18:00 / 15:00
    expect(getByTestId("meal-notify-time-breakfast-value").props.children).toBe("8:00");
    expect(getByTestId("meal-notify-time-lunch-value").props.children).toBe("12:00");
    expect(getByTestId("meal-notify-time-dinner-value").props.children).toBe("18:00");
    expect(getByTestId("meal-notify-time-snack-value").props.children).toBe("15:00");
  });

  it("hides a slot's time and reports it off when that slot's switch is turned off", async () => {
    const withSnackOff: MealNotificationSettings = {
      ...ON,
      slots: { ...ON.slots, snack: { ...ON.slots.snack, enabled: false } },
    };
    const { onChange, utils } = renderModal(withSnackOff);
    const { getByTestId, queryByTestId } = await utils;

    expect(queryByTestId("meal-notify-time-snack")).toBeNull();
    expect(getByTestId("meal-notify-time-lunch")).toBeTruthy();

    await fireEvent.press(getByTestId("meal-notify-slot-lunch"));

    expect(onChange).toHaveBeenCalledWith({
      ...withSnackOff,
      slots: { ...withSnackOff.slots, lunch: { ...withSnackOff.slots.lunch, enabled: false } },
    });
  });

  it("opens a Japanese time picker for the tapped slot, and applies the new time when 完了 is pressed", async () => {
    const { onChange, utils } = renderModal(ON);
    const { getByTestId, queryByTestId } = await utils;

    expect(queryByTestId("meal-notify-time-picker")).toBeNull();
    await fireEvent.press(getByTestId("meal-notify-time-breakfast"));

    const picker = getByTestId("meal-notify-time-picker");
    expect(picker.props.mode).toBe("time");
    expect(picker.props.locale).toBe("ja-JP");

    await fireEvent.changeText(picker, "07:30");
    expect(onChange).not.toHaveBeenCalled(); // nothing saved while spinning the wheel

    await fireEvent.press(getByTestId("meal-notify-time-done"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...ON,
      slots: { ...ON.slots, breakfast: { enabled: true, time: "07:30" } },
    });
    expect(queryByTestId("meal-notify-time-picker")).toBeNull();
  });

  it("does not call onChange when 完了 is pressed without changing the time", async () => {
    const { onChange, utils } = renderModal(ON);
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("meal-notify-time-dinner"));
    await fireEvent.press(getByTestId("meal-notify-time-done"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies a picked time even if the sheet is closed without pressing 完了", async () => {
    const { onChange, onClose, utils } = renderModal(ON);
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("meal-notify-time-lunch"));
    await fireEvent.changeText(getByTestId("meal-notify-time-picker"), "11:45");
    await fireEvent.press(getByTestId("meal-notify-close"));

    expect(onChange).toHaveBeenCalledWith({
      ...ON,
      slots: { ...ON.slots, lunch: { enabled: true, time: "11:45" } },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("applies the pending time first when another slot's time is tapped (one picker at a time)", async () => {
    const { onChange, utils } = renderModal(ON);
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("meal-notify-time-breakfast"));
    await fireEvent.changeText(getByTestId("meal-notify-time-picker"), "06:45");
    await fireEvent.press(getByTestId("meal-notify-time-dinner"));

    expect(onChange).toHaveBeenCalledWith({
      ...ON,
      slots: { ...ON.slots, breakfast: { enabled: true, time: "06:45" } },
    });
  });

  it("closes from the 閉じる button and from tapping the backdrop", async () => {
    const first = renderModal(ON);
    const a = await first.utils;
    await fireEvent.press(a.getByTestId("meal-notify-close"));
    expect(first.onClose).toHaveBeenCalledTimes(1);

    const second = renderModal(ON);
    const b = await second.utils;
    await fireEvent.press(b.getByTestId("meal-notify-backdrop"));
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it("explains when notifications are sent", async () => {
    const { utils } = renderModal(DEFAULT_MEAL_NOTIFICATION_SETTINGS);
    const { getByText } = await utils;

    expect(getByText("設定した時刻に、その日に予定した献立をお知らせします。")).toBeTruthy();
  });

  it("keeps the sheet below the status bar (clock/camera/Wi-Fi) by padding the top of its overlay with the safe-area inset", async () => {
    const { getByTestId } = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
        <MealNotificationSettingsModal visible settings={ON} onChange={jest.fn()} onClose={jest.fn()} />
      </SafeAreaInsetsContext.Provider>
    );

    const overlayStyle = StyleSheet.flatten(getByTestId("meal-notify-backdrop").props.style);
    expect(overlayStyle.paddingTop).toBeGreaterThanOrEqual(59);
  });
});
