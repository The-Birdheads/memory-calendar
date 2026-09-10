import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";

import MealSearchScreen from "../meal-search";
import { useMyCalendars } from "../../src/features/calendars/hooks";
import { useDeleteMealRecord, useMealRecords, useUpdateMealRecord } from "../../src/features/meals/hooks";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: () => null },
}));

jest.mock("../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../src/features/meals/hooks", () => ({
  useMealRecords: jest.fn(),
  useUpdateMealRecord: jest.fn(),
  useDeleteMealRecord: jest.fn(),
}));

const CALENDARS = [
  { id: "cal-1", name: "我が家", kind: "group" as const, color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" },
];

const RECORDS = [
  { id: "meal-1", calendarId: "cal-1", mealDate: "2026-08-10", slot: "breakfast", title: "トースト", rating: 4, url: null, memo: null, createdBy: "user-1" },
  { id: "meal-2", calendarId: "cal-1", mealDate: "2026-08-25", slot: "dinner", title: "カレー", rating: null, url: "https://example.com/curry", memo: "スパイスから作る", createdBy: "user-2" },
  { id: "meal-3", calendarId: "cal-1", mealDate: "2026-08-30", slot: "lunch", title: "カレーうどん", rating: null, url: null, memo: null, createdBy: "user-1" },
];

function mockCommonHooks(mealRecords: typeof RECORDS = RECORDS, refetch = jest.fn()) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ calendarId: "cal-1" });
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null, refetch: jest.fn() });
  (useMealRecords as jest.Mock).mockReturnValue({ mealRecords, isLoading: false, error: null, refetch });
  (useUpdateMealRecord as jest.Mock).mockReturnValue({ updateMealRecord: jest.fn(), isSubmitting: false, error: null });
  (useDeleteMealRecord as jest.Mock).mockReturnValue({ deleteMealRecord: jest.fn(), isSubmitting: false, error: null });
}

describe("MealSearchScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows every meal record by default, using the same row as the 献立 tab", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(<MealSearchScreen />);

    expect(getByTestId("meal-item-meal-1")).toBeTruthy();
    expect(getByTestId("meal-item-meal-2")).toBeTruthy();
    expect(getByTestId("meal-item-meal-3")).toBeTruthy();
  });

  it("filters results by title as the query is typed", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

    await fireEvent.changeText(getByTestId("meal-search-input"), "カレー");

    expect(getByTestId("meal-item-meal-2")).toBeTruthy();
    expect(getByTestId("meal-item-meal-3")).toBeTruthy();
    expect(queryByTestId("meal-item-meal-1")).toBeNull();
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

    expect(getByTestId("meal-url-icon-meal-2")).toBeTruthy();
    expect(getByTestId("meal-memo-icon-meal-2")).toBeTruthy();
    expect(queryByTestId("meal-url-icon-meal-1")).toBeNull();
  });

  it("shows the record's rating (★) as a reference for browsing past meals, and nothing when unrated", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

    expect(getByTestId("meal-item-rating-meal-1-readonly-star-4").props.children).toBe("★");
    expect(queryByTestId("meal-item-rating-meal-2-readonly")).toBeNull();
  });

  it("shows an empty state when no records match the query", async () => {
    mockCommonHooks();

    const { getByTestId, getByText } = await render(<MealSearchScreen />);

    await fireEvent.changeText(getByTestId("meal-search-input"), "存在しない料理");

    expect(getByText("該当する献立がありません")).toBeTruthy();
  });

  describe("結果のタップで編集（献立タブの一覧と同じ挙動）", () => {
    it("opens the edit form pre-filled when a result is tapped", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-item-meal-2"));

      expect(getByTestId("meal-form-title-input").props.value).toBe("カレー");
      expect(getByTestId("meal-form-url-input").props.value).toBe("https://example.com/curry");
    });

    it("saves an edit and refetches the results", async () => {
      const refetch = jest.fn();
      mockCommonHooks(RECORDS, refetch);
      const updateMealRecordMock = jest.fn().mockResolvedValue(true);
      (useUpdateMealRecord as jest.Mock).mockReturnValue({
        updateMealRecord: updateMealRecordMock,
        isSubmitting: false,
        error: null,
      });

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-item-meal-1"));
      await fireEvent.changeText(getByTestId("meal-form-title-input"), "トースト（改）");
      await fireEvent.press(getByTestId("meal-form-save"));

      await waitFor(() =>
        expect(updateMealRecordMock).toHaveBeenCalledWith(
          "meal-1",
          expect.objectContaining({ title: "トースト（改）" })
        )
      );
      await waitFor(() => expect(refetch).toHaveBeenCalled());
      await waitFor(() => expect(queryByTestId("meal-form-title-input")).toBeNull());
    });

    it("deletes a record after confirming, closing the form and refetching", async () => {
      const refetch = jest.fn();
      mockCommonHooks(RECORDS, refetch);
      const deleteMealRecordMock = jest.fn().mockResolvedValue(true);
      (useDeleteMealRecord as jest.Mock).mockReturnValue({
        deleteMealRecord: deleteMealRecordMock,
        isSubmitting: false,
        error: null,
      });

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-item-meal-1"));
      await fireEvent.press(getByTestId("meal-form-delete"));
      await fireEvent.press(getByTestId("meal-form-delete-confirm"));

      await waitFor(() => expect(deleteMealRecordMock).toHaveBeenCalledWith("meal-1"));
      await waitFor(() => expect(refetch).toHaveBeenCalled());
      expect(queryByTestId("meal-form-title-input")).toBeNull();
    });
  });

  describe("評価での絞り込み", () => {
    it("keeps only records rated at or above the tapped star, excluding unrated records", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-search-min-rating-4"));

      expect(getByTestId("meal-item-meal-1")).toBeTruthy(); // rating: 4
      expect(queryByTestId("meal-item-meal-2")).toBeNull(); // rating: null
      expect(queryByTestId("meal-item-meal-3")).toBeNull(); // rating: null
    });

    it("clears the rating filter when the same star is tapped again", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-search-min-rating-4"));
      expect(queryByTestId("meal-item-meal-2")).toBeNull();

      await fireEvent.press(getByTestId("meal-search-min-rating-4"));
      expect(getByTestId("meal-item-meal-2")).toBeTruthy();
    });

    it("combines the rating filter with the title/slot filters already in place", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      await fireEvent.changeText(getByTestId("meal-search-input"), "トースト");
      await fireEvent.press(getByTestId("meal-search-min-rating-5"));

      // meal-1 (トースト) is rated 4, below the 5-star minimum.
      expect(queryByTestId("meal-item-meal-1")).toBeNull();
    });
  });

  describe("ランダムに選ぶ（何を食べるか思いつかない時の候補提示）", () => {
    let randomSpy: jest.SpyInstance;

    afterEach(() => {
      randomSpy?.mockRestore();
    });

    it("hides the random-pick button when there are no matching results", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      await fireEvent.changeText(getByTestId("meal-search-input"), "存在しない料理");

      expect(queryByTestId("meal-search-random-button")).toBeNull();
    });

    it("reveals one random result (from the currently filtered set) as a highlighted pick", async () => {
      mockCommonHooks();
      randomSpy = jest.spyOn(Math, "random").mockReturnValue(0); // 最初の候補(meal-1)を選ばせる

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      expect(queryByTestId("meal-search-random-pick")).toBeNull();

      await fireEvent.press(getByTestId("meal-search-random-button"));

      const pick = getByTestId("meal-search-random-pick");
      expect(within(pick).getByText("トースト")).toBeTruthy();
    });

    it("only picks from records matching the active filters", async () => {
      mockCommonHooks();
      randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);

      const { getByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-search-min-rating-4")); // meal-1のみに絞る
      await fireEvent.press(getByTestId("meal-search-random-button"));

      const pick = getByTestId("meal-search-random-pick");
      expect(within(pick).getByText("トースト")).toBeTruthy();
    });

    it("picks again (from the latest filtered set) when 'もう一度' is pressed", async () => {
      mockCommonHooks();
      // mockReturnValue (not -Once) so it stays deterministic even if
      // something incidental in the tree also calls Math.random() during a
      // render - every call returns the same fixed value until reassigned.
      randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);

      const { getByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-search-random-button"));
      expect(within(getByTestId("meal-search-random-pick")).getByText("トースト")).toBeTruthy(); // meal-1

      randomSpy.mockReturnValue(0.9);
      await fireEvent.press(getByTestId("meal-search-random-reroll"));
      expect(within(getByTestId("meal-search-random-pick")).getByText("カレーうどん")).toBeTruthy(); // meal-3
    });

    it("dismisses the pick without clearing the underlying results", async () => {
      mockCommonHooks();
      randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);

      const { getByTestId, queryByTestId } = await render(<MealSearchScreen />);

      await fireEvent.press(getByTestId("meal-search-random-button"));
      expect(getByTestId("meal-search-random-pick")).toBeTruthy();

      await fireEvent.press(getByTestId("meal-search-random-dismiss"));

      expect(queryByTestId("meal-search-random-pick")).toBeNull();
      expect(getByTestId("meal-item-meal-1")).toBeTruthy();
    });
  });
});
