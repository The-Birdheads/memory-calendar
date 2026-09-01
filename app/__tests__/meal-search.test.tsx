import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";

import MealSearchScreen from "../meal-search";
import { useMealRecords } from "../../src/features/meals/hooks";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: () => null },
}));

jest.mock("../../src/features/meals/hooks", () => ({
  useMealRecords: jest.fn(),
}));

const RECORDS = [
  { id: "meal-1", calendarId: "cal-1", mealDate: "2026-08-10", slot: "breakfast", title: "トースト", rating: 4, url: null, memo: null, createdBy: "user-1" },
  { id: "meal-2", calendarId: "cal-1", mealDate: "2026-08-25", slot: "dinner", title: "カレー", rating: null, url: "https://example.com/curry", memo: "スパイスから作る", createdBy: "user-2" },
  { id: "meal-3", calendarId: "cal-1", mealDate: "2026-08-30", slot: "lunch", title: "カレーうどん", rating: null, url: null, memo: null, createdBy: "user-1" },
];

function mockCommonHooks(mealRecords: typeof RECORDS = RECORDS) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ calendarId: "cal-1" });
  (useMealRecords as jest.Mock).mockReturnValue({ mealRecords, isLoading: false, error: null, refetch: jest.fn() });
}

describe("MealSearchScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows every meal record by default", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(<MealSearchScreen />);

    expect(getByTestId("meal-search-result-meal-1")).toBeTruthy();
    expect(getByTestId("meal-search-result-meal-2")).toBeTruthy();
    expect(getByTestId("meal-search-result-meal-3")).toBeTruthy();
  });

  it("filters results by title as the query is typed", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

    await fireEvent.changeText(getByTestId("meal-search-input"), "カレー");

    expect(getByTestId("meal-search-result-meal-2")).toBeTruthy();
    expect(getByTestId("meal-search-result-meal-3")).toBeTruthy();
    expect(queryByTestId("meal-search-result-meal-1")).toBeNull();
  });

  it("shows title suggestions matching the query, excluding an exact match", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

    await fireEvent.changeText(getByTestId("meal-search-input"), "カレーう");

    expect(getByTestId("meal-search-suggestion-カレーうどん")).toBeTruthy();

    await fireEvent.changeText(getByTestId("meal-search-input"), "カレーうどん");

    // Exact match no longer suggested (it's already fully typed).
    expect(queryByTestId("meal-search-suggestion-カレーうどん")).toBeNull();
  });

  it("fills the query when a suggestion is tapped", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(<MealSearchScreen />);

    await fireEvent.changeText(getByTestId("meal-search-input"), "カレー");
    await fireEvent.press(getByTestId("meal-search-suggestion-カレーうどん"));

    expect(getByTestId("meal-search-input").props.value).toBe("カレーうどん");
  });

  it("hides suggestions once the query is empty", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

    await fireEvent.changeText(getByTestId("meal-search-input"), "カレー");
    expect(queryByTestId("meal-search-suggestions")).toBeTruthy();

    await fireEvent.changeText(getByTestId("meal-search-input"), "");
    expect(queryByTestId("meal-search-suggestions")).toBeNull();
  });

  it("requests records filtered by the selected slot", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(<MealSearchScreen />);

    await fireEvent.press(getByTestId("meal-search-slot-lunch"));

    await waitFor(() => expect(useMealRecords).toHaveBeenLastCalledWith("cal-1", { slot: "lunch" }));

    await fireEvent.press(getByTestId("meal-search-slot-all"));

    await waitFor(() => expect(useMealRecords).toHaveBeenLastCalledWith("cal-1", undefined));
  });

  it("shows a 🔗/📝 icon per result when a url/memo is set", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

    expect(getByTestId("meal-search-result-url-icon-meal-2")).toBeTruthy();
    expect(getByTestId("meal-search-result-memo-icon-meal-2")).toBeTruthy();
    expect(queryByTestId("meal-search-result-url-icon-meal-1")).toBeNull();
  });

  it("shows an empty state when no records match the query", async () => {
    mockCommonHooks();

    const { getByTestId, getByText } = await render(<MealSearchScreen />);

    await fireEvent.changeText(getByTestId("meal-search-input"), "存在しない料理");

    expect(getByText("該当する献立がありません")).toBeTruthy();
  });
});
