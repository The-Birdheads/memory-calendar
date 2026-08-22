import { fireEvent, render, waitFor } from "@testing-library/react-native";

import CalendarScreen from "../calendar";
import { useAuthSession } from "../../../src/features/auth/hooks";
import { useCalendarMembers, useMyCalendars, useRemoveMember } from "../../../src/features/calendars/hooks";
import { computeDateRange } from "../../../src/features/events/dateRange";
import { useCreateEvent, useEventsInRange } from "../../../src/features/events/hooks";

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
  useCalendarMembers: jest.fn(),
  useRemoveMember: jest.fn(),
}));

jest.mock("../../../src/features/events/hooks", () => ({
  useEventsInRange: jest.fn(),
  useCreateEvent: jest.fn(),
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
  { calendarId: "cal-1", userId: "user-1", role: "owner", joinedAt: "2026-08-17T00:00:00.000Z" },
  { calendarId: "cal-1", userId: "user-2", role: "viewer", joinedAt: "2026-08-17T00:00:00.000Z" },
];

const TODAY_EVENT = {
  id: "event-1",
  calendarId: "cal-1",
  title: "朝会",
  categoryColor: "#2f6fed",
  startAt: "2026-08-18T09:00:00.000Z",
  endAt: "2026-08-18T09:30:00.000Z",
};

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
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
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
    createEvent: jest.fn().mockResolvedValue(true),
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
    expect(getByText("user-1")).toBeTruthy();
    expect(getByText("user-2")).toBeTruthy();
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
    (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
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
      createEvent: jest.fn().mockResolvedValue(true),
      isSubmitting: false,
      error: null,
    });
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { queryByTestId } = await render(<CalendarScreen />);

    expect(queryByTestId("remove-member-user-1")).toBeNull();
    expect(queryByTestId("remove-member-user-2")).toBeNull();
  });

  it("defaults to month view, shows the month label, and switches to week view when pressed", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const today = new Date("2026-08-18T12:00:00.000Z");
    const { getByTestId, getByText } = await render(<CalendarScreen />);

    expect(getByText("2026年8月")).toBeTruthy();
    await waitFor(() =>
      expect(useEventsInRange).toHaveBeenLastCalledWith("cal-1", computeDateRange("month", today))
    );

    await fireEvent.press(getByTestId("calendar-view-week"));

    await waitFor(() =>
      expect(useEventsInRange).toHaveBeenLastCalledWith("cal-1", computeDateRange("week", today))
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

  it("shows only the selected date's events, colored by category, and updates when a grid cell is selected", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
    });

    const { getByText, queryByText, getByTestId } = await render(<CalendarScreen />);

    expect(getByText("朝会")).toBeTruthy();
    expect(queryByText("外出")).toBeNull();

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));

    expect(getByText("外出")).toBeTruthy();
    expect(queryByText("朝会")).toBeNull();
  });

  it("resets to today's events when the today button is pressed", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, OTHER_DAY_EVENT],
      isLoading: false,
      error: null,
    });

    const { getByText, queryByText, getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-20"));
    expect(getByText("外出")).toBeTruthy();

    await fireEvent.press(getByTestId("calendar-today-button"));

    expect(getByText("朝会")).toBeTruthy();
    expect(queryByText("外出")).toBeNull();
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

  it("shows a horizontal date strip in week view", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-view-week"));

    expect(getByTestId("calendar-date-2026-08-18")).toBeTruthy();
    expect(queryByTestId("calendar-grid-cell-2026-08-18")).toBeNull();
  });

  it("opens the creation modal from the FAB and cancels without creating", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
    const createEventMock = jest.fn().mockResolvedValue(true);
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
    const createEventMock = jest.fn().mockResolvedValue(true);
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
        isAllDay: false,
        categoryColor: "#43a047",
      })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    await waitFor(() => expect(queryByTestId("event-create-title-input")).toBeNull());
  });

  it("passes isAllDay true when the all-day toggle is on", async () => {
    mockCommonHooks();
    (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue(true);
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "旅行");
    await fireEvent.press(getByTestId("event-create-allday-toggle"));

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
});
