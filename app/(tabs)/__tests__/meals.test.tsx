import { fireEvent, render, waitFor } from "@testing-library/react-native";

import MealsScreen from "../meals";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import {
  useCreateMealRecord,
  useDeleteMealRecord,
  useMealRecords,
  useUpdateMealRecord,
} from "../../../src/features/meals/hooks";

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/meals/hooks", () => ({
  useMealRecords: jest.fn(),
  useCreateMealRecord: jest.fn(),
  useUpdateMealRecord: jest.fn(),
  useDeleteMealRecord: jest.fn(),
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

const CALENDARS = [
  { id: "cal-1", name: "我が家", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
  { id: "cal-2", name: "友人グループ", createdBy: "user-2", createdAt: "2026-08-17T01:00:00.000Z" },
];

const RECORDS = [
  { id: "meal-1", calendarId: "cal-1", mealDate: "2026-08-10", slot: "breakfast", title: "トースト", rating: 4, url: null, memo: null, createdBy: "user-1" },
  { id: "meal-2", calendarId: "cal-1", mealDate: "2026-08-25", slot: "dinner", title: "カレー", rating: null, url: "https://example.com/curry", memo: "スパイスから作る", createdBy: "user-2" },
];

function mockCommonHooks(mealRecords: typeof RECORDS, refetch = jest.fn()) {
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
  (useMealRecords as jest.Mock).mockReturnValue({ mealRecords, isLoading: false, error: null, refetch });
  (useCreateMealRecord as jest.Mock).mockReturnValue({ createMealRecord: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useUpdateMealRecord as jest.Mock).mockReturnValue({ updateMealRecord: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useDeleteMealRecord as jest.Mock).mockReturnValue({ deleteMealRecord: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
}

describe("MealsScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-18T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("shows records separated into 食べる予定 (future) and 食べたもの (past) sections", async () => {
    mockCommonHooks(RECORDS);

    const { getByText, getByTestId } = await render(<MealsScreen />);

    expect(getByText("食べたもの")).toBeTruthy();
    expect(getByText("食べる予定")).toBeTruthy();
    expect(getByTestId("meal-item-meal-1")).toBeTruthy();
    expect(getByTestId("meal-item-meal-2")).toBeTruthy();
  });

  it("shows the date and meal slot together", async () => {
    mockCommonHooks(RECORDS);

    const { getByText } = await render(<MealsScreen />);

    expect(getByText("2026/08/10 朝食")).toBeTruthy();
    expect(getByText("2026/08/25 夕食")).toBeTruthy();
  });

  it("shows a 🔗/📝 icon (not the raw text) when a url/memo is set, and neither when absent", async () => {
    mockCommonHooks(RECORDS);

    const { getByTestId, queryByTestId, queryByText } = await render(<MealsScreen />);

    // meal-2 has both a url and a memo.
    expect(getByTestId("meal-url-icon-meal-2")).toBeTruthy();
    expect(getByTestId("meal-memo-icon-meal-2")).toBeTruthy();
    expect(queryByText("https://example.com/curry")).toBeNull();
    expect(queryByText("スパイスから作る")).toBeNull();

    // meal-1 has neither.
    expect(queryByTestId("meal-url-icon-meal-1")).toBeNull();
    expect(queryByTestId("meal-memo-icon-meal-1")).toBeNull();
  });

  it("shows a calendar switcher and updates the list when switched", async () => {
    mockCommonHooks([]);

    const { getByTestId } = await render(<MealsScreen />);

    expect(getByTestId("meals-calendar-switch-cal-1")).toBeTruthy();
    expect(getByTestId("meals-calendar-switch-cal-2")).toBeTruthy();

    await fireEvent.press(getByTestId("meals-calendar-switch-cal-2"));

    await waitFor(() => expect(useMealRecords).toHaveBeenLastCalledWith("cal-2"));
  });

  it("opens a detail modal from the 詳細 button, not an always-visible save button", async () => {
    mockCommonHooks(RECORDS);

    const { getByTestId, queryByTestId } = await render(<MealsScreen />);

    expect(queryByTestId("meal-edit-title-input-meal-1")).toBeNull();

    await fireEvent.press(getByTestId("meal-details-meal-1"));

    expect(getByTestId("meal-edit-title-input-meal-1")).toBeTruthy();
  });

  it("shows the meal's date+slot and lets the caller edit title/url/memo from the detail modal, then refetches", async () => {
    const refetch = jest.fn();
    mockCommonHooks(RECORDS, refetch);
    const updateMealRecordMock = jest.fn().mockResolvedValue(true);
    (useUpdateMealRecord as jest.Mock).mockReturnValue({ updateMealRecord: updateMealRecordMock, isSubmitting: false, error: null });

    const { getByTestId, getAllByText } = await render(<MealsScreen />);

    await fireEvent.press(getByTestId("meal-details-meal-1"));

    expect(getAllByText("2026/08/10 朝食").length).toBeGreaterThan(0);

    await fireEvent.changeText(getByTestId("meal-edit-title-input-meal-1"), "トーストとコーヒー");
    await fireEvent.changeText(getByTestId("meal-edit-url-input-meal-1"), "https://example.com/toast");
    await fireEvent.changeText(getByTestId("meal-edit-memo-input-meal-1"), "バターたっぷり");
    await fireEvent.press(getByTestId("meal-edit-save-meal-1"));

    await waitFor(() =>
      expect(updateMealRecordMock).toHaveBeenCalledWith("meal-1", {
        title: "トーストとコーヒー",
        url: "https://example.com/toast",
        memo: "バターたっぷり",
      })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("closes the detail modal without saving when cancelled", async () => {
    mockCommonHooks(RECORDS);
    const updateMealRecordMock = jest.fn().mockResolvedValue(true);
    (useUpdateMealRecord as jest.Mock).mockReturnValue({ updateMealRecord: updateMealRecordMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<MealsScreen />);

    await fireEvent.press(getByTestId("meal-details-meal-1"));
    await fireEvent.press(getByTestId("meal-edit-cancel-meal-1"));

    expect(updateMealRecordMock).not.toHaveBeenCalled();
    expect(queryByTestId("meal-edit-title-input-meal-1")).toBeNull();
  });

  it("deletes a meal record and refetches so it disappears from the list", async () => {
    const refetch = jest.fn();
    mockCommonHooks(RECORDS, refetch);
    const deleteMealRecordMock = jest.fn().mockResolvedValue(true);
    (useDeleteMealRecord as jest.Mock).mockReturnValue({ deleteMealRecord: deleteMealRecordMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<MealsScreen />);

    await fireEvent.press(getByTestId("meal-delete-meal-1"));

    await waitFor(() => expect(deleteMealRecordMock).toHaveBeenCalledWith("meal-1"));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("creates a meal record with a title only", async () => {
    const refetch = jest.fn();
    mockCommonHooks(RECORDS, refetch);
    const createMealRecordMock = jest.fn().mockResolvedValue(true);
    (useCreateMealRecord as jest.Mock).mockReturnValue({
      createMealRecord: createMealRecordMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<MealsScreen />);

    await fireEvent.changeText(getByTestId("meal-create-title-input"), "から揚げ");
    await fireEvent.press(getByTestId("meal-create-date-button"));
    await fireEvent.changeText(getByTestId("meal-create-date-picker"), "2026-09-01T00:00:00.000Z");
    await fireEvent.press(getByTestId("meal-create-date-picker-done"));
    await fireEvent.press(getByTestId("meal-create-slot-dinner"));
    await fireEvent.press(getByTestId("meal-create-submit"));

    await waitFor(() =>
      expect(createMealRecordMock).toHaveBeenCalledWith({
        calendarId: "cal-1",
        mealDate: "2026-09-01",
        slot: "dinner",
        title: "から揚げ",
      })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("creates a meal record with a url and memo when provided", async () => {
    mockCommonHooks(RECORDS);
    const createMealRecordMock = jest.fn().mockResolvedValue(true);
    (useCreateMealRecord as jest.Mock).mockReturnValue({
      createMealRecord: createMealRecordMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<MealsScreen />);

    await fireEvent.changeText(getByTestId("meal-create-title-input"), "から揚げ");
    await fireEvent.changeText(getByTestId("meal-create-url-input"), "https://example.com/karaage");
    await fireEvent.changeText(getByTestId("meal-create-memo-input"), "二度揚げする");
    await fireEvent.press(getByTestId("meal-create-submit"));

    await waitFor(() =>
      expect(createMealRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "から揚げ",
          url: "https://example.com/karaage",
          memo: "二度揚げする",
        })
      )
    );
  });
});
