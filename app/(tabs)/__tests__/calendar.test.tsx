import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import CalendarScreen from "../calendar";
import { useAuthSession } from "../../../src/features/auth/hooks";
import {
  useCalendarMembers,
  useCreateCalendar,
  useCreateInvite,
  useJoinByInvite,
  useMyCalendars,
  useRemoveMember,
} from "../../../src/features/calendars/hooks";
import { computeDateRange } from "../../../src/features/events/dateRange";
import { useCreateEvent, useEventsInRange } from "../../../src/features/events/hooks";
import {
  useAttachTagsToEvent,
  useCreateTag,
  useDeleteTag,
  useTagTree,
  useUpdateTag,
} from "../../../src/features/tags/hooks";
import { useCreateTodo } from "../../../src/features/todos/hooks";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
  useCalendarMembers: jest.fn(),
  useRemoveMember: jest.fn(),
  useCreateCalendar: jest.fn(),
  useCreateInvite: jest.fn(),
  useJoinByInvite: jest.fn(),
}));

jest.mock("../../../src/features/events/hooks", () => ({
  useEventsInRange: jest.fn(),
  useCreateEvent: jest.fn(),
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

const MEMBERS_CAL_1 = [
  { calendarId: "cal-1", userId: "user-1", role: "owner", joinedAt: "2026-08-17T00:00:00.000Z", displayName: "たろう" },
  { calendarId: "cal-1", userId: "user-2", role: "viewer", joinedAt: "2026-08-17T00:00:00.000Z", displayName: null },
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
  (useCalendarMembers as jest.Mock).mockReturnValue({
    members: MEMBERS_CAL_1,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useRemoveMember as jest.Mock).mockReturnValue({
    removeMember: jest.fn(),
    isSubmitting: false,
    error: null,
  });
  (useCreateEvent as jest.Mock).mockReturnValue({
    createEvent: jest.fn().mockResolvedValue({ id: "event-created-1" }),
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

  it("shows a switcher for each of the caller's calendars and the active calendar's members", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    expect(getByTestId("calendar-switch-cal-1")).toBeTruthy();
    expect(getByTestId("calendar-switch-cal-2")).toBeTruthy();
    expect(getByText("たろう")).toBeTruthy();
    expect(getByText("メンバー")).toBeTruthy();
  });

  it("never shows a member's raw user id, falling back to their own email when they have no display name", async () => {
    mockCommonHooks();
    (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-2", email: "user2@example.com" } } });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByText, queryByText } = await render(<CalendarScreen />);

    expect(getByText("たろう")).toBeTruthy();
    expect(getByText("user2@example.com")).toBeTruthy();
    expect(queryByText("user-1")).toBeNull();
    expect(queryByText("user-2")).toBeNull();
  });

  it("switches the active calendar when a switcher button is pressed", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-switch-cal-2"));

    await waitFor(() => expect(useCalendarMembers).toHaveBeenLastCalledWith("cal-2"));
  });

  it("shows a remove button only for the owner and removes the member from the list on success", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    const refetch = jest.fn();
    (useCalendarMembers as jest.Mock).mockReturnValue({
      members: MEMBERS_CAL_1,
      isLoading: false,
      error: null,
      refetch,
    });
    const removeMemberMock = jest.fn().mockResolvedValue(true);
    (useRemoveMember as jest.Mock).mockReturnValue({
      removeMember: removeMemberMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    expect(getByTestId("remove-member-user-2")).toBeTruthy();
    expect(queryByTestId("remove-member-user-1")).toBeNull();

    await fireEvent.press(getByTestId("remove-member-user-2"));

    await waitFor(() => expect(removeMemberMock).toHaveBeenCalledWith("cal-1", "user-2"));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("hides remove buttons when the caller is not the owner", async () => {
    (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-2" } } });
    (useMyCalendars as jest.Mock).mockReturnValue({
      calendars: CALENDARS,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useCalendarMembers as jest.Mock).mockReturnValue({
      members: MEMBERS_CAL_1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useRemoveMember as jest.Mock).mockReturnValue({
      removeMember: jest.fn(),
      isSubmitting: false,
      error: null,
    });
    (useCreateEvent as jest.Mock).mockReturnValue({
      createEvent: jest.fn().mockResolvedValue({ id: "event-created-1" }),
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
    (useCreateInvite as jest.Mock).mockReturnValue({
      createInvite: jest.fn().mockResolvedValue(null),
      isSubmitting: false,
      error: null,
    });
    (useJoinByInvite as jest.Mock).mockReturnValue({
      joinByInvite: jest.fn().mockResolvedValue(true),
      isSubmitting: false,
      error: null,
    });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: [], isLoading: false, error: null, refetch: jest.fn() });
    (useCreateTag as jest.Mock).mockReturnValue({ createTag: jest.fn(), isSubmitting: false, error: null });
    (useUpdateTag as jest.Mock).mockReturnValue({ updateTag: jest.fn(), isSubmitting: false, error: null });
    (useDeleteTag as jest.Mock).mockReturnValue({ deleteTag: jest.fn(), isSubmitting: false, error: null });
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: jest.fn(),
      isSubmitting: false,
      error: null,
    });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { queryByTestId } = await render(<CalendarScreen />);

    expect(queryByTestId("remove-member-user-1")).toBeNull();
    expect(queryByTestId("remove-member-user-2")).toBeNull();
  });

  it("shows the month label and queries the month range", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const today = new Date("2026-08-18T12:00:00.000Z");
    const { getByText } = await render(<CalendarScreen />);

    expect(getByText("2026年8月")).toBeTruthy();
    await waitFor(() =>
      expect(useEventsInRange).toHaveBeenLastCalledWith("cal-1", computeDateRange("month", today))
    );
  });

  it("renders a month grid with a cell for today and for each day, highlighting today", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(getByTestId("calendar-grid-cell-2026-08-18")).toBeTruthy();
    expect(getByTestId("calendar-grid-cell-2026-08-01")).toBeTruthy();
    expect(getByTestId("calendar-grid-cell-2026-08-31")).toBeTruthy();
  });

  it("shows event dots on grid cells that have events", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(getByTestId("calendar-grid-dot-event-1")).toBeTruthy();
    expect(getByTestId("calendar-grid-dot-event-2")).toBeTruthy();
  });

  it("shows a few characters of the event title inside its grid marker", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT],
      isLoading: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    expect(within(getByTestId("calendar-grid-dot-event-1")).getByText("朝会")).toBeTruthy();
  });

  it("colors the grid marker and day-list dot with the event's primary tag color when tagged", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [{ ...TODAY_EVENT, categoryColor: "#2f6fed", tagColor: "#e53935" }],
      isLoading: false,
      error: null,
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
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [multiDayEvent],
      isLoading: false,
      error: null,
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

  it("colors Saturday blue and Sunday/holidays red in the weekday header and grid day numbers", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

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
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    expect(getByTestId("calendar-event-event-1")).toBeTruthy();
    expect(queryByTestId("calendar-event-event-2")).toBeNull();

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));

    expect(getByTestId("calendar-event-event-2")).toBeTruthy();
    expect(queryByTestId("calendar-event-event-1")).toBeNull();
  });

  it("shows the selected day's events in a slide-up modal, with its date in the header, closed by default", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT],
      isLoading: false,
      error: null,
    });

    const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);

    expect(queryByTestId("calendar-event-event-1")).toBeNull();

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    expect(getByText("8月18日 火曜日")).toBeTruthy();
    expect(getByTestId("calendar-event-event-1")).toBeTruthy();
  });

  it("shows an empty message in the day-events modal when the selected day has no events", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    expect(getByText("予定はありません")).toBeTruthy();
  });

  it("closes the day-events modal from its close button", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [TODAY_EVENT], isLoading: false, error: null });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    expect(getByTestId("calendar-event-event-1")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-day-modal-close"));

    expect(queryByTestId("calendar-event-event-1")).toBeNull();
  });

  it("opens the create-event modal, pre-filled for the selected day, from the day-events modal's + button", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));
    await fireEvent.press(getByTestId("calendar-day-modal-add"));

    expect(queryByTestId("calendar-event-event-1")).toBeNull();
    expect(getByTestId("event-create-title-input")).toBeTruthy();
  });

  it("resets to today's events when the today button is pressed", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));
    expect(getByTestId("calendar-event-event-2")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-today-button"));

    expect(getByTestId("calendar-event-event-1")).toBeTruthy();
    expect(queryByTestId("calendar-event-event-2")).toBeNull();
  });

  it("moves to the next/previous month and updates the label and query range", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-month-next"));
    expect(getByText("2026年9月")).toBeTruthy();
    await waitFor(() =>
      expect(useEventsInRange).toHaveBeenLastCalledWith(
        "cal-1",
        computeDateRange("month", new Date("2026-09-18T12:00:00.000Z"))
      )
    );

    await fireEvent.press(getByTestId("calendar-month-prev"));
    await fireEvent.press(getByTestId("calendar-month-prev"));
    expect(getByText("2026年7月")).toBeTruthy();
  });

  it("jumps to the month/day and switches to the calendar given via ?date=&calendarId= (e.g. from the ToDo screen)", async () => {
    mockCommonHooks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ date: "2026-09-10", calendarId: "cal-2" });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByText } = await render(<CalendarScreen />);

    expect(getByText("2026年9月")).toBeTruthy();
    await waitFor(() =>
      expect(useEventsInRange).toHaveBeenLastCalledWith(
        "cal-2",
        computeDateRange("month", new Date("2026-09-10T00:00:00.000Z"))
      )
    );

    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  it("opens the creation modal from the FAB and cancels without creating", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
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

  it("creates a new event with title/dates/color from the modal and refetches the range", async () => {
    mockCommonHooks();
    const refetch = jest.fn();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch });
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

    await fireEvent.press(getByTestId("event-create-color-green"));
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith({
        calendarId: "cal-1",
        title: "誕生日会",
        startAt: "2026-09-01T10:00:00.000Z",
        endAt: "2026-09-01T12:00:00.000Z",
        isAllDay: true,
        categoryColor: "#43a047",
      })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    await waitFor(() => expect(queryByTestId("event-create-title-input")).toBeNull());
  });

  it("includes location and url when provided", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "オンライン飲み会");
    await fireEvent.changeText(getByTestId("event-create-location-input"), "自宅");
    await fireEvent.changeText(getByTestId("event-create-url-input"), "https://example.com/meeting");
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ location: "自宅", url: "https://example.com/meeting" })
      )
    );
  });

  it("adds checklist ToDo items to the created event when the ToDo toggle is on", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
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

  it("does not create ToDo items when the ToDo toggle is off", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
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
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    const refetchTagTree = jest.fn();
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: [], isLoading: false, error: null, refetch: refetchTagTree });
    const createTagMock = jest.fn().mockResolvedValue(true);
    (useCreateTag as jest.Mock).mockReturnValue({ createTag: createTagMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-manage-tags-button"));
    await fireEvent.press(getByTestId("tag-management-new-button"));
    await fireEvent.changeText(getByTestId("edit-tag-name-input"), "旅行");
    await fireEvent.press(getByTestId("edit-tag-save-button"));

    await waitFor(() =>
      expect(createTagMock).toHaveBeenCalledWith({
        calendarId: "cal-1",
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
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
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
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
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
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [TODAY_EVENT], isLoading: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
    await fireEvent.press(getByTestId("calendar-event-event-1"));

    expect(router.push).toHaveBeenCalledWith("/event/event-1");
  });

  it("defaults new events to all-day (the all-day toggle starts on)", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
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
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
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

  it("shows an onboarding message and the add-calendar button when the caller has no calendars", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: [], isLoading: false, error: null, refetch: jest.fn() });
    (useCalendarMembers as jest.Mock).mockReturnValue({ members: [], isLoading: false, error: null, refetch: jest.fn() });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByText, getByTestId } = await render(<CalendarScreen />);

    expect(getByText("カレンダーがありません。作成するか、招待コードで参加してください。")).toBeTruthy();
    expect(getByTestId("calendar-add-button")).toBeTruthy();
  });

  it("creates a new calendar from the onboarding modal and refetches the calendar list", async () => {
    mockCommonHooks();
    const refetchCalendars = jest.fn();
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: [], isLoading: false, error: null, refetch: refetchCalendars });
    (useCalendarMembers as jest.Mock).mockReturnValue({ members: [], isLoading: false, error: null, refetch: jest.fn() });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    const createCalendarMock = jest.fn().mockResolvedValue(true);
    (useCreateCalendar as jest.Mock).mockReturnValue({ createCalendar: createCalendarMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-button"));
    await fireEvent.changeText(getByTestId("calendar-create-name-input"), "我が家");
    await fireEvent.press(getByTestId("calendar-create-submit"));

    await waitFor(() => expect(createCalendarMock).toHaveBeenCalledWith({ name: "我が家" }));
    await waitFor(() => expect(refetchCalendars).toHaveBeenCalled());
  });

  it("joins a calendar via invite code from the onboarding modal", async () => {
    mockCommonHooks();
    const refetchCalendars = jest.fn();
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: [], isLoading: false, error: null, refetch: refetchCalendars });
    (useCalendarMembers as jest.Mock).mockReturnValue({ members: [], isLoading: false, error: null, refetch: jest.fn() });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    const joinByInviteMock = jest.fn().mockResolvedValue(true);
    (useJoinByInvite as jest.Mock).mockReturnValue({ joinByInvite: joinByInviteMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-button"));
    await fireEvent.changeText(getByTestId("calendar-join-code-input"), "ABC123");
    await fireEvent.press(getByTestId("calendar-join-submit"));

    await waitFor(() => expect(joinByInviteMock).toHaveBeenCalledWith("ABC123"));
    await waitFor(() => expect(refetchCalendars).toHaveBeenCalled());
  });

  it("generates and shows an invite code for the active calendar", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    const createInviteMock = jest.fn().mockResolvedValue({
      id: "invite-1",
      calendarId: "cal-1",
      code: "XYZ789",
      expiresAt: "2026-09-01T00:00:00.000Z",
      createdBy: "user-1",
      createdAt: "2026-08-22T00:00:00.000Z",
    });
    (useCreateInvite as jest.Mock).mockReturnValue({ createInvite: createInviteMock, isSubmitting: false, error: null });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-invite-button"));

    await waitFor(() => expect(createInviteMock).toHaveBeenCalledWith("cal-1"));
    expect(getByText("XYZ789")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-invite-close"));
    expect(() => getByText("XYZ789")).toThrow();
  });

  it("shows an error message when calendar creation fails", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: [], isLoading: false, error: null, refetch: jest.fn() });
    (useCalendarMembers as jest.Mock).mockReturnValue({ members: [], isLoading: false, error: null, refetch: jest.fn() });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    (useCreateCalendar as jest.Mock).mockReturnValue({
      createCalendar: jest.fn().mockResolvedValue(false),
      isSubmitting: false,
      error: { type: "ValidationError", field: "name" },
    });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-button"));
    await fireEvent.press(getByTestId("calendar-create-submit"));

    expect(getByText("カレンダー名を入力してください")).toBeTruthy();
  });

  it("shows an error message when joining by invite fails", async () => {
    mockCommonHooks();
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: [], isLoading: false, error: null, refetch: jest.fn() });
    (useCalendarMembers as jest.Mock).mockReturnValue({ members: [], isLoading: false, error: null, refetch: jest.fn() });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    (useJoinByInvite as jest.Mock).mockReturnValue({
      joinByInvite: jest.fn().mockResolvedValue(false),
      isSubmitting: false,
      error: { type: "InviteExpired" },
    });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-button"));
    await fireEvent.press(getByTestId("calendar-join-submit"));

    expect(getByText("招待コードが無効か、有効期限が切れています")).toBeTruthy();
  });

  it("shows an error message when event creation fails", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
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
});
