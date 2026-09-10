import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import CalendarScreen from "../calendar";
import { useAuthSession } from "../../../src/features/auth/hooks";
import {
  useCalendarMembers,
  useCreateCalendar,
  useCreateInvite,
  useJoinByInvite,
  useLeaveOrDeleteCalendar,
  useMyCalendars,
  useRemoveMember,
  useUpdateCalendar,
} from "../../../src/features/calendars/hooks";
import { computeDateKeyRange } from "../../../src/features/events/dateRange";
import {
  useCreateDefaultEventReminders,
  useCreateEvent,
  useEventsInRangeForCalendars,
} from "../../../src/features/events/hooks";
import {
  useAttachTagsToEvent,
  useCreateTag,
  useDeleteTag,
  useEventTagsByEvents,
  useTagTree,
  useUpdateTag,
} from "../../../src/features/tags/hooks";
import { useCreateTodo } from "../../../src/features/todos/hooks";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: jest.fn() },
    useLocalSearchParams: jest.fn().mockReturnValue({}),
    // Renders headerLeft/headerRight inline so tests can still reach the
    // buttons that now live in the native header via <Tabs.Screen options>.
    Tabs: {
      Screen: ({ options }: any) =>
        React.createElement(React.Fragment, null, options?.headerLeft?.(), options?.headerRight?.()),
    },
    // Treats "focus" as "mount" and "blur" as "unmount" for testing purposes,
    // since there's no real navigation container here to fire actual
    // focus/blur events - forwarding the callback's own return value keeps
    // its cleanup (used to reset the filter on leaving the tab) wired up
    // exactly like the real useFocusEffect does.
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
  useCalendarMembers: jest.fn(),
  useRemoveMember: jest.fn(),
  useLeaveOrDeleteCalendar: jest.fn(),
  useCreateCalendar: jest.fn(),
  useUpdateCalendar: jest.fn(),
  useCreateInvite: jest.fn(),
  useJoinByInvite: jest.fn(),
}));

jest.mock("../../../src/features/events/hooks", () => ({
  useEventsInRangeForCalendars: jest.fn(),
  useCreateEvent: jest.fn(),
  useCreateDefaultEventReminders: jest.fn(),
}));

jest.mock("../../../src/features/todos/hooks", () => ({
  useCreateTodo: jest.fn(),
}));

jest.mock("../../../src/features/tags/hooks", () => ({
  useTagTree: jest.fn(),
  useCreateTag: jest.fn(),
  useUpdateTag: jest.fn(),
  useDeleteTag: jest.fn(),
  useAttachTagsToEvent: jest.fn(),
  useEventTagsByEvents: jest.fn(),
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
  { id: "cal-1", name: "我が家", color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
  { id: "cal-2", name: "友人グループ", color: "#43a047", createdBy: "user-2", createdAt: "2026-08-17T01:00:00.000Z" },
];

const TODAY_EVENT = {
  id: "event-1",
  calendarId: "cal-1",
  title: "朝会",
  categoryColor: "#2f6fed",
  startAt: "2026-08-18T09:00:00.000Z",
  endAt: "2026-08-18T09:30:00.000Z",
};

const TAG_TREE = [
  { id: "tag-a", calendarId: "cal-1", parentId: null, level: "major", name: "旅行", color: "#ff0000", createdAt: "2026-08-01T00:00:00.000Z", children: [] },
];

const OTHER_DAY_EVENT = {
  id: "event-2",
  calendarId: "cal-1",
  title: "外出",
  categoryColor: "#e91e63",
  startAt: "2026-08-20T09:00:00.000Z",
  endAt: "2026-08-20T10:00:00.000Z",
};

function mockCommonHooks() {
  (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } } });
  (useMyCalendars as jest.Mock).mockReturnValue({
    calendars: CALENDARS,
    isLoading: false,
    error: null,
      refetch: jest.fn(),
    });
  // Consumed by SettingsHubModal's calendar-edit screen (via the header 設定
  // button) and its invite screen (via the 招待 button), each with its own
  // instance.
  (useCalendarMembers as jest.Mock).mockReturnValue({
    members: [],
    isLoading: false,
    error: null,
      refetch: jest.fn(),
    });
  (useRemoveMember as jest.Mock).mockReturnValue({
    removeMember: jest.fn(),
    isSubmitting: false,
    error: null,
  });
  (useLeaveOrDeleteCalendar as jest.Mock).mockReturnValue({
    leaveOrDeleteCalendar: jest.fn(),
    isSubmitting: false,
    error: null,
  });
  (useCreateEvent as jest.Mock).mockReturnValue({
    createEvent: jest.fn().mockResolvedValue({ id: "event-created-1" }),
    isSubmitting: false,
    error: null,
  });
  (useCreateDefaultEventReminders as jest.Mock).mockReturnValue({
    createDefaultEventReminders: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useCreateTodo as jest.Mock).mockReturnValue({
    createTodo: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useCreateCalendar as jest.Mock).mockReturnValue({
    createCalendar: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateCalendar as jest.Mock).mockReturnValue({
    updateCalendar: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useCreateInvite as jest.Mock).mockReturnValue({
    createInvite: jest.fn().mockResolvedValue({ id: "invite-1", calendarId: "cal-1", code: "ABC123", expiresAt: "2026-09-01T00:00:00.000Z", createdBy: "user-1", createdAt: "2026-08-22T00:00:00.000Z" }),
    isSubmitting: false,
    error: null,
  });
  (useJoinByInvite as jest.Mock).mockReturnValue({
    joinByInvite: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useTagTree as jest.Mock).mockReturnValue({
    tagTree: TAG_TREE,
    isLoading: false,
    error: null,
      refetch: jest.fn(),
    });
  (useEventTagsByEvents as jest.Mock).mockReturnValue({
    tagsByEventId: {},
    isLoading: false,
    error: null,
      refetch: jest.fn(),
    });
  (useCreateTag as jest.Mock).mockReturnValue({
    createTag: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateTag as jest.Mock).mockReturnValue({
    updateTag: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useDeleteTag as jest.Mock).mockReturnValue({
    deleteTag: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useAttachTagsToEvent as jest.Mock).mockReturnValue({
    attachTagsToEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
}

describe("CalendarScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-18T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("refetches events when the tab regains focus, so a just-deleted event doesn't linger on the calendar", async () => {
    mockCommonHooks();
    const refetch = jest.fn();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch });

    await render(<CalendarScreen />);

    // The screen mounting counts as "gaining focus" here (see the
    // useFocusEffect mock) - the important thing is it's driven by focus,
    // not just the hook's own mount-time fetch, so navigating back to this
    // tab after deleting/editing an event elsewhere (an already-mounted
    // screen regaining focus, not a fresh mount) also triggers it in the
    // real app - without this, a deleted event kept showing on the grid/
    // list/day modal until something else happened to trigger a refetch.
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("shows a switcher for each of the caller's calendars, inside the header filter sheet", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));

    expect(getByTestId("calendar-switch-cal-1")).toBeTruthy();
    expect(getByTestId("calendar-switch-cal-2")).toBeTruthy();
  });

  it("selects all of the caller's calendars by default when the screen first loads", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));

    await waitFor(() =>
      expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"], expect.anything())
    );
    expect(getByTestId("calendar-switch-cal-1").props.style).toEqual(
      expect.objectContaining({ borderColor: "#2f6fed" })
    );
    expect(getByTestId("calendar-switch-cal-2").props.style).toEqual(
      expect.objectContaining({ borderColor: "#2f6fed" })
    );
  });

  it("deselects a calendar (toggling it off) when its already-selected chip is pressed", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));

    // Both calendars start selected; tapping cal-2's chip toggles just it off.
    await fireEvent.press(getByTestId("calendar-switch-cal-2"));

    await waitFor(() => expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1"], expect.anything()));
  });

  it("reselects a calendar (toggling it back on) when its deselected chip is pressed again", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));

    await fireEvent.press(getByTestId("calendar-switch-cal-2"));
    await waitFor(() => expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1"], expect.anything()));

    await fireEvent.press(getByTestId("calendar-switch-cal-2"));

    await waitFor(() =>
      expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"], expect.anything())
    );
  });

  it("shows the month label and queries a range padded to the grid's full leading/trailing weeks", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByText } = await render(<CalendarScreen />);

    expect(getByText("2026年8月")).toBeTruthy();
    // August 2026's grid is padded out to full weeks: it starts Sun 2026-07-26
    // and ends Sat 2026-09-05, so events on those adjacent-month days (shown
    // on the grid, even though grayed out) must still be queried for.
    await waitFor(() =>
      expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(
        ["cal-1", "cal-2"],
        computeDateKeyRange("2026-07-26", "2026-09-05")
      )
    );
  });

  it("renders a month grid with a cell for today and for each day, highlighting today", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(getByTestId("calendar-grid-cell-2026-08-18")).toBeTruthy();
    expect(getByTestId("calendar-grid-cell-2026-08-01")).toBeTruthy();
    expect(getByTestId("calendar-grid-cell-2026-08-31")).toBeTruthy();
  });

  it("sizes the grid area from the measured container minus the space above/below it, so a 6-week month always fits", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    // August 2026 spans 6 calendar weeks (rows 0-5).
    expect(getByTestId("calendar-grid-row-5")).toBeTruthy();

    const layout = (height: number) => ({ nativeEvent: { layout: { height, width: 375, x: 0, y: 0 } } });
    await fireEvent(getByTestId("calendar-container"), "layout", layout(800));
    await fireEvent(getByTestId("calendar-above-grid"), "layout", layout(150));
    await fireEvent(getByTestId("calendar-below-grid"), "layout", layout(50));

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

    // The grid gets exactly what's left over (800 - 150 - 50 = 600), not a
    // flex-guessed amount, so it can never spill past the screen.
    await waitFor(() => {
      const gridStyle = flattenStyle(getByTestId("calendar-grid-container").props.style);
      expect(gridStyle.height).toBe(600);
    });
  });

  it("never shrinks the grid area below a safety floor, even if the measured space above/below leaves little room", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    const layout = (height: number) => ({ nativeEvent: { layout: { height, width: 375, x: 0, y: 0 } } });
    await fireEvent(getByTestId("calendar-container"), "layout", layout(400));
    await fireEvent(getByTestId("calendar-above-grid"), "layout", layout(300));
    await fireEvent(getByTestId("calendar-below-grid"), "layout", layout(300));

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

    await waitFor(() => {
      const gridStyle = flattenStyle(getByTestId("calendar-grid-container").props.style);
      expect(gridStyle.height).toBe(200);
    });
  });

  it("shows event dots on grid cells that have events", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(getByTestId("calendar-grid-dot-event-1")).toBeTruthy();
    expect(getByTestId("calendar-grid-dot-event-2")).toBeTruthy();
  });

  it("shows a few characters of the event title inside its grid marker", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(within(getByTestId("calendar-grid-dot-event-1")).getByText("朝会")).toBeTruthy();
  });

  it("colors the grid marker and day-list dot with the event's primary tag color when tagged", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [{ ...TODAY_EVENT, categoryColor: "#2f6fed", tagColor: "#e53935" }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    const gridMarkerStyle = getByTestId("calendar-grid-dot-event-1").props.style;
    const flattened = Array.isArray(gridMarkerStyle)
      ? Object.assign({}, ...gridMarkerStyle.filter(Boolean))
      : gridMarkerStyle;
    expect(flattened.backgroundColor).toBe("#e53935");
  });

  it("shows a multi-day event on every day it spans, on the grid and in the day list", async () => {
    mockCommonHooks();
    const multiDayEvent = {
      id: "event-3",
      calendarId: "cal-1",
      title: "旅行",
      categoryColor: "#43a047",
      startAt: "2026-08-18T09:00:00.000Z",
      endAt: "2026-08-20T18:00:00.000Z",
    };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [multiDayEvent],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    // The marker for the multi-day event shows up on all three days it spans.
    for (const dateKey of ["2026-08-18", "2026-08-19", "2026-08-20"]) {
      expect(
        within(getByTestId(`calendar-grid-cell-${dateKey}`)).getByTestId("calendar-grid-dot-event-3")
      ).toBeTruthy();
    }

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    expect(getByTestId("calendar-event-event-3")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-19"));
    expect(getByTestId("calendar-event-event-3")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));
    expect(getByTestId("calendar-event-event-3")).toBeTruthy();
  });

  it("shows a dot for an event on a grayed-out leading/trailing day from the adjacent month", async () => {
    mockCommonHooks();
    // 2026-07-26 is the grid's first (leading, grayed-out) cell for the
    // August 2026 view - see the padded-range test above.
    const leadingDayEvent = {
      id: "event-4",
      calendarId: "cal-1",
      title: "前月末の予定",
      categoryColor: "#2f6fed",
      startAt: "2026-07-26T09:00:00.000Z",
      endAt: "2026-07-26T10:00:00.000Z",
    };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [leadingDayEvent],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(
      within(getByTestId("calendar-grid-cell-2026-07-26")).getByTestId("calendar-grid-dot-event-4")
    ).toBeTruthy();
  });

  it("colors Saturday blue and Sunday/holidays red in the weekday header and grid day numbers", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, getAllByText } = await render(<CalendarScreen />);

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

    const weekdayLabels = getAllByText("土");
    const saturdayHeaderStyle = flattenStyle(weekdayLabels[0].props.style);
    expect(saturdayHeaderStyle.color).toBe("#2f6fed");

    const sundayHeaderStyle = flattenStyle(getAllByText("日")[0].props.style);
    expect(sundayHeaderStyle.color).toBe("#e53935");

    // 2026-08-22 is a Saturday; 2026-08-23 is a Sunday.
    const saturdayCell = within(getByTestId("calendar-grid-cell-2026-08-22"));
    const saturdayDayStyle = flattenStyle(saturdayCell.getByText("22").props.style);
    expect(saturdayDayStyle.color).toBe("#2f6fed");

    const sundayCell = within(getByTestId("calendar-grid-cell-2026-08-23"));
    const sundayDayStyle = flattenStyle(sundayCell.getByText("23").props.style);
    expect(sundayDayStyle.color).toBe("#e53935");

    // 2026-08-11 (山の日, Mountain Day) is a Japanese national holiday and a Tuesday.
    const holidayCell = within(getByTestId("calendar-grid-cell-2026-08-11"));
    const holidayDayStyle = flattenStyle(holidayCell.getByText("11").props.style);
    expect(holidayDayStyle.color).toBe("#e53935");
  });

  it("shows only the selected date's events, colored by category, and updates when a grid cell is selected", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    expect(getByTestId("calendar-event-event-1")).toBeTruthy();
    expect(queryByTestId("calendar-event-event-2")).toBeNull();

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));

    expect(getByTestId("calendar-event-event-2")).toBeTruthy();
    expect(queryByTestId("calendar-event-event-1")).toBeNull();
  });

  it("shows the selected day's events in a centered modal, with its date in the header, closed by default", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);

    expect(queryByTestId("calendar-event-event-1")).toBeNull();

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    expect(getByText("8月18日 火曜日")).toBeTruthy();
    expect(getByTestId("calendar-event-event-1")).toBeTruthy();
  });

  it("shows the day-events modal as a fixed-size card centered over a dimmed backdrop, not a full-screen sheet", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const cardStyle = flattenStyle(getByTestId("calendar-day-modal-card").props.style);
    expect(cardStyle.height).not.toBe("100%");
    expect(cardStyle.borderRadius).toBeGreaterThan(0);
    // Must be a real `height`, not just `maxHeight` - the event list inside
    // uses flex:1 to fill the space below the header, which Yoga can only
    // resolve against a parent with an actually-resolved size. maxHeight
    // alone leaves the card sized to its content (effectively just the
    // header), silently collapsing the list to zero height.
    expect(cardStyle.height).toBeTruthy();
    expect(cardStyle.maxHeight).toBeUndefined();

    const overlayStyle = flattenStyle(getByTestId("calendar-day-modal-backdrop").props.style);
    expect(overlayStyle.justifyContent).toBe("center");
    expect(overlayStyle.alignItems).toBe("center");
  });

  it("closes the day-events modal when tapping outside the card, on the dimmed backdrop", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [TODAY_EVENT], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    expect(getByTestId("calendar-event-event-1")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-day-modal-backdrop"));

    expect(queryByTestId("calendar-event-event-1")).toBeNull();
  });

  it("shows an empty message in the day-events modal when the selected day has no events", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    expect(getByText("予定はありません")).toBeTruthy();
  });

  it("closes the day-events modal from its close button", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [TODAY_EVENT], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    expect(getByTestId("calendar-event-event-1")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-day-modal-close"));

    expect(queryByTestId("calendar-event-event-1")).toBeNull();
  });

  it("opens the create-event modal, pre-filled for the selected day, from the day-events modal's + button", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));
    await fireEvent.press(getByTestId("calendar-day-modal-add"));

    expect(queryByTestId("calendar-event-event-1")).toBeNull();
    expect(getByTestId("event-create-title-input")).toBeTruthy();
  });

  it("resets to today's events when the today button is pressed", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));
    expect(getByTestId("calendar-event-event-2")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-today-button"));

    expect(getByTestId("calendar-event-event-1")).toBeTruthy();
    expect(queryByTestId("calendar-event-event-2")).toBeNull();
  });

  it("advances by exactly one month on the very first press, even after the grid's onLayout measurements have already fired", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    // Simulate the grid-sizing onLayout measurements that fire shortly after
    // mount, before the user gets a chance to tap anything.
    const layout = (height: number) => ({ nativeEvent: { layout: { height, width: 375, x: 0, y: 0 } } });
    await fireEvent(getByTestId("calendar-container"), "layout", layout(800));
    await fireEvent(getByTestId("calendar-above-grid"), "layout", layout(150));
    await fireEvent(getByTestId("calendar-below-grid"), "layout", layout(50));

    await fireEvent.press(getByTestId("calendar-month-next"));

    expect(getByText("2026年9月")).toBeTruthy();
  });

  it("moves to the next/previous month and updates the label and query range", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-month-next"));
    expect(getByText("2026年9月")).toBeTruthy();
    // September 2026's padded grid runs Sun 2026-08-30 through Sat 2026-10-03.
    await waitFor(() =>
      expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(
        ["cal-1", "cal-2"],
        computeDateKeyRange("2026-08-30", "2026-10-03")
      )
    );

    await fireEvent.press(getByTestId("calendar-month-prev"));
    await fireEvent.press(getByTestId("calendar-month-prev"));
    expect(getByText("2026年7月")).toBeTruthy();
  });

  it("jumps to the month/day and switches to the calendar given via ?date=&calendarId= (e.g. from the ToDo screen)", async () => {
    mockCommonHooks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ date: "2026-09-10", calendarId: "cal-2" });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByText } = await render(<CalendarScreen />);

    expect(getByText("2026年9月")).toBeTruthy();
    // Same padded grid as above (Sun 2026-08-30 through Sat 2026-10-03).
    await waitFor(() =>
      expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(
        ["cal-2"],
        computeDateKeyRange("2026-08-30", "2026-10-03")
      )
    );

    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  it("uses a ✕ glyph instead of the キャンセル text label for the creation modal's cancel button", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    expect(queryByText("キャンセル")).toBeNull();
    expect(getByTestId("event-create-cancel")).toBeTruthy();
  });

  it("opens the creation modal from the FAB and cancels without creating", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    expect(queryByTestId("event-create-title-input")).toBeNull();

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    expect(getByTestId("event-create-title-input")).toBeTruthy();

    await fireEvent.press(getByTestId("event-create-cancel"));
    expect(queryByTestId("event-create-title-input")).toBeNull();
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it("closes the creation modal without creating when tapping outside it, on the backdrop", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.press(getByTestId("event-create-backdrop"));

    expect(queryByTestId("event-create-title-input")).toBeNull();
    expect(createEventMock).not.toHaveBeenCalled();
  });

  it("creates a new event with title/dates from the modal and refetches the range", async () => {
    mockCommonHooks();
    const refetch = jest.fn();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");

    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-01T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-09-01T12:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith({
        calendarId: "cal-1",
        title: "誕生日会",
        startAt: "2026-09-01T10:00:00.000Z",
        endAt: "2026-09-01T12:00:00.000Z",
        isAllDay: true,
      })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    await waitFor(() => expect(queryByTestId("event-create-title-input")).toBeNull());
  });

  it("colors an untagged event with its calendar's own default color", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [{ ...TODAY_EVENT, tagColor: null }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    const gridMarkerStyle = getByTestId("calendar-grid-dot-event-1").props.style;
    const flattened = Array.isArray(gridMarkerStyle)
      ? Object.assign({}, ...gridMarkerStyle.filter(Boolean))
      : gridMarkerStyle;
    // cal-1's own default color (see CALENDARS above), not a fixed blue.
    expect(flattened.backgroundColor).toBe("#2f6fed");
  });

  it("seeds default reminders for the creator right after creating an event", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const createDefaultEventRemindersMock = jest.fn().mockResolvedValue(true);
    (useCreateDefaultEventReminders as jest.Mock).mockReturnValue({
      createDefaultEventReminders: createDefaultEventRemindersMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createDefaultEventRemindersMock).toHaveBeenCalledWith("event-created-1", true)
    );
  });

  it("creates the event in a different calendar when picked from the create modal's calendar picker", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "飲み会");
    await fireEvent.press(getByTestId("event-create-calendar-cal-2"));

    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-01T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-09-01T12:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith(expect.objectContaining({ calendarId: "cal-2" }))
    );
  });

  it("includes location and url when provided", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "オンライン飲み会");
    await fireEvent.press(getByTestId("event-create-location-add"));
    await fireEvent.changeText(getByTestId("event-create-location-input"), "自宅");
    await fireEvent.press(getByTestId("event-create-url-add"));
    await fireEvent.changeText(getByTestId("event-create-url-input"), "https://example.com/meeting");
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ location: "自宅", url: "https://example.com/meeting" })
      )
    );
  });

  it("uses the same '+ ○○を追加' style for ToDo as for location/URL, and reveals the checklist on tap without collapsing back", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    // Before tapping: no checklist, just the reveal button (same shape as
    // "+ 場所を追加"/"+ URLを追加").
    expect(queryByTestId("event-create-todo-input")).toBeNull();
    expect(getByTestId("event-create-has-todos-toggle")).toBeTruthy();
    expect(getByTestId("event-create-location-add")).toBeTruthy();

    await fireEvent.press(getByTestId("event-create-has-todos-toggle"));

    // After tapping: the checklist is shown, and (like location/URL) the
    // reveal button itself doesn't come back.
    expect(getByTestId("event-create-todo-input")).toBeTruthy();
    expect(queryByTestId("event-create-has-todos-toggle")).toBeNull();
  });

  it("adds checklist ToDo items to the created event when the ToDo toggle is on", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const createTodoMock = jest.fn().mockResolvedValue(true);
    (useCreateTodo as jest.Mock).mockReturnValue({ createTodo: createTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "旅行");

    await fireEvent.press(getByTestId("event-create-has-todos-toggle"));
    await fireEvent.changeText(getByTestId("event-create-todo-input"), "パスポート確認");
    await fireEvent.press(getByTestId("event-create-todo-add"));
    await fireEvent.changeText(getByTestId("event-create-todo-input"), "荷造り");
    await fireEvent.press(getByTestId("event-create-todo-add"));

    expect(getByTestId("event-create-todo-item-0")).toBeTruthy();
    expect(getByTestId("event-create-todo-item-1")).toBeTruthy();

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(createTodoMock).toHaveBeenCalledWith({ eventId: "event-created-1", title: "パスポート確認" })
    );
    expect(createTodoMock).toHaveBeenCalledWith({ eventId: "event-created-1", title: "荷造り" });
  });

  it("uses a trash icon instead of the 削除 text label for removing a checklist ToDo item", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.press(getByTestId("event-create-has-todos-toggle"));
    await fireEvent.changeText(getByTestId("event-create-todo-input"), "パスポート確認");
    await fireEvent.press(getByTestId("event-create-todo-add"));

    expect(queryByText("削除")).toBeNull();
    expect(getByTestId("event-create-todo-item-0-remove")).toBeTruthy();
  });

  it("does not create ToDo items when the ToDo toggle is off", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const createTodoMock = jest.fn().mockResolvedValue(true);
    (useCreateTodo as jest.Mock).mockReturnValue({ createTodo: createTodoMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    expect(queryByTestId("event-create-todo-input")).toBeNull();
    await fireEvent.changeText(getByTestId("event-create-title-input"), "会議");
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
    expect(createTodoMock).not.toHaveBeenCalled();
  });

  it("opens the tag management modal from the calendar screen and creates a new tag", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const refetchTagTree = jest.fn();
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: [], isLoading: false, error: null, refetch: refetchTagTree });
    const createTagMock = jest.fn().mockResolvedValue(true);
    (useCreateTag as jest.Mock).mockReturnValue({ createTag: createTagMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-settings-button"));
    await fireEvent.press(getByTestId("settings-hub-open-calendar"));
    await fireEvent.press(getByTestId("calendar-settings-calendar-cal-1"));
    await fireEvent.press(getByTestId("calendar-settings-manage-tags"));
    await fireEvent.press(getByTestId("tag-management-new-button"));
    await fireEvent.changeText(getByTestId("edit-tag-name-input"), "旅行");
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    await waitFor(() =>
      expect(createTagMock).toHaveBeenCalledWith({
        name: "旅行",
        color: "#2f6fed",
        level: "major",
        parentId: null,
      })
    );
    await waitFor(() => expect(refetchTagTree).toHaveBeenCalled());
  });

  it("attaches the selected calendar tags to a newly created event", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: TAG_TREE, isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const attachTagsToEventMock = jest.fn().mockResolvedValue(true);
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: attachTagsToEventMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "旅行の計画");
    await fireEvent.press(getByTestId("event-create-tag-tag-a"));
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
    await waitFor(() => expect(attachTagsToEventMock).toHaveBeenCalledWith("event-created-1", ["tag-a"]));
  });

  it("does not attach tags when none are selected", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: TAG_TREE, isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const attachTagsToEventMock = jest.fn().mockResolvedValue(true);
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: attachTagsToEventMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "会議");
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
    expect(attachTagsToEventMock).not.toHaveBeenCalled();
  });

  it("navigates to the event detail screen when an event row is pressed", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [TODAY_EVENT], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    await fireEvent.press(getByTestId("calendar-event-event-1"));

    expect(router.push).toHaveBeenCalledWith("/event/event-1");
  });

  it("defaults new events to all-day (the all-day toggle starts on)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "旅行");

    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-01T00:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-09-03T00:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ isAllDay: true, title: "旅行" })
      )
    );
  });

  it("passes isAllDay false when the all-day toggle is turned off", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "会議");
    await fireEvent.press(getByTestId("event-create-allday-toggle"));

    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-01T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-09-01T11:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ isAllDay: false, title: "会議" })
      )
    );
  });

  it("shows a share-calendar banner when the caller has no calendars, with settings still reachable to create/join one", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: [], isLoading: false, error: null, refetch: jest.fn() });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(getByTestId("calendar-share-banner")).toBeTruthy();
    // Settings is always reachable (not gated on having an active calendar),
    // since it's the only way to create/join a calendar from a zero-calendar
    // state - creating/joining itself is covered by SettingsHubModal's own
    // tests.
    expect(getByTestId("calendar-settings-button")).toBeTruthy();
  });

  describe("共有カレンダー作成までの導線", () => {
    it("shows the share-calendar banner when the caller only has their personal calendar (no shared calendar yet)", async () => {
      mockCommonHooks();
      (useMyCalendars as jest.Mock).mockReturnValue({
        calendars: [{ id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId } = await render(<CalendarScreen />);

      expect(getByTestId("calendar-share-banner")).toBeTruthy();
    });

    it("hides the share-calendar banner once a shared calendar exists", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { queryByTestId } = await render(<CalendarScreen />);

      expect(queryByTestId("calendar-share-banner")).toBeNull();
    });

    it("jumps straight to the calendar-create form (skipping the settings hub list) when the banner is pressed", async () => {
      mockCommonHooks();
      (useMyCalendars as jest.Mock).mockReturnValue({
        calendars: [{ id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

      await fireEvent.press(getByTestId("calendar-share-banner"));

      // Straight into the create form - not the hub's section list, not the
      // calendar-settings list screen.
      expect(queryByTestId("settings-hub-open-calendar")).toBeNull();
      expect(queryByTestId("calendar-settings-new-button")).toBeNull();
      expect(getByTestId("calendar-settings-name-input")).toBeTruthy();
      expect(getByTestId("calendar-settings-create-submit")).toBeTruthy();
    });

    it("still opens the settings hub at its normal list when the header gear button is pressed", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<CalendarScreen />);

      await fireEvent.press(getByTestId("calendar-settings-button"));

      expect(getByTestId("settings-hub-open-calendar")).toBeTruthy();
    });
  });

  it("marks the personal calendar with a lock in the header filter sheet", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({
      calendars: [
        { id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
        { id: "cal-2", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByText, getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));

    expect(getByText("Myカレンダー")).toBeTruthy();
    expect(getByTestId("calendar-lock-icon-cal-1")).toBeTruthy();
  });

  it("shows the personal-only badge in the create-event modal when creating for a group calendar", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({
      calendars: [
        { id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
        { id: "cal-2", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, getByText } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));

    // Both calendars are selected by default; deselect the personal one so
    // cal-2 (group) becomes the sole - and therefore active - calendar.
    await fireEvent.press(getByTestId("calendar-switch-cal-1"));
    await fireEvent.press(getByTestId("calendar-filter-close"));
    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    expect(getByTestId("event-create-personal-group-label")).toBeTruthy();
    expect(getByText("個人用")).toBeTruthy();
  });

  it("hides the personal-only badge in the create-event modal when creating for the personal calendar", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({
      calendars: [
        { id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
        { id: "cal-2", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    expect(queryByTestId("event-create-personal-group-label")).toBeNull();
  });

  it("wraps the create-event form in a shared (blue) frame and a personal (gray) frame when creating for a group calendar", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({
      calendars: [
        { id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
        { id: "cal-2", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));
    await fireEvent.press(getByTestId("calendar-switch-cal-1"));
    await fireEvent.press(getByTestId("calendar-filter-close"));
    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    const flattenStyle = (style: unknown) =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

    const sharedFrameStyle = flattenStyle(getByTestId("event-create-shared-frame").props.style);
    const personalFrameStyle = flattenStyle(getByTestId("event-create-personal-frame").props.style);

    expect(sharedFrameStyle.borderWidth).toBeGreaterThan(0);
    expect(personalFrameStyle.borderWidth).toBeGreaterThan(0);
    expect(sharedFrameStyle.backgroundColor).not.toBe(personalFrameStyle.backgroundColor);

    // The title/date/location/url fields live in the shared frame, tags/ToDo in the personal one.
    expect(within(getByTestId("event-create-shared-frame")).getByTestId("event-create-title-input")).toBeTruthy();
    expect(within(getByTestId("event-create-personal-frame")).getByTestId("event-create-has-todos-toggle")).toBeTruthy();
  });

  it("puts the whole create-event form in a single personal-colored frame when creating for the personal calendar", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({
      calendars: [{ id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    expect(queryByTestId("event-create-shared-frame")).toBeNull();
    const personalFrame = getByTestId("event-create-personal-frame");
    expect(within(personalFrame).getByTestId("event-create-title-input")).toBeTruthy();
    expect(within(personalFrame).getByTestId("event-create-has-todos-toggle")).toBeTruthy();
  });

  it("keeps text inputs and tag chips white even inside the tinted shared/personal frames", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({
      calendars: [
        { id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
        { id: "cal-2", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));
    await fireEvent.press(getByTestId("calendar-switch-cal-1"));
    await fireEvent.press(getByTestId("calendar-filter-close"));
    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    const flattenStyle = (style: unknown) =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

    expect(flattenStyle(getByTestId("event-create-title-input").props.style).backgroundColor).toBe("#fff");
    expect(flattenStyle(getByTestId("event-create-tag-tag-a").props.style).backgroundColor).toBe("#fff");
  });

  it("shows an error message when event creation fails", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    (useCreateEvent as jest.Mock).mockReturnValue({
      createEvent: jest.fn().mockResolvedValue(null),
      isSubmitting: false,
      error: { type: "InvalidDateRange" },
    });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.press(getByTestId("event-create-submit"));

    expect(getByText("終了日時は開始日時より後に設定してください")).toBeTruthy();
  });

  describe("年月ピッカー", () => {
    it("opens a year/month picker when the month label is tapped, highlighting the currently focused month", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);

      expect(queryByTestId("calendar-month-picker-card")).toBeNull();

      await fireEvent.press(getByTestId("calendar-month-label"));

      expect(getByTestId("calendar-month-picker-card")).toBeTruthy();
      expect(getByText("2026年")).toBeTruthy();
    });

    it("jumps straight to a distant year/month in one flow: step the year, then tap a month", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-month-label"));

      await fireEvent.press(getByTestId("calendar-year-picker-next"));
      await fireEvent.press(getByTestId("calendar-year-picker-next"));
      expect(getByText("2028年")).toBeTruthy();

      await fireEvent.press(getByTestId("calendar-year-picker-month-3"));

      expect(getByText("2028年3月")).toBeTruthy();
      expect(queryByTestId("calendar-month-picker-card")).toBeNull(); // 選んだら閉じる
    });

    it("closes the picker without changing the month when the backdrop is tapped", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-month-label"));
      await fireEvent.press(getByTestId("calendar-year-picker-next"));

      await fireEvent.press(getByTestId("calendar-month-picker-backdrop"));

      expect(queryByTestId("calendar-month-picker-card")).toBeNull();
      expect(getByText("2026年8月")).toBeTruthy(); // 年送りだけでは確定しない
    });
  });

  describe("グリッド/一覧の切り替えと一覧表示", () => {
    it("shows the grid/list toggle as icon buttons at the top-left of the YYYY年MM月 row, active state changing which is highlighted", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId } = await render(<CalendarScreen />);

      // アイコン(Image)であり、テキストラベルではないこと。
      const gridButton = getByTestId("calendar-view-mode-grid");
      const listButton = getByTestId("calendar-view-mode-list");
      expect(gridButton.props.style).toMatchObject({ backgroundColor: "#2f6fed" });

      await fireEvent.press(listButton);

      expect(getByTestId("calendar-view-mode-list").props.style).toMatchObject({ backgroundColor: "#2f6fed" });
    });

    it("defaults to the grid, switching to a full list of the month's events when 一覧 is pressed", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [TODAY_EVENT, OTHER_DAY_EVENT],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

      expect(getByTestId("calendar-grid-container")).toBeTruthy();
      expect(queryByTestId("calendar-month-list")).toBeNull();

      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      expect(queryByTestId("calendar-grid-container")).toBeNull();
      expect(getByTestId("calendar-month-list-date-group-2026-08-18")).toBeTruthy();
      expect(getByTestId("calendar-month-list-date-group-2026-08-20")).toBeTruthy();
      expect(getByTestId("calendar-list-event-event-1")).toBeTruthy();
      expect(getByTestId("calendar-list-event-event-2")).toBeTruthy();
    });

    it("excludes events on padding days from the adjacent month, unlike the grid which still shows them", async () => {
      // 2026-07-31 is a padding (leading) day on August's grid but not part
      // of August itself.
      const paddingDayEvent = { ...OTHER_DAY_EVENT, id: "event-padding", startAt: "2026-07-31T09:00:00.000Z", endAt: "2026-07-31T10:00:00.000Z" };
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [paddingDayEvent],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

      expect(getByTestId("calendar-grid-dot-event-padding")).toBeTruthy();

      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      expect(queryByTestId("calendar-list-event-event-padding")).toBeNull();
      expect(queryByTestId("calendar-month-list")).toBeNull(); // 8月内の予定が0件なので空状態
    });

    it("navigates straight to the event detail screen when a list row is pressed (no intermediate day modal)", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [TODAY_EVENT], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      await fireEvent.press(getByTestId("calendar-list-event-event-1"));

      expect(router.push).toHaveBeenCalledWith("/event/event-1");
    });

    it("switching back to グリッド restores the month grid", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [TODAY_EVENT], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));
      await fireEvent.press(getByTestId("calendar-view-mode-grid"));

      expect(getByTestId("calendar-grid-container")).toBeTruthy();
      expect(queryByTestId("calendar-month-list")).toBeNull();
    });
  });

  describe("個人カレンダーの予定を🔒で見分ける", () => {
    function mockPersonalAndGroupCalendars() {
      (useMyCalendars as jest.Mock).mockReturnValue({
        calendars: [
          { id: "cal-1", name: "Myカレンダー", kind: "personal", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
          { id: "cal-2", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
    }

    it("shows a lock icon (not an emoji) on a personal-calendar event's grid marker, not a group-calendar one", async () => {
      mockCommonHooks();
      mockPersonalAndGroupCalendars();
      const groupEvent = { ...OTHER_DAY_EVENT, id: "event-group", calendarId: "cal-2" };
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, calendarId: "cal-1" }, groupEvent],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

      expect(getByTestId("calendar-grid-dot-personal-event-1")).toBeTruthy();
      expect(queryByTestId("calendar-grid-dot-personal-event-group")).toBeNull();
    });

    it("shows a lock icon next to a personal-calendar event in the day-events modal, not a group-calendar one", async () => {
      mockCommonHooks();
      mockPersonalAndGroupCalendars();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, calendarId: "cal-1" }],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      expect(getByTestId("calendar-event-personal-event-1")).toBeTruthy();
    });

    it("shows a lock icon next to a personal-calendar event in the 一覧 list, not a group-calendar one", async () => {
      mockCommonHooks();
      mockPersonalAndGroupCalendars();
      const groupEvent = { ...OTHER_DAY_EVENT, id: "event-group", calendarId: "cal-2" };
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, calendarId: "cal-1" }, groupEvent],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      expect(getByTestId("calendar-list-event-personal-event-1")).toBeTruthy();
      expect(queryByTestId("calendar-list-event-personal-event-group")).toBeNull();
    });
  });

  describe("日付の予定一覧での思い出・コメント件数バッジ", () => {
    it("shows both a photo-count and a comment-count badge when the event has both", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, photoCount: 2, commentCount: 4 }],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      const counts = getByTestId("calendar-event-counts-event-1");
      expect(within(counts).getByText("2")).toBeTruthy();
      expect(within(counts).getByText("4")).toBeTruthy();
    });

    it("omits the count badge for whichever of photo/comment is zero", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, photoCount: 3, commentCount: 0 }],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId, queryByText } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      const counts = getByTestId("calendar-event-counts-event-1");
      expect(within(counts).getByText("3")).toBeTruthy();
      expect(queryByText("0")).toBeNull();
    });

    it("shows no count badges at all when the event has no photos or comments", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, photoCount: 0, commentCount: 0 }],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      expect(queryByTestId("calendar-event-counts-event-1")).toBeNull();
    });
  });

  describe("色の凡例", () => {
    it("shows the tag's own name as the legend label for a tag-colored event", async () => {
      mockCommonHooks();
      const taggedEvent = { ...TODAY_EVENT, tagColor: "#e53935" };
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [taggedEvent],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: { "event-1": [{ id: "tag-a", parentId: null, level: "major", name: "旅行", color: "#e53935", createdAt: "2026-08-01T00:00:00.000Z" }] },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-filter"));

      expect(getByTestId("calendar-color-legend-#e53935")).toBeTruthy();
      expect(getByText("旅行")).toBeTruthy();
    });

    it("shows the calendar's own name as the legend label for an untagged event", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, tagColor: null }],
        isLoading: false,
        error: null,
      refetch: jest.fn(),
    });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-filter"));

      // cal-1's own default color (see CALENDARS above), labeled with its name.
      const legendEntry = getByTestId("calendar-color-legend-#2f6fed");
      expect(legendEntry).toBeTruthy();
      expect(within(legendEntry).getByText("我が家")).toBeTruthy();
    });

    it("omits the legend section entirely when there are no events to show a color for", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-filter"));

      expect(queryByTestId("calendar-color-legend")).toBeNull();
    });
  });
});
