import { fireEvent, render, waitFor } from "@testing-library/react-native";

import MealsScreen from "../../app/(tabs)/meals";
import { useMyCalendars } from "../../src/features/calendars/hooks";
import { getSupabaseClient } from "../../src/shared/api/supabaseClient";
import { createFakeSupabaseClient } from "../testUtils/fakeSupabaseClient";

jest.mock("../../src/shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

// meals/hooks (useMealRecords, useCreateMealRecord, ...) are intentionally left
// un-mocked so the real hook -> service -> Supabase client chain is exercised.

const CALENDARS = [{ id: "cal-1", name: "我が家", createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" }];

describe("13.4 献立記録フローの検証", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-18T12:00:00.000Z"));
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("registers a future-dated meal record and shows it in the 食べる予定 list", async () => {
    const fakeClient = createFakeSupabaseClient();
    (getSupabaseClient as jest.Mock).mockReturnValue(fakeClient);

    const { getByTestId, queryByDisplayValue } = await render(<MealsScreen />);

    expect(queryByDisplayValue("から揚げ")).toBeNull();

    await fireEvent.changeText(getByTestId("meal-create-title-input"), "から揚げ");
    await fireEvent.changeText(getByTestId("meal-create-date-input"), "2026-09-01");
    await fireEvent.press(getByTestId("meal-create-slot-dinner"));
    await fireEvent.press(getByTestId("meal-create-submit"));

    await waitFor(() => expect(fakeClient.getTable("meal_records")).toHaveLength(1));
    const created = fakeClient.getTable("meal_records")[0];
    expect(created).toMatchObject({
      calendar_id: "cal-1",
      meal_date: "2026-09-01",
      slot: "dinner",
      title: "から揚げ",
    });
    await waitFor(() => expect(getByTestId(`meal-item-${created.id}`)).toBeTruthy());
    expect(queryByDisplayValue("から揚げ")).toBeTruthy();
  });
});
