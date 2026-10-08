import { fireEvent, render } from "@testing-library/react-native";

import { MealNotificationBell } from "../MealNotificationBell";
import { useAuthSession } from "../../../auth/hooks";
import { useMealNotificationSettings } from "../../notificationHooks";
import { DEFAULT_MEAL_NOTIFICATION_SETTINGS } from "../../notificationSettings";

jest.mock("../../../auth/hooks", () => ({ useAuthSession: jest.fn() }));
jest.mock("../../notificationHooks", () => ({ useMealNotificationSettings: jest.fn() }));
jest.mock("@react-native-community/datetimepicker", () => () => null);

const flatten = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

function mockSettings(enabled: boolean, update = jest.fn().mockResolvedValue(true)) {
  (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false });
  (useMealNotificationSettings as jest.Mock).mockReturnValue({
    settings: { ...DEFAULT_MEAL_NOTIFICATION_SETTINGS, enabled },
    isLoading: false,
    error: null,
    update,
  });
  return update;
}

describe("MealNotificationBell", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the signed-in user's settings", async () => {
    mockSettings(false);

    await render(<MealNotificationBell />);

    expect(useMealNotificationSettings).toHaveBeenCalledWith("user-1");
  });

  it("shows a bell in the neutral dark gray while notifications are off", async () => {
    mockSettings(false);

    const { getByTestId } = await render(<MealNotificationBell />);

    expect(flatten(getByTestId("meals-notification-icon").props.style).tintColor).toBe("#444");
  });

  it("turns the bell blue while notifications are on, so it's obvious they are active", async () => {
    mockSettings(true);

    const { getByTestId } = await render(<MealNotificationBell />);

    expect(flatten(getByTestId("meals-notification-icon").props.style).tintColor).toBe("#2f6fed");
  });

  it("opens the 献立の通知 settings when the bell is pressed, and closes it again", async () => {
    mockSettings(false);

    const { getByTestId, getByText, queryByText } = await render(<MealNotificationBell />);
    expect(queryByText("献立の通知")).toBeNull();

    await fireEvent.press(getByTestId("meals-notification-button"));
    expect(getByText("献立の通知")).toBeTruthy();

    await fireEvent.press(getByTestId("meal-notify-close"));
    expect(queryByText("献立の通知")).toBeNull();
  });

  it("saves changes made in the settings, and the bell follows the saved state", async () => {
    const update = mockSettings(false);

    const { getByTestId } = await render(<MealNotificationBell />);
    await fireEvent.press(getByTestId("meals-notification-button"));
    await fireEvent.press(getByTestId("meal-notify-master"));

    expect(update).toHaveBeenCalledWith({ ...DEFAULT_MEAL_NOTIFICATION_SETTINGS, enabled: true });
  });
});
