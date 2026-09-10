import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import MealsScreen from "../meals";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import {
  useCreateMealRecord,
  useDeleteMealRecord,
  useMealRecordsByCalendars,
  useUpdateMealRecord,
} from "../../../src/features/meals/hooks";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: jest.fn() },
    Tabs: {
      Screen: ({ options }: any) => React.createElement(React.Fragment, null, options?.headerRight?.()),
    },
    // Treats "focus" as "mount" and "blur" as "unmount" for testing purposes,
    // since there's no real navigation container here to fire actual
    // focus/blur events - forwarding the callback's own return value keeps
    // its cleanup (used to reset the filter on leaving the panel) wired up
    // exactly like the real useFocusEffect does.
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/meals/hooks", () => ({
  useMealRecordsByCalendars: jest.fn(),
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

// システム時刻は2026-08-18T12:00:00.000Z(JSTで2026-08-18 21:00)に固定するので、
// 08-10は過去(記録)、08-25は未来(予定)に振り分けられる。
const RECORDS = [
  { id: "meal-1", calendarId: "cal-1", mealDate: "2026-08-10", slot: "breakfast", title: "トースト", rating: 4, url: null, memo: null, createdBy: "user-1" },
  { id: "meal-2", calendarId: "cal-1", mealDate: "2026-08-25", slot: "dinner", title: "カレー", rating: null, url: "https://example.com/curry", memo: "スパイスから作る", createdBy: "user-2" },
];

function mockCommonHooks(mealRecords: typeof RECORDS, refetch = jest.fn()) {
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null, refetch: jest.fn() });
  (useMealRecordsByCalendars as jest.Mock).mockReturnValue({ mealRecords, isLoading: false, error: null, refetch });
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

  it("shows the 予定/記録 mode switch, defaulting to 予定 (plan)", async () => {
    mockCommonHooks(RECORDS);

    const { getByTestId, queryByTestId } = await render(<MealsScreen />);

    expect(getByTestId("meals-mode-switch")).toBeTruthy();
    expect(getByTestId("meals-plan-add")).toBeTruthy();
    expect(queryByTestId("meals-log-add")).toBeNull();
  });

  it("switches to the 記録 (log) panel and back, resetting each panel's own calendar filter on the way", async () => {
    mockCommonHooks(RECORDS);

    const { getByTestId, queryByTestId } = await render(<MealsScreen />);

    await fireEvent.press(getByTestId("meals-mode-log"));

    expect(getByTestId("meals-log-add")).toBeTruthy();
    expect(queryByTestId("meals-plan-add")).toBeNull();

    await fireEvent.press(getByTestId("meals-mode-plan"));

    expect(getByTestId("meals-plan-add")).toBeTruthy();
  });

  describe("予定パネル (plan panel)", () => {
    it("shows only future records, grouped under a date header", async () => {
      mockCommonHooks(RECORDS);

      const { getByTestId, queryByTestId } = await render(<MealsScreen />);

      expect(getByTestId("meals-plan-date-group-2026-08-25")).toBeTruthy();
      expect(getByTestId("meal-item-meal-2")).toBeTruthy();
      expect(queryByTestId("meal-item-meal-1")).toBeNull();
    });

    it("shows an empty state with a hint to use the + button when there are no upcoming meals", async () => {
      mockCommonHooks([]);

      const { getByText } = await render(<MealsScreen />);

      expect(getByText("まだ献立の予定がありません")).toBeTruthy();
    });

    it("opens the create form (today, dinner by default) from the + button, and creates on save", async () => {
      const refetch = jest.fn();
      mockCommonHooks(RECORDS, refetch);
      const createMealRecordMock = jest.fn().mockResolvedValue(true);
      (useCreateMealRecord as jest.Mock).mockReturnValue({ createMealRecord: createMealRecordMock, isSubmitting: false, error: null });

      const { getByTestId, getByText } = await render(<MealsScreen />);

      await fireEvent.press(getByTestId("meals-plan-add"));

      expect(getByText("献立を追加")).toBeTruthy();
      expect(getByText("2026/08/18")).toBeTruthy(); // today, JST

      await fireEvent.changeText(getByTestId("meal-form-title-input"), "から揚げ");
      await fireEvent.press(getByTestId("meal-form-save"));

      await waitFor(() =>
        expect(createMealRecordMock).toHaveBeenCalledWith({
          calendarId: "cal-1",
          mealDate: "2026-08-18",
          slot: "dinner",
          title: "から揚げ",
          url: undefined,
          memo: undefined,
          rating: undefined,
        })
      );
      await waitFor(() => expect(refetch).toHaveBeenCalled());
    });

    it("shows which calendar a new meal is being added to, and lets it be changed before saving", async () => {
      const refetch = jest.fn();
      mockCommonHooks(RECORDS, refetch);
      const createMealRecordMock = jest.fn().mockResolvedValue(true);
      (useCreateMealRecord as jest.Mock).mockReturnValue({ createMealRecord: createMealRecordMock, isSubmitting: false, error: null });

      const { getByTestId } = await render(<MealsScreen />);

      await fireEvent.press(getByTestId("meals-plan-add"));

      expect(getByTestId("meal-form-calendar-picker")).toBeTruthy();

      await fireEvent.press(getByTestId("meal-form-calendar-cal-2"));
      await fireEvent.changeText(getByTestId("meal-form-title-input"), "から揚げ");
      await fireEvent.press(getByTestId("meal-form-save"));

      await waitFor(() => expect(createMealRecordMock).toHaveBeenCalledWith(expect.objectContaining({ calendarId: "cal-2" })));
    });

    it("opens the edit form (seeded with the record's own values) when a row is pressed, and updates on save", async () => {
      const refetch = jest.fn();
      mockCommonHooks(RECORDS, refetch);
      const updateMealRecordMock = jest.fn().mockResolvedValue(true);
      (useUpdateMealRecord as jest.Mock).mockReturnValue({ updateMealRecord: updateMealRecordMock, isSubmitting: false, error: null });

      const { getByTestId, getByText } = await render(<MealsScreen />);

      await fireEvent.press(getByTestId("meal-item-meal-2"));

      expect(getByText("献立の詳細")).toBeTruthy();
      expect(getByTestId("meal-form-title-input").props.value).toBe("カレー");

      await fireEvent.changeText(getByTestId("meal-form-title-input"), "スパイスカレー");
      await fireEvent.press(getByTestId("meal-form-save"));

      await waitFor(() =>
        expect(updateMealRecordMock).toHaveBeenCalledWith(
          "meal-2",
          expect.objectContaining({ title: "スパイスカレー", mealDate: "2026-08-25", slot: "dinner" })
        )
      );
      await waitFor(() => expect(refetch).toHaveBeenCalled());
    });

    it("deletes a record (after confirming) from the edit form, closing the form and refetching", async () => {
      const refetch = jest.fn();
      mockCommonHooks(RECORDS, refetch);
      const deleteMealRecordMock = jest.fn().mockResolvedValue(true);
      (useDeleteMealRecord as jest.Mock).mockReturnValue({ deleteMealRecord: deleteMealRecordMock, isSubmitting: false, error: null });

      const { getByTestId, queryByTestId } = await render(<MealsScreen />);

      await fireEvent.press(getByTestId("meal-item-meal-2"));
      await fireEvent.press(getByTestId("meal-form-delete"));
      await fireEvent.press(getByTestId("meal-form-delete-confirm"));

      await waitFor(() => expect(deleteMealRecordMock).toHaveBeenCalledWith("meal-2"));
      await waitFor(() => expect(refetch).toHaveBeenCalled());
      expect(queryByTestId("meal-form-title-input")).toBeNull();
    });

    it("closes the form without saving when cancelled", async () => {
      mockCommonHooks(RECORDS);
      const updateMealRecordMock = jest.fn().mockResolvedValue(true);
      (useUpdateMealRecord as jest.Mock).mockReturnValue({ updateMealRecord: updateMealRecordMock, isSubmitting: false, error: null });

      const { getByTestId, queryByTestId } = await render(<MealsScreen />);

      await fireEvent.press(getByTestId("meal-item-meal-2"));
      await fireEvent.press(getByTestId("meal-form-cancel"));

      expect(updateMealRecordMock).not.toHaveBeenCalled();
      expect(queryByTestId("meal-form-title-input")).toBeNull();
    });

    it("shows a calendar switcher (in the header filter sheet) defaulting to all calendars selected, toggling a calendar off/on to narrow the list", async () => {
      mockCommonHooks([]);

      const { getByTestId } = await render(<MealsScreen />);
      await fireEvent.press(getByTestId("meals-filter"));

      expect(getByTestId("meals-calendar-switch-cal-1")).toBeTruthy();
      expect(getByTestId("meals-calendar-switch-cal-2")).toBeTruthy();
      await waitFor(() => expect(useMealRecordsByCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"]));

      await fireEvent.press(getByTestId("meals-calendar-switch-cal-2"));
      await waitFor(() => expect(useMealRecordsByCalendars).toHaveBeenLastCalledWith(["cal-1"]));
    });

    it("navigates to 献立をさがす for the active calendar from the header search button, so inspiration is reachable while planning too", async () => {
      mockCommonHooks(RECORDS);

      const { getByTestId } = await render(<MealsScreen />);

      await fireEvent.press(getByTestId("meals-search-button"));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/meal-search",
        params: { calendarId: "cal-1" },
      });
    });

    it("uses the JST calendar day the picker shows, not a raw UTC slice (regression: date entered != date shown)", async () => {
      mockCommonHooks(RECORDS);
      const createMealRecordMock = jest.fn().mockResolvedValue(true);
      (useCreateMealRecord as jest.Mock).mockReturnValue({ createMealRecord: createMealRecordMock, isSubmitting: false, error: null });

      const { getByTestId } = await render(<MealsScreen />);

      await fireEvent.press(getByTestId("meals-plan-add"));
      await fireEvent.changeText(getByTestId("meal-form-title-input"), "朝ごはん");
      await fireEvent.press(getByTestId("meal-form-date-button"));
      // A real device picker, tapping "9/4" on a JST device, hands back this
      // exact instant (JST midnight Sept 4 == UTC 15:00 Sept 3) - a raw
      // `.toISOString().slice(0, 10)` would wrongly read "2026-09-03".
      await fireEvent.changeText(getByTestId("meal-form-date-picker"), "2026-09-03T15:00:00.000Z");
      await fireEvent.press(getByTestId("meal-form-date-picker-done"));
      await fireEvent.press(getByTestId("meal-form-save"));

      await waitFor(() =>
        expect(createMealRecordMock).toHaveBeenCalledWith(expect.objectContaining({ mealDate: "2026-09-04" }))
      );
    });
  });

  describe("記録パネル (log panel)", () => {
    async function renderLogPanel() {
      const utils = await render(<MealsScreen />);
      await fireEvent.press(utils.getByTestId("meals-mode-log"));
      return utils;
    }

    it("shows only past records, grouped under a month header then a date sub-header, most recent month first", async () => {
      mockCommonHooks(RECORDS);

      const { getByTestId, queryByTestId } = await renderLogPanel();

      expect(getByTestId("meals-log-month-group-2026-08")).toBeTruthy();
      expect(getByTestId("meals-log-date-group-2026-08-10")).toBeTruthy();
      expect(getByTestId("meal-item-meal-1")).toBeTruthy();
      expect(queryByTestId("meal-item-meal-2")).toBeNull();
    });

    it("shows the record's rating as filled/unfilled stars, and nothing when unrated", async () => {
      mockCommonHooks(RECORDS);

      const { getByTestId, queryByTestId } = await renderLogPanel();

      // meal-1 has rating 4.
      expect(getByTestId("meal-item-rating-meal-1-readonly-star-4").props.children).toBe("★");
      expect(getByTestId("meal-item-rating-meal-1-readonly-star-5").props.children).toBe("☆");

      // meal-2 (unrated) would show here too once switched to a month with
      // it, but it's a future record so it never appears in this panel -
      // rating display for an unrated *past* record is covered by RatingStars'
      // own test suite (renders nothing for rating: null).
      expect(queryByTestId("meal-item-rating-meal-2-readonly")).toBeNull();
    });

    it("shows an empty state hint about noting what was eaten when there are no past records", async () => {
      mockCommonHooks([]);

      const { getByText } = await renderLogPanel();

      expect(getByText("記録がありません")).toBeTruthy();
    });

    it("shows a 🔗/📝 icon (not the raw text) when a url/memo is set, and neither when absent", async () => {
      const records = [
        { ...RECORDS[1], id: "meal-3", mealDate: "2026-08-05" }, // 過去日に変えて記録パネルに出す
      ];
      mockCommonHooks(records);

      const { getByTestId, queryByTestId, queryByText } = await renderLogPanel();

      expect(getByTestId("meal-url-icon-meal-3")).toBeTruthy();
      expect(getByTestId("meal-memo-icon-meal-3")).toBeTruthy();
      expect(queryByText("https://example.com/curry")).toBeNull();
      expect(queryByText("スパイスから作る")).toBeNull();
    });

    it("navigates to the search screen for the active calendar from the header search button", async () => {
      mockCommonHooks(RECORDS);

      const { getByTestId } = await renderLogPanel();

      await fireEvent.press(getByTestId("meals-search-button"));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/meal-search",
        params: { calendarId: "cal-1" },
      });
    });

    it("opens the edit form seeded with the record's rating, and can change it", async () => {
      const refetch = jest.fn();
      mockCommonHooks(RECORDS, refetch);
      const updateMealRecordMock = jest.fn().mockResolvedValue(true);
      (useUpdateMealRecord as jest.Mock).mockReturnValue({ updateMealRecord: updateMealRecordMock, isSubmitting: false, error: null });

      const { getByTestId } = await renderLogPanel();

      await fireEvent.press(getByTestId("meal-item-meal-1"));
      expect(getByTestId("meal-form-rating-4-label").props.children).toBe("★");

      await fireEvent.press(getByTestId("meal-form-rating-5"));
      await fireEvent.press(getByTestId("meal-form-save"));

      await waitFor(() =>
        expect(updateMealRecordMock).toHaveBeenCalledWith("meal-1", expect.objectContaining({ rating: 5 }))
      );
    });

    it("shows a calendar switcher (in the header filter sheet) defaulting to all calendars selected, toggling a calendar off/on to narrow the list", async () => {
      mockCommonHooks([]);

      const { getByTestId } = await renderLogPanel();
      await fireEvent.press(getByTestId("meals-filter"));

      expect(getByTestId("meals-calendar-switch-cal-1")).toBeTruthy();
      await waitFor(() => expect(useMealRecordsByCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"]));

      await fireEvent.press(getByTestId("meals-calendar-switch-cal-2"));
      await waitFor(() => expect(useMealRecordsByCalendars).toHaveBeenLastCalledWith(["cal-1"]));
    });

    it("splits records into past/future using JST 'today', not a raw UTC slice", async () => {
      // 2026-08-19T00:30:00.000Z is already 2026-08-19 09:30 JST, but the raw
      // UTC date is still "2026-08-18" - a naive `new Date().toISOString()`
      // slice would misclassify an 08-18 record as still-upcoming.
      jest.setSystemTime(new Date("2026-08-19T00:30:00.000Z"));
      const records: typeof RECORDS = [
        { id: "meal-y", calendarId: "cal-1", mealDate: "2026-08-18", slot: "dinner", title: "昨日の夕食", rating: 4, url: null, memo: null, createdBy: "user-1" },
      ];
      mockCommonHooks(records);

      const { getByTestId, queryByTestId } = await renderLogPanel();

      expect(getByTestId("meal-item-meal-y")).toBeTruthy();
      expect(queryByTestId("meals-log-add")).toBeTruthy(); // sanity: still on the log panel

      await fireEvent.press(getByTestId("meals-mode-plan"));
      expect(queryByTestId("meal-item-meal-y")).toBeNull();
    });
  });
});
