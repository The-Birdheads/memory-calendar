import { fireEvent, render, waitFor } from "@testing-library/react-native";

import MealsScreen from "../../app/(tabs)/meals";
import { useMyCalendars } from "../../src/features/calendars/hooks";
import { getSupabaseClient } from "../../src/shared/api/supabaseClient";
import { createFakeSupabaseClient } from "../testUtils/fakeSupabaseClient";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: jest.fn() },
    Tabs: {
      Screen: ({ options }: any) =>
        React.createElement(React.Fragment, null, options?.headerLeft?.(), options?.headerRight?.()),
    },
    // Treats "focus" as "mount" for testing purposes, since there's no real
    // navigation container here to fire actual focus events.
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

jest.mock("../../src/shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

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

// meals/hooks (useMealRecords, useCreateMealRecord, ...) are intentionally left
// un-mocked so the real hook -> service -> Supabase client chain is exercised.

const CALENDARS = [{ id: "cal-1", name: "我が家", createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" }];

describe("13.4 献立記録フローの検証", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-18T12:00:00.000Z"));
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null, refetch: jest.fn() });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("registers a future-dated meal record and shows it in the 予定 panel", async () => {
    const fakeClient = createFakeSupabaseClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(fakeClient);

    const { getByTestId, queryByText } = await render(<MealsScreen />);

    expect(queryByText("から揚げ")).toBeNull();

    await fireEvent.press(getByTestId("meals-plan-add"));
    await fireEvent.changeText(getByTestId("meal-form-title-input"), "から揚げ");
    await fireEvent.press(getByTestId("meal-form-date-button"));
    await fireEvent.changeText(getByTestId("meal-form-date-picker"), "2026-09-01T00:00:00.000Z");
    await fireEvent.press(getByTestId("meal-form-date-picker-done"));
    await fireEvent.press(getByTestId("meal-form-slot-dinner"));
    await fireEvent.press(getByTestId("meal-form-save"));

    await waitFor(() => expect(fakeClient.getTable("meal_records")).toHaveLength(1));
    const created = fakeClient.getTable("meal_records")[0];
    expect(created).toMatchObject({
      calendar_id: "cal-1",
      meal_date: "2026-09-01",
      slot: "dinner",
      title: "から揚げ",
    });
    await waitFor(() => expect(getByTestId(`meal-item-${created.id}`)).toBeTruthy());
    expect(queryByText("から揚げ")).toBeTruthy();
  });
});
