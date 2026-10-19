import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Linking, StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import CalendarScreen from "../calendar";
import { useSetEventAssignees } from "../../../src/features/assignees/hooks";
import { AdsProvider, useAds } from "../../../src/features/ads/AdsProvider";
import { useOnboarding } from "../../../src/features/onboarding/hooks";
import { useReleaseNotes } from "../../../src/features/releaseNotes/hooks";
import { RELEASE_NOTES } from "../../../src/features/releaseNotes/releases";
import { ONBOARDING_SLIDES } from "../../../src/features/onboarding/slides";
import { useRemoveMyAvatar, useUploadMyAvatar, useAvatarUrls } from "../../../src/features/profile/avatarHooks";
import { useAuthActions, useAuthSession } from "../../../src/features/auth/hooks";
import { useDeleteAccount, useMyProfile, useUpdateDisplayName, useUpdateWeekStartsOn } from "../../../src/features/profile/hooks";
import {
  useCalendarMembers,
  useCreateCalendar,
  useCreateInvite,
  useJoinByInvite,
  useLeaveOrDeleteCalendar,
  useMyCalendars,
  useRemoveMember,
  useUpdateCalendarColor,
  useUpdateCalendarName,
} from "../../../src/features/calendars/hooks";
import { computeDateKeyRange } from "../../../src/features/events/dateRange";
import {
  useCreateEventReminders,
  useCreateEvent,
  useEventsInRangeForCalendars,
} from "../../../src/features/events/hooks";
import {
  useAttachTagsToEvent,
  useAttachTagsToEvents,
  useCreateTag,
  useDeleteTag,
  useEventTagsByEvents,
  useRemoveAllTagsFromEvents,
  useTagTree,
  useUpdateTag,
} from "../../../src/features/tags/hooks";
import { useCreateTodo } from "../../../src/features/todos/hooks";
import { useAttachPhoto } from "../../../src/features/memories/hooks";
import { pickPhotoFromLibrary } from "../../../src/features/memories/imagePicker";

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
  useAuthActions: jest.fn(),
}));

jest.mock("expo-tracking-transparency", () => ({
  requestTrackingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: "granted" }),
}));

jest.mock("../../../src/features/releaseNotes/hooks", () => ({
  useReleaseNotes: jest.fn(),
}));

jest.mock("../../../src/features/onboarding/hooks", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("../../../src/features/assignees/hooks", () => ({
  useSetEventAssignees: jest.fn(),
}));

jest.mock("../../../src/features/profile/avatarHooks", () => ({
  useAvatarUrls: jest.fn(),
  useUploadMyAvatar: jest.fn(),
  useRemoveMyAvatar: jest.fn(),
}));

jest.mock("../../../src/features/profile/hooks", () => ({
  useMyProfile: jest.fn(),
  useUpdateDisplayName: jest.fn(),
  useUpdateWeekStartsOn: jest.fn(),
  useDeleteAccount: jest.fn(),
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
  useCalendarMembers: jest.fn(),
  useRemoveMember: jest.fn(),
  useLeaveOrDeleteCalendar: jest.fn(),
  useCreateCalendar: jest.fn(),
  useUpdateCalendarColor: jest.fn(),
  useUpdateCalendarName: jest.fn(),
  useCreateInvite: jest.fn(),
  useJoinByInvite: jest.fn(),
}));

jest.mock("../../../src/features/events/hooks", () => ({
  useEventsInRangeForCalendars: jest.fn(),
  useCreateEvent: jest.fn(),
  useCreateEventReminders: jest.fn(),
}));

jest.mock("../../../src/features/todos/hooks", () => ({
  useCreateTodo: jest.fn(),
}));

jest.mock("../../../src/features/memories/hooks", () => ({
  useAttachPhoto: jest.fn(),
}));

jest.mock("../../../src/features/memories/imagePicker", () => ({
  pickPhotoFromLibrary: jest.fn(),
}));

jest.mock("../../../src/features/tags/hooks", () => {
  const actual = jest.requireActual("../../../src/features/tags/hooks");
  return {
    useTagTree: jest.fn(),
    useCreateTag: jest.fn(),
    useUpdateTag: jest.fn(),
    useDeleteTag: jest.fn(),
    useAttachTagsToEvent: jest.fn(),
    useAttachTagsToEvents: jest.fn(),
    useRemoveAllTagsFromEvents: jest.fn(),
    useEventTagsByEvents: jest.fn(),
    // useBulkTagSelection is pure client-side selection state (no Supabase
    // calls) and already has its own dedicated test suite - using the real
    // implementation here lets these integration tests exercise the actual
    // bulk-mode UI flow instead of re-mocking that state machine.
    useBulkTagSelection: actual.useBulkTagSelection,
  };
});

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
  (useOnboarding as jest.Mock).mockReturnValue({ isVisible: false, show: jest.fn(), complete: jest.fn() });
  (useReleaseNotes as jest.Mock).mockReturnValue({ isVisible: false, show: jest.fn(), close: jest.fn() });
  (useSetEventAssignees as jest.Mock).mockReturnValue({
    setEventAssignees: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useAvatarUrls as jest.Mock).mockReturnValue({});
  (useUploadMyAvatar as jest.Mock).mockReturnValue({ uploadAvatar: jest.fn(), isSubmitting: false, error: null });
  (useRemoveMyAvatar as jest.Mock).mockReturnValue({ removeAvatar: jest.fn(), isSubmitting: false, error: null });
  (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } } });
  (useAuthActions as jest.Mock).mockReturnValue({ signOut: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useMyProfile as jest.Mock).mockReturnValue({
    profile: { id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn: 0 },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useUpdateDisplayName as jest.Mock).mockReturnValue({ updateDisplayName: jest.fn(), isSubmitting: false, error: null });
  (useUpdateWeekStartsOn as jest.Mock).mockReturnValue({ updateWeekStartsOn: jest.fn(), isSubmitting: false, error: null });
  (useDeleteAccount as jest.Mock).mockReturnValue({ deleteAccount: jest.fn(), isSubmitting: false, error: null });
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
  (useCreateEventReminders as jest.Mock).mockReturnValue({
    createEventReminders: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useCreateTodo as jest.Mock).mockReturnValue({
    createTodo: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useAttachPhoto as jest.Mock).mockReturnValue({
    attachPhoto: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (pickPhotoFromLibrary as jest.Mock).mockResolvedValue(null);
  (useCreateCalendar as jest.Mock).mockReturnValue({
    createCalendar: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateCalendarName as jest.Mock).mockReturnValue({
    updateCalendarName: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateCalendarColor as jest.Mock).mockReturnValue({
    updateCalendarColor: jest.fn().mockResolvedValue(true),
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
  (useAttachTagsToEvents as jest.Mock).mockReturnValue({
    attachTagsToEvents: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useRemoveAllTagsFromEvents as jest.Mock).mockReturnValue({
    removeAllTagsFromEvents: jest.fn().mockResolvedValue(true),
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

  it("refetches tags when the tab regains focus, so a tag change made elsewhere shows up (regression)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const refetchEventTags = jest.fn();
    (useEventTagsByEvents as jest.Mock).mockReturnValue({
      tagsByEventId: {},
      isLoading: false,
      error: null,
      refetch: refetchEventTags,
    });

    await render(<CalendarScreen />);

    await waitFor(() => expect(refetchEventTags).toHaveBeenCalled());
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
      expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"], expect.anything(), expect.anything())
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

    await waitFor(() => expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1"], expect.anything(), expect.anything()));
  });

  it("reselects a calendar (toggling it back on) when its deselected chip is pressed again", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-filter"));

    await fireEvent.press(getByTestId("calendar-switch-cal-2"));
    await waitFor(() => expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1"], expect.anything(), expect.anything()));

    await fireEvent.press(getByTestId("calendar-switch-cal-2"));

    await waitFor(() =>
      expect(useEventsInRangeForCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"], expect.anything(), expect.anything())
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
        computeDateKeyRange("2026-07-26", "2026-09-05"),
        expect.anything()
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

  it("pre-renders the adjacent month's grid structure on both sides, so a swipe reveals it immediately instead of a blank gap (regression)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    // Focused month is 2026-08 (see beforeEach's fixed "now") - the
    // previous/next panes should already have July/September's own day
    // cells rendered, not be empty placeholders.
    expect(getByTestId("calendar-grid-prev-cell-2026-07-15")).toBeTruthy();
    expect(getByTestId("calendar-grid-next-cell-2026-09-15")).toBeTruthy();
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

  it("uses a readable font size for the event title inside its grid marker (regression: text was too small to read)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const titleStyle = flattenStyle(within(getByTestId("calendar-grid-dot-event-1")).getByText("朝会").props.style);
    expect(titleStyle.fontSize).toBeGreaterThanOrEqual(10);
  });

  it("colors the grid marker and day-list dot with the event's primary tag color when tagged", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [{ ...TODAY_EVENT, categoryColor: "#2f6fed", tagColor: "#e53935", isAllDay: true }],
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

  it("shows a multi-day event as one connected banner spanning the days it touches (TimeTree-style), and opens the day it was pressed on", async () => {
    mockCommonHooks();
    const multiDayEvent = {
      id: "event-3",
      calendarId: "cal-1",
      title: "旅行",
      categoryColor: "#43a047",
      // 2026-08-18(Tue) JST 18:00 through 08-20(Thu) JST 19:00 - entirely
      // within one week, so it renders as a single banner, not per-day dots.
      startAt: "2026-08-18T09:00:00.000Z",
      endAt: "2026-08-20T10:00:00.000Z",
    };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [multiDayEvent],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    // No more per-day dots for a banner-eligible multi-day event.
    expect(queryByTestId("calendar-grid-dot-event-3")).toBeNull();

    // One connected banner for the week it falls in.
    const banner = getByTestId("calendar-grid-banner-event-3-week-3");
    expect(within(banner).getByText("旅行")).toBeTruthy();

    await fireEvent.press(banner);
    // Pressing the banner opens the day it starts on (its own colStart).
    expect(getByTestId("calendar-event-event-3")).toBeTruthy();
  });

  it("insets the banner's left/right edges by the same margin a normal pill has within its cell, so the two line up (regression: the banner touched the cell edges while pills had a small margin, making it look wider/misaligned)", async () => {
    mockCommonHooks();
    const multiDayEvent = {
      id: "event-3",
      calendarId: "cal-1",
      title: "旅行",
      categoryColor: "#43a047",
      startAt: "2026-08-18T09:00:00.000Z",
      endAt: "2026-08-20T10:00:00.000Z",
    };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [multiDayEvent],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const bannerStyle = flattenStyle(getByTestId("calendar-grid-banner-event-3-week-3").props.style);

    // Tue (colStart=2) - Thu (colEnd=4). The test window is 750pt wide (see
    // useWindowDimensions' jest-expo default) minus the grid's own 8pt
    // horizontal padding on each side (GRID_HORIZONTAL_PADDING) -> paneWidth
    // = 750 - 16 = 734, split into 7 equal day columns.
    const paneWidth = 750 - 16;
    const colWidth = paneWidth / 7;
    const pillInset = 2; // GRID_CELL_PILL_INSET, matching gridEventList's own paddingHorizontal
    expect(bannerStyle.left).toBeCloseTo(2 * colWidth + pillInset);
    expect(bannerStyle.width).toBeCloseTo(3 * colWidth - pillInset * 2);
  });

  it("does not push down other days' events in the same week when only some days have a multi-day banner (regression: every day in the week got an extra blank row)", async () => {
    mockCommonHooks();
    const multiDayEvent = {
      id: "event-3",
      calendarId: "cal-1",
      title: "旅行",
      categoryColor: "#43a047",
      // 2026-08-18(Tue)〜08-20(Thu) - falls in the week of 08-16〜08-22.
      startAt: "2026-08-18T09:00:00.000Z",
      endAt: "2026-08-20T10:00:00.000Z",
    };
    // 08-16(Sun) is in the same week as the banner, but the banner doesn't
    // touch it - its own event should sit flush at the top, not pushed
    // down to make room for a banner that isn't over this day at all.
    const sameWeekUnrelatedEvent = {
      ...TODAY_EVENT,
      id: "event-4",
      title: "無関係",
      startAt: "2026-08-16T09:00:00.000Z",
      endAt: "2026-08-16T10:00:00.000Z",
    };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [multiDayEvent, sameWeekUnrelatedEvent],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const unrelatedDayEventList = flattenStyle(
      getByTestId("calendar-grid-cell-events-2026-08-16").props.style
    );
    expect(unrelatedDayEventList.marginTop ?? 0).toBe(0);

    // A day the banner actually covers still reserves room for it.
    const bannerDayEventList = flattenStyle(
      getByTestId("calendar-grid-cell-events-2026-08-18").props.style
    );
    expect((bannerDayEventList.marginTop as number) ?? 0).toBeGreaterThan(0);
  });

  it("fills the lane left blank above a day's events, once the multi-day bar occupying a lower lane no longer reaches that day, with that day's own single-day event instead of leaving it blank (regression)", async () => {
    mockCommonHooks();
    // e-lane0 (lane0) covers only 08-02..08-03; e-lane1 (forced to lane1
    // since it overlaps e-lane0 on 08-03) covers 08-03..08-04. So on 08-04,
    // lane0 is free even though the day still reserves 2 rows of space.
    const laneZeroEvent = {
      id: "event-lane0",
      calendarId: "cal-1",
      title: "前半だけ",
      categoryColor: "#43a047",
      startAt: "2026-08-02T09:00:00.000Z",
      endAt: "2026-08-03T10:00:00.000Z",
    };
    const laneOneEvent = {
      id: "event-lane1",
      calendarId: "cal-1",
      title: "後半まで",
      categoryColor: "#43a047",
      startAt: "2026-08-03T09:00:00.000Z",
      endAt: "2026-08-04T10:00:00.000Z",
    };
    const gapFillCandidate = {
      ...TODAY_EVENT,
      id: "event-gapfill",
      title: "単日の予定",
      startAt: "2026-08-04T09:00:00.000Z",
      endAt: "2026-08-04T10:00:00.000Z",
      isAllDay: true,
    };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [laneZeroEvent, laneOneEvent, gapFillCandidate],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    // 08-02..08-08 is week index 1 (see the banner tests above for the week
    // numbering); 08-04 is column 2 (Tuesday).
    const gapFillBanner = getByTestId("calendar-grid-gapfill-event-gapfill-week-1");
    expect(within(gapFillBanner).getByText("単日の予定")).toBeTruthy();
    // It no longer renders as a normal below-the-banners pill/dot.
    expect(queryByTestId("calendar-grid-dot-event-gapfill")).toBeNull();
  });

  it("splits a multi-day event that crosses a week boundary into a banner per week, without per-day dots", async () => {
    mockCommonHooks();
    const multiDayEvent = {
      id: "event-3",
      calendarId: "cal-1",
      title: "旅行",
      categoryColor: "#43a047",
      // 2026-08-14(Fri) through 08-17(Mon) crosses the Sat/Sun boundary
      // between two weeks.
      startAt: "2026-08-14T09:00:00.000Z",
      endAt: "2026-08-17T10:00:00.000Z",
    };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [multiDayEvent],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    expect(queryByTestId("calendar-grid-dot-event-3")).toBeNull();
    expect(getByTestId("calendar-grid-banner-event-3-week-2")).toBeTruthy();
    expect(getByTestId("calendar-grid-banner-event-3-week-3")).toBeTruthy();
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

  it("uses a readable font size for the event title in the day's event list (regression: text was too small to read)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const titleStyle = flattenStyle(within(getByTestId("calendar-event-event-1")).getByText("朝会").props.style);
    expect(titleStyle.fontSize).toBeGreaterThanOrEqual(15);
  });

  it("doesn't reserve a fixed-width column for the time text in the day's event list, so the title's indent follows the time text's own length instead of always starting from the same x (regression: a fixed width left extra empty space after '終日')", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [{ ...TODAY_EVENT, isAllDay: true }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);
    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const timeStyle = flattenStyle(within(getByTestId("calendar-event-event-1")).getByText("終日").props.style);
    expect(timeStyle.width).toBeUndefined();
  });

  it("shows a timed (non all-day) event's grid pill with a translucent background and colored title text, distinguishing it from an all-day event's solid background and white text (regression: both looked the same)", async () => {
    mockCommonHooks();
    const timedEvent = { ...TODAY_EVENT, id: "event-timed", tagColor: "#e53935", isAllDay: false };
    const allDayEvent = { ...TODAY_EVENT, id: "event-allday", tagColor: "#e53935", isAllDay: true };
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [timedEvent, allDayEvent],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId } = await render(<CalendarScreen />);

    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const timedPillStyle = flattenStyle(getByTestId("calendar-grid-dot-event-timed").props.style);
    const timedTitleStyle = flattenStyle(
      within(getByTestId("calendar-grid-dot-event-timed")).getByText("朝会").props.style
    );
    const allDayPillStyle = flattenStyle(getByTestId("calendar-grid-dot-event-allday").props.style);
    const allDayTitleStyle = flattenStyle(
      within(getByTestId("calendar-grid-dot-event-allday")).getByText("朝会").props.style
    );

    expect(allDayPillStyle.backgroundColor).toBe("#e53935");
    expect(allDayTitleStyle.color).toBe("#fff");
    expect(timedPillStyle.backgroundColor).toBe("rgba(229, 57, 53, 0.18)");
    expect(timedTitleStyle.color).toBe("#e53935");
  });

  it("separates each event in the day-events modal with a thin light line, but not before the first or after the last", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT, { ...TODAY_EVENT, id: "event-today-2", title: "ランチ" }, { ...TODAY_EVENT, id: "event-today-3", title: "夕食" }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, getAllByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    const separators = getAllByTestId("calendar-day-modal-separator");
    expect(separators).toHaveLength(2);
    const flattenStyle = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    const separatorStyle = flattenStyle(separators[0].props.style);
    expect(separatorStyle.height).toBe(StyleSheet.hairlineWidth);
    expect(separatorStyle.backgroundColor).toBe("#e5e7eb");
  });

  it("draws no separator in the day-events modal when the day has a single event", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [TODAY_EVENT],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

    expect(queryByTestId("calendar-day-modal-separator")).toBeNull();
  });

  it("draws the settings gear in the same neutral dark gray as the other header icons, not accent blue", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(<CalendarScreen />);

    const flatten = (style: unknown): Record<string, unknown> =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
    expect(flatten(getByTestId("calendar-settings-icon").props.style).tintColor).toBe("#444");
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
        computeDateKeyRange("2026-08-30", "2026-10-03"),
        expect.anything()
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
        computeDateKeyRange("2026-08-30", "2026-10-03"),
        expect.anything()
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

  it("creates a new event with a memo entered via '+ メモを追加'", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");
    await fireEvent.press(getByTestId("event-create-memo-add"));
    await fireEvent.changeText(getByTestId("event-create-memo-input"), "プレゼントを忘れない");

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ memo: "プレゼントを忘れない" })
      )
    );
  });

  it("shows '作成中…' and disables the submit button while a create request is already in flight", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn();
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: true, error: null });

    const { getByTestId, getByText } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");

    expect(getByText("作成中…")).toBeTruthy();
    expect(getByTestId("event-create-submit").props.accessibilityState?.disabled).toBe(true);
  });

  it("does not call createEvent again while a request is already in flight (regression: double-tap created two events)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn();
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: true, error: null });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");
    await fireEvent.press(getByTestId("event-create-submit"));

    expect(createEventMock).not.toHaveBeenCalled();
  });

  it("colors an untagged event with its calendar's own default color", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
      events: [{ ...TODAY_EVENT, tagColor: null, isAllDay: true }],
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
    const createEventRemindersMock = jest.fn().mockResolvedValue(true);
    (useCreateEventReminders as jest.Mock).mockReturnValue({
      createEventReminders: createEventRemindersMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "誕生日会");
    // "now" is fixed at 2026-08-18T12:00:00.000Z (see beforeEach) - pick a future day so the
    // 当日/1日前 reminders aren't already in the past.
    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-09-01T00:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));
    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() =>
      expect(createEventRemindersMock).toHaveBeenCalledWith("event-created-1", [
        { kind: "on_day" },
        { kind: "day_before_1" },
      ])
    );
  });

  it("keeps the create-event sheet below the status bar (clock/camera/Wi-Fi) by padding the top of the overlay with the safe-area inset", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId } = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
        <CalendarScreen />
      </SafeAreaInsetsContext.Provider>
    );
    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    const overlayStyle = StyleSheet.flatten(getByTestId("event-create-overlay").props.style);
    expect(overlayStyle.paddingTop).toBeGreaterThanOrEqual(59);
  });

  describe("月グリッドの1日の枠に入るだけ予定を表示する", () => {
    // 2026-08-18(火)に n 件の単日予定を作る。
    function makeDayEvents(count: number) {
      return Array.from({ length: count }, (_, index) => ({
        id: `day-event-${index + 1}`,
        calendarId: "cal-1",
        title: `予定${index + 1}`,
        categoryColor: "#2f6fed",
        startAt: `2026-08-18T0${index % 9}:00:00.000Z`,
        endAt: `2026-08-18T0${index % 9}:30:00.000Z`,
      }));
    }

    async function renderWithEvents(count: number) {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: makeDayEvents(count),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      return render(<CalendarScreen />);
    }

    async function measureRows(utils: Awaited<ReturnType<typeof renderWithEvents>>, height: number) {
      const rows = utils.getAllByTestId(/^calendar-grid-row-\d+$/);
      for (const row of rows) {
        await fireEvent(row, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height } } });
      }
    }

    it("shows 3 events and a +N for the rest until the row height has been measured (the old fixed limit)", async () => {
      const { queryByTestId, getByTestId } = await renderWithEvents(5);

      expect(getByTestId("calendar-grid-dot-day-event-3")).toBeTruthy();
      expect(queryByTestId("calendar-grid-dot-day-event-4")).toBeNull();
      expect(getByTestId("calendar-grid-cell-overflow-2026-08-18").props.children).toEqual(["+", 2]);
    });

    it("shows a 4th event, with no +N, when the row is tall enough for 4 (the 4 events of a day all fit)", async () => {
      const utils = await renderWithEvents(4);
      await measureRows(utils, 93);

      expect(utils.getByTestId("calendar-grid-dot-day-event-4")).toBeTruthy();
      expect(utils.queryByTestId("calendar-grid-cell-overflow-2026-08-18")).toBeNull();
    });

    it("uses the last visible row for +N when the events don't all fit, showing as many as it can", async () => {
      const utils = await renderWithEvents(7);
      await measureRows(utils, 93);

      // 4行入る高さ: 予定3件 + 最後の行に +4
      expect(utils.getByTestId("calendar-grid-dot-day-event-3")).toBeTruthy();
      expect(utils.queryByTestId("calendar-grid-dot-day-event-4")).toBeNull();
      expect(utils.getByTestId("calendar-grid-cell-overflow-2026-08-18").props.children).toEqual(["+", 4]);
    });

    it("shows more events in a taller row (a month with fewer weeks)", async () => {
      const utils = await renderWithEvents(7);
      await measureRows(utils, 123);

      // 6行入る高さ: 予定5件 + +2
      expect(utils.getByTestId("calendar-grid-dot-day-event-5")).toBeTruthy();
      expect(utils.queryByTestId("calendar-grid-dot-day-event-6")).toBeNull();
      expect(utils.getByTestId("calendar-grid-cell-overflow-2026-08-18").props.children).toEqual(["+", 2]);
    });

    it("sizes the cells from this month's rows only, not from the prev/next month panes (regression: a 6-week next month made a 5-week month show only 3)", async () => {
      const utils = await renderWithEvents(4);
      await measureRows(utils, 93);
      // 前月・翌月のパネルは、週の数が違うと行の高さも違う(例: 翌月が6週で行が低い)。
      // それらが後から測れても、今月の枠に入る件数は変わらない。
      const otherPaneRows = [
        ...utils.getAllByTestId(/^calendar-grid-prev-row-\d+$/),
        ...utils.getAllByTestId(/^calendar-grid-next-row-\d+$/),
      ];
      for (const row of otherPaneRows) {
        await fireEvent(row, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 70 } } });
      }

      expect(utils.getByTestId("calendar-grid-dot-day-event-4")).toBeTruthy();
      expect(utils.queryByTestId("calendar-grid-cell-overflow-2026-08-18")).toBeNull();
    });

    it("shows fewer events in a shorter row", async () => {
      const utils = await renderWithEvents(4);
      await measureRows(utils, 78);

      // 3行入る高さ: 予定2件 + +2
      expect(utils.getByTestId("calendar-grid-dot-day-event-2")).toBeTruthy();
      expect(utils.queryByTestId("calendar-grid-dot-day-event-3")).toBeNull();
      expect(utils.getByTestId("calendar-grid-cell-overflow-2026-08-18").props.children).toEqual(["+", 2]);
    });
  });

  describe("広告", () => {
    function AdsStarter() {
      const { start } = useAds();
      start();
      return null;
    }

    async function renderWithAds(events: unknown[] = []) {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events, isLoading: false, error: null, refetch: jest.fn() });
      const utils = await render(
        <AdsProvider>
          <AdsStarter />
          <CalendarScreen />
        </AdsProvider>
      );
      await act(async () => {});
      return utils;
    }

    // 日付(2026-08-D)ごとに1件ずつ、count 日分の予定。
    function makeDailyEvents(count: number) {
      return Array.from({ length: count }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return {
          id: `daily-${index + 1}`,
          calendarId: "cal-1",
          title: `予定${index + 1}`,
          categoryColor: "#2f6fed",
          startAt: `2026-08-${day}T01:00:00.000Z`,
          endAt: `2026-08-${day}T02:00:00.000Z`,
        };
      });
    }

    async function measureMonthList(utils: Awaited<ReturnType<typeof renderWithAds>>, itemHeight: number, viewportHeight: number, count: number) {
      const list = utils.getByTestId("calendar-month-list");
      await fireEvent(list, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: viewportHeight } } });
      for (let index = 0; index < count; index += 1) {
        const day = String(index + 1).padStart(2, "0");
        const group = utils.queryByTestId(`calendar-month-list-date-group-2026-08-${day}`);
        if (group) {
          await fireEvent(group, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: itemHeight } } });
        }
      }
    }

    it("shows a banner at the bottom of the calendar tab (behind the + button) once ads are ready", async () => {
      const { getByTestId } = await renderWithAds();

      expect(getByTestId("calendar-bottom-ad")).toBeTruthy();
    });

    it("shows no ads at all while ads are not ready", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { queryByTestId } = await render(<CalendarScreen />);

      expect(queryByTestId("calendar-bottom-ad")).toBeNull();
    });

    it("asks the ads provider to start after a short delay, once the tutorial is not showing", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const { requestTrackingPermissionsAsync } = require("expo-tracking-transparency");
      (requestTrackingPermissionsAsync as jest.Mock).mockClear();

      await render(
        <AdsProvider>
          <CalendarScreen />
        </AdsProvider>
      );
      expect(requestTrackingPermissionsAsync).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(2500);
      });

      expect(requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("does not start the ads (and its tracking prompt) while the tutorial is showing", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      (useOnboarding as jest.Mock).mockReturnValue({ isVisible: true, show: jest.fn(), complete: jest.fn() });
      const { requestTrackingPermissionsAsync } = require("expo-tracking-transparency");
      (requestTrackingPermissionsAsync as jest.Mock).mockClear();

      await render(
        <AdsProvider>
          <CalendarScreen />
        </AdsProvider>
      );
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    });

    it("shows a large ad below the events in the day list", async () => {
      const utils = await renderWithAds([TODAY_EVENT]);

      await fireEvent.press(utils.getByTestId("calendar-grid-cell-2026-08-18"));

      expect(utils.getByTestId("calendar-day-ad")).toBeTruthy();
      expect(utils.getByTestId("calendar-day-ad-view").props.size).toBe("MEDIUM_RECTANGLE");
    });

    it("shows a large ad in the free space of a day with no events", async () => {
      const utils = await renderWithAds([]);

      await fireEvent.press(utils.getByTestId("calendar-grid-cell-2026-08-18"));

      expect(utils.getByText("予定はありません")).toBeTruthy();
      expect(utils.getByTestId("calendar-day-ad-empty")).toBeTruthy();
    });

    it("puts a banner after every 10 date groups in the list view, but not on the first screen", async () => {
      const utils = await renderWithAds(makeDailyEvents(25));
      await fireEvent.press(utils.getByTestId("calendar-view-mode-list"));

      // 1日分100・画面600: 最初の画面は6日分。10日ごとの1つ目(10日目の後)は、最初の画面より下。
      await measureMonthList(utils, 100, 600, 25);

      expect(utils.getByTestId("calendar-list-banner-after-9")).toBeTruthy();
      expect(utils.queryByTestId("calendar-list-banner-after-4")).toBeNull();
    });

    it("puts no banner in the list view when everything fits on the first screen", async () => {
      const utils = await renderWithAds(makeDailyEvents(12));
      await fireEvent.press(utils.getByTestId("calendar-view-mode-list"));

      await measureMonthList(utils, 100, 5000, 12);

      expect(utils.queryByTestId("calendar-list-banner-after-9")).toBeNull();
    });
  });

  describe("初回の案内(チュートリアル)", () => {
    function mockOnboarding(isVisible: boolean) {
      const complete = jest.fn();
      const show = jest.fn();
      (useOnboarding as jest.Mock).mockReturnValue({ isVisible, show, complete });
      return { complete, show };
    }

    async function finishTutorialWith(testID: string) {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const hooks = mockOnboarding(true);
      const utils = await render(<CalendarScreen />);
      // 最後の画面まで進む(スライドの枚数だけ「次へ」)。
      for (let i = 0; i < ONBOARDING_SLIDES.length; i += 1) {
        await fireEvent.press(utils.getByTestId("onboarding-next"));
      }
      await fireEvent.press(utils.getByTestId(testID));
      return { ...utils, ...hooks };
    }

    it("shows the tutorial over the calendar when the hook says it is the first time", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      mockOnboarding(true);

      const { getByTestId } = await render(<CalendarScreen />);

      expect(getByTestId("onboarding-title")).toBeTruthy();
    });

    it("does not show the tutorial when it was already completed", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { queryByTestId } = await render(<CalendarScreen />);

      expect(queryByTestId("onboarding-title")).toBeNull();
    });

    it("remembers it was completed when skipped", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const { complete } = mockOnboarding(true);

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("onboarding-skip"));

      expect(complete).toHaveBeenCalled();
    });

    it("opens the shared-calendar create form after the tutorial closes, when 共有カレンダーをつくる is chosen", async () => {
      const { complete, queryByTestId, getByTestId } = await finishTutorialWith("onboarding-create-calendar");

      expect(complete).toHaveBeenCalled();
      // 案内のモーダルが閉じきってから開く(iOS で、2つのモーダルが同時に切り替わらないように)。
      expect(queryByTestId("calendar-settings-create-description")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(getByTestId("calendar-settings-create-description")).toBeTruthy();
    });

    it("opens the create-event sheet after the tutorial closes, when 最初の予定を作る is chosen", async () => {
      const { complete, queryByTestId, getByTestId } = await finishTutorialWith("onboarding-create-event");

      expect(complete).toHaveBeenCalled();
      expect(queryByTestId("event-create-submit")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(getByTestId("event-create-submit")).toBeTruthy();
    });

    it("opens nothing else when あとで is chosen", async () => {
      const { complete, queryByTestId } = await finishTutorialWith("onboarding-later");

      expect(complete).toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(queryByTestId("calendar-settings-create-description")).toBeNull();
      expect(queryByTestId("event-create-submit")).toBeNull();
    });

    it("replays the tutorial from the personal settings: the settings close first, then the tutorial opens", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const { show } = mockOnboarding(false);

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-settings-icon"));
      await fireEvent.press(getByTestId("settings-hub-open-personal"));
      await fireEvent.press(getByTestId("personal-settings-tutorial"));

      expect(queryByTestId("personal-settings-tutorial")).toBeNull();
      expect(show).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(show).toHaveBeenCalled();
    });
  });

  describe("更新内容(リリースノート)", () => {
    it("shows the release notes when the hook says they are visible, and closes through the hook", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const close = jest.fn();
      (useReleaseNotes as jest.Mock).mockReturnValue({ isVisible: true, show: jest.fn(), close });

      const { getByTestId, getByText } = await render(<CalendarScreen />);

      expect(getByText(`バージョン ${RELEASE_NOTES[0].version}`)).toBeTruthy();
      await fireEvent.press(getByTestId("release-notes-close"));
      expect(close).toHaveBeenCalled();
    });

    it("keeps the release notes closed when the hook says they are hidden", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { queryByTestId } = await render(<CalendarScreen />);

      expect(queryByTestId("release-notes-close")).toBeNull();
    });

    it("waits for the tutorial: the hook is told it is blocked while the tutorial is open", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      (useOnboarding as jest.Mock).mockReturnValue({ isVisible: true, show: jest.fn(), complete: jest.fn() });

      await render(<CalendarScreen />);

      expect(useReleaseNotes).toHaveBeenLastCalledWith(expect.objectContaining({ isBlocked: true }));
    });

    it("opens the release notes from the personal settings: the settings close first, then the notes open", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const show = jest.fn();
      (useReleaseNotes as jest.Mock).mockReturnValue({ isVisible: false, show, close: jest.fn() });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-settings-icon"));
      await fireEvent.press(getByTestId("settings-hub-open-personal"));
      await fireEvent.press(getByTestId("personal-settings-release-notes"));

      expect(queryByTestId("personal-settings-release-notes")).toBeNull();
      expect(show).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(show).toHaveBeenCalled();
    });
  });

  describe("予定作成画面の対象者", () => {
    const MEMBERS = [
      { calendarId: "cal-2", userId: "user-1", role: "owner", joinedAt: "2026-08-17T00:00:00.000Z", displayName: "たろう", avatarPath: null },
      { calendarId: "cal-2", userId: "user-2", role: "editor", joinedAt: "2026-08-17T00:00:00.000Z", displayName: "はなこ", avatarPath: null },
    ];

    async function openCreateModalFor(calendarId: string) {
      mockCommonHooks();
      (useMyCalendars as jest.Mock).mockReturnValue({
        calendars: [
          { id: "cal-1", name: "Myカレンダー", kind: "personal", color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
          { id: "cal-2", name: "我が家", kind: "group", color: "#43a047", createdBy: "user-1", createdAt: "2026-08-17T01:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      (useCalendarMembers as jest.Mock).mockImplementation((id: string) => ({
        members: id === "cal-2" ? MEMBERS : [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      }));
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
      (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
      const setEventAssigneesMock = jest.fn().mockResolvedValue(true);
      (useSetEventAssignees as jest.Mock).mockReturnValue({
        setEventAssignees: setEventAssigneesMock,
        isSubmitting: false,
        error: null,
      });

      const utils = await render(<CalendarScreen />);
      await fireEvent.press(utils.getByTestId("calendar-add-event-fab"));
      await fireEvent.press(utils.getByTestId(`event-create-calendar-${calendarId}`));
      await fireEvent.changeText(utils.getByTestId("event-create-title-input"), "お出かけ");
      return { ...utils, createEventMock, setEventAssigneesMock };
    }

    it("offers the shared calendar's members as optional assignees, in the shared frame", async () => {
      const { getByTestId } = await openCreateModalFor("cal-2");

      const picker = within(getByTestId("event-create-shared-frame"));
      expect(picker.getByTestId("event-create-assignee-section")).toBeTruthy();
      expect(picker.getByTestId("event-create-assignee-member-user-1")).toBeTruthy();
      expect(picker.getByTestId("event-create-assignee-member-user-2")).toBeTruthy();
    });

    it("does not offer assignees for a personal calendar", async () => {
      const { queryByTestId } = await openCreateModalFor("cal-1");

      expect(queryByTestId("event-create-assignee-section")).toBeNull();
    });

    it("saves the chosen assignees on the new event when it is created", async () => {
      const { getByTestId, setEventAssigneesMock } = await openCreateModalFor("cal-2");

      await fireEvent.press(getByTestId("event-create-assignee-member-user-2"));
      expect(getByTestId("event-create-assignee-member-user-2-checked")).toBeTruthy();
      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() => expect(setEventAssigneesMock).toHaveBeenCalledWith("event-created-1", ["user-2"]));
    });

    it("lets a chosen assignee be un-chosen again", async () => {
      const { getByTestId, queryByTestId, setEventAssigneesMock, createEventMock } = await openCreateModalFor("cal-2");

      await fireEvent.press(getByTestId("event-create-assignee-member-user-2"));
      await fireEvent.press(getByTestId("event-create-assignee-member-user-2"));
      expect(queryByTestId("event-create-assignee-member-user-2-checked")).toBeNull();
      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() => expect(createEventMock).toHaveBeenCalled());
      expect(setEventAssigneesMock).not.toHaveBeenCalled();
    });

    it("sets no assignees by default (it is optional)", async () => {
      const { getByTestId, createEventMock, setEventAssigneesMock } = await openCreateModalFor("cal-2");

      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() => expect(createEventMock).toHaveBeenCalled());
      expect(setEventAssigneesMock).not.toHaveBeenCalled();
    });

    it("forgets the chosen assignees when the calendar is switched (they may not belong to the other one)", async () => {
      const { getByTestId, setEventAssigneesMock, createEventMock } = await openCreateModalFor("cal-2");

      await fireEvent.press(getByTestId("event-create-assignee-member-user-2"));
      await fireEvent.press(getByTestId("event-create-calendar-cal-1"));
      await fireEvent.press(getByTestId("event-create-calendar-cal-2"));
      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() => expect(createEventMock).toHaveBeenCalled());
      expect(setEventAssigneesMock).not.toHaveBeenCalled();
    });
  });

  describe("予定作成画面のリマインド", () => {
    async function openCreateModal() {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
      const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
      (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
      const createEventRemindersMock = jest.fn().mockResolvedValue(true);
      (useCreateEventReminders as jest.Mock).mockReturnValue({
        createEventReminders: createEventRemindersMock,
        isSubmitting: false,
        error: null,
      });
      const utils = await render(<CalendarScreen />);
      await fireEvent.press(utils.getByTestId("calendar-add-event-fab"));
      await fireEvent.changeText(utils.getByTestId("event-create-title-input"), "打ち合わせ");
      return { ...utils, createEventMock, createEventRemindersMock };
    }

    async function pickStartDate(getByTestId: (id: string) => unknown, iso: string) {
      await fireEvent.press(getByTestId("event-create-start-button") as never);
      await fireEvent.changeText(getByTestId("event-create-start-picker") as never, iso);
      await fireEvent.press(getByTestId("event-create-picker-done") as never);
    }

    it("shows the reminder section with the all-day defaults (当日, 1日前) checked", async () => {
      const { getByTestId, queryByTestId } = await openCreateModal();

      expect(getByTestId("event-create-reminder-option-on_day-checked")).toBeTruthy();
      expect(getByTestId("event-create-reminder-option-day_before_1-checked")).toBeTruthy();
      expect(queryByTestId("event-create-reminder-option-day_before_2-checked")).toBeNull();
    });

    it("switches to the timed options with 前日9時 checked by default when 終日 is turned off", async () => {
      const { getByTestId, queryByTestId } = await openCreateModal();

      await fireEvent.press(getByTestId("event-create-allday-toggle"));

      expect(getByTestId("event-create-reminder-option-day_before_1-checked")).toBeTruthy();
      expect(queryByTestId("event-create-reminder-option-before_10m-checked")).toBeNull();
      expect(queryByTestId("event-create-reminder-option-on_day")).toBeNull();
    });

    it("registers 前日9時 for a timed event on creation", async () => {
      const { getByTestId, createEventRemindersMock } = await openCreateModal();

      await fireEvent.press(getByTestId("event-create-allday-toggle"));
      await pickStartDate(getByTestId, "2026-09-01T10:00:00.000Z");
      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() =>
        expect(createEventRemindersMock).toHaveBeenCalledWith("event-created-1", [{ kind: "day_before_1" }])
      );
    });

    it("registers the reminders as edited in the form (uncheck a default, add another, add a custom one)", async () => {
      const { getByTestId, createEventRemindersMock } = await openCreateModal();

      await fireEvent.press(getByTestId("event-create-allday-toggle"));
      await pickStartDate(getByTestId, "2026-09-01T10:00:00.000Z");
      await fireEvent.press(getByTestId("event-create-reminder-option-day_before_1"));
      await fireEvent.press(getByTestId("event-create-reminder-option-before_1h"));
      await fireEvent.press(getByTestId("event-create-reminder-option-custom"));
      await fireEvent.press(getByTestId("event-create-reminder-custom-picker-confirm"));
      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() =>
        expect(createEventRemindersMock).toHaveBeenCalledWith("event-created-1", [
          { kind: "before_1h" },
          { kind: "custom", custom: { value: 10, unit: "minute" } },
        ])
      );
    });

    it("does not register a reminder whose time has already passed, and says so", async () => {
      const { getByTestId, createEventMock, createEventRemindersMock } = await openCreateModal();

      // "now" is 2026-08-18T12:00:00.000Z; this event starts later today (JST 22:00),
      // so its 前日9時 (8/17 JST 10:00) is long gone.
      await fireEvent.press(getByTestId("event-create-allday-toggle"));
      await pickStartDate(getByTestId, "2026-08-18T13:00:00.000Z");
      expect(getByTestId("event-create-reminder-past-note")).toBeTruthy();

      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() => expect(createEventMock).toHaveBeenCalled());
      expect(createEventRemindersMock).not.toHaveBeenCalled();
    });

    it("registers only the not-yet-passed reminders when some have passed", async () => {
      const { getByTestId, createEventRemindersMock } = await openCreateModal();

      // 開始 2026-08-18T14:00Z: 前日9時 has passed, 1時間前 (13:00Z) has not
      await fireEvent.press(getByTestId("event-create-allday-toggle"));
      await pickStartDate(getByTestId, "2026-08-18T14:00:00.000Z");
      await fireEvent.press(getByTestId("event-create-reminder-option-before_1h"));
      await fireEvent.press(getByTestId("event-create-submit"));

      await waitFor(() =>
        expect(createEventRemindersMock).toHaveBeenCalledWith("event-created-1", [{ kind: "before_1h" }])
      );
    });
  });

  it("does not seed default reminders for an event created with a past date (regression: reminders fired immediately for backdated events)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const createEventRemindersMock = jest.fn().mockResolvedValue(true);
    (useCreateEventReminders as jest.Mock).mockReturnValue({
      createEventReminders: createEventRemindersMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "先週の集まり");

    // "now" is fixed at 2026-08-18T12:00:00.000Z (see beforeEach) - both
    // start and end here are safely in the past.
    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-08-01T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));
    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-08-01T12:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
    expect(createEventRemindersMock).not.toHaveBeenCalled();
  });

  it("does not offer to add a memory photo while the create form's date is still in the future (default)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));

    expect(queryByTestId("event-create-memory-photo-section")).toBeNull();
  });

  it("offers to add a memory photo once the create form's date is set to the past, and attaches it to the newly created event (regression: no way to record a memory while backdating an event)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const attachPhotoMock = jest.fn().mockResolvedValue(true);
    (useAttachPhoto as jest.Mock).mockReturnValue({ attachPhoto: attachPhotoMock, isSubmitting: false, error: null });
    const pickedPhoto = { fileName: "a.jpg", contentType: "image/jpeg", data: "blob" };
    (pickPhotoFromLibrary as jest.Mock).mockResolvedValue(pickedPhoto);

    const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.changeText(getByTestId("event-create-title-input"), "先週の集まり");

    // "now" is fixed at 2026-08-18T12:00:00.000Z (see beforeEach).
    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-08-01T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));
    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-08-01T12:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    expect(getByTestId("event-create-add-memory-photo")).toBeTruthy();
    await fireEvent.press(getByTestId("event-create-add-memory-photo"));

    await waitFor(() => expect(getByText("思い出の画像を選択しました")).toBeTruthy());
    expect(queryByTestId("event-create-add-memory-photo")).toBeNull();
    expect(attachPhotoMock).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId("event-create-submit"));

    await waitFor(() => expect(createEventMock).toHaveBeenCalled());
    await waitFor(() => expect(attachPhotoMock).toHaveBeenCalledWith("event-created-1", pickedPhoto));
  });

  it("places the memory-photo section in the shared (メンバーと共有) frame for a shared calendar, matching EventDetailContent's own placement, and in the single personal frame for a personal calendar", async () => {
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

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.press(getByTestId("event-create-calendar-cal-2"));
    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-08-01T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));
    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-08-01T12:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    expect(
      within(getByTestId("event-create-shared-frame")).getByTestId("event-create-memory-photo-section")
    ).toBeTruthy();

    await fireEvent.press(getByTestId("event-create-calendar-cal-1"));
    await fireEvent.press(getByTestId("event-create-start-button"));
    await fireEvent.changeText(getByTestId("event-create-start-picker"), "2026-08-01T10:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));
    await fireEvent.press(getByTestId("event-create-end-button"));
    await fireEvent.changeText(getByTestId("event-create-end-picker"), "2026-08-01T12:00:00.000Z");
    await fireEvent.press(getByTestId("event-create-picker-done"));

    expect(
      within(getByTestId("event-create-personal-frame")).getByTestId("event-create-memory-photo-section")
    ).toBeTruthy();
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

  it("refetches its own profile (so the weekday header/grid pick up the change) when 週の開始曜日 is switched from the settings modal (regression: switching it in settings didn't update the calendar screen until it was remounted)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    const refetchProfile = jest.fn();
    (useMyProfile as jest.Mock).mockReturnValue({
      profile: { id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn: 0 },
      isLoading: false,
      error: null,
      refetch: refetchProfile,
    });
    (useUpdateWeekStartsOn as jest.Mock).mockReturnValue({
      updateWeekStartsOn: jest.fn().mockResolvedValue({ id: "user-1", displayName: "たろう", avatarUrl: null, weekStartsOn: 1 }),
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-settings-button"));
    await fireEvent.press(getByTestId("settings-hub-open-personal"));
    await fireEvent.press(getByTestId("personal-settings-week-starts-on-monday"));

    await waitFor(() => expect(refetchProfile).toHaveBeenCalled());
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

  it("also deselects a tag's descendants when the tag itself is deselected in the create form (regression: the mid tag was left selected with its major parent gone)", async () => {
    mockCommonHooks();
    (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
    (useTagTree as jest.Mock).mockReturnValue({
      tagTree: [
        {
          id: "tag-a",
          parentId: null,
          level: "major",
          name: "旅行",
          color: "#ff0000",
          createdAt: "2026-08-01T00:00:00.000Z",
          children: [
            {
              id: "tag-a1",
              parentId: "tag-a",
              level: "mid",
              name: "国内",
              color: "#ff8888",
              createdAt: "2026-08-01T00:00:00.000Z",
              children: [],
            },
          ],
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const createEventMock = jest.fn().mockResolvedValue({ id: "event-created-1" });
    (useCreateEvent as jest.Mock).mockReturnValue({ createEvent: createEventMock, isSubmitting: false, error: null });
    const attachTagsToEventMock = jest.fn().mockResolvedValue(true);
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: attachTagsToEventMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

    await fireEvent.press(getByTestId("calendar-add-event-fab"));
    await fireEvent.press(getByTestId("event-create-tag-tag-a"));
    await fireEvent.press(getByTestId("event-create-tag-tag-a1"));
    // Deselecting the major tag should drop its already-selected mid child too.
    await fireEvent.press(getByTestId("event-create-tag-tag-a"));

    expect(queryByTestId("event-create-tag-tag-a1")).toBeNull();

    await fireEvent.changeText(getByTestId("event-create-title-input"), "テスト");
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

  it("keeps text inputs white even inside the tinted shared/personal frames, while tag chips keep showing their own color", async () => {
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
    expect(flattenStyle(getByTestId("event-create-tag-tag-a").props.style).backgroundColor).toBe("#ff0000");
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

    it("shows each event's tag badges (name, with color) in the month list (regression: tags stopped showing in the event list)", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [TODAY_EVENT, OTHER_DAY_EVENT],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {
          "event-1": [
            { id: "tag-a", calendarId: "cal-1", parentId: null, level: "major", name: "旅行", color: "#ff0000", createdAt: "2026-08-01T00:00:00.000Z" },
          ],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, queryByTestId, getByText } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      expect(getByTestId("event-tag-badge-tag-a")).toBeTruthy();
      expect(getByText("旅行")).toBeTruthy();
      // event-2 has no tags, so only one badge is rendered in the whole list.
      expect(queryByTestId("event-tag-badge-tag-b")).toBeNull();
    });

    it("looks up tags for every event in the displayed month, so each row can render its own", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [TODAY_EVENT, OTHER_DAY_EVENT],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      await render(<CalendarScreen />);

      expect(useEventTagsByEvents).toHaveBeenCalledWith(["event-1", "event-2"]);
    });

    it("marks events that have tags with the tag icon in both the day modal and the month list", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, hasTags: true }, OTHER_DAY_EVENT],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

      await fireEvent.press(getByTestId("calendar-view-mode-list"));
      expect(getByTestId("calendar-list-event-tag-mark-event-1")).toBeTruthy();
      expect(queryByTestId("calendar-list-event-tag-mark-event-2")).toBeNull();

      await fireEvent.press(getByTestId("calendar-view-mode-grid"));
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
      expect(getByTestId("calendar-event-tag-mark-event-1")).toBeTruthy();
    });

    it("separates events within a day with a thin light line, and each date with a slightly stronger one", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [
          TODAY_EVENT,
          { ...TODAY_EVENT, id: "event-1b", title: "昼会" },
          OTHER_DAY_EVENT,
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getAllByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      const flattenStyle = (style: unknown): Record<string, unknown> =>
        Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

      // 2026-08-18 has two events (1 line between them); 08-20 has one (none).
      const eventSeparators = getAllByTestId("calendar-month-list-event-separator");
      expect(eventSeparators).toHaveLength(1);
      // Two date groups -> exactly one line between them (not above the first / below the last).
      const dateSeparators = getAllByTestId("calendar-month-list-date-separator");
      expect(dateSeparators).toHaveLength(1);

      const eventLine = flattenStyle(eventSeparators[0].props.style);
      const dateLine = flattenStyle(dateSeparators[0].props.style);
      expect(eventLine.height).toBe(StyleSheet.hairlineWidth);
      expect(eventLine.backgroundColor).toBe("#e5e7eb");
      // The date boundary must read as stronger than the event boundary.
      expect(dateLine.height as number).toBeGreaterThan(eventLine.height as number);
      expect(dateLine.backgroundColor).not.toBe(eventLine.backgroundColor);
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

    it("shows a loading message instead of the empty state while events are still loading (regression)", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({ events: [], isLoading: true, error: null, refetch: jest.fn() });

      const { getByTestId, getByText, queryByText } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      expect(getByText("読み込み中…")).toBeTruthy();
      expect(queryByText("この月に予定はありません")).toBeNull();
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

    describe("まとめてタグ付与/削除", () => {
      it("only shows the header tag icon while in list view", async () => {
        mockCommonHooks();
        (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
          events: [TODAY_EVENT, OTHER_DAY_EVENT],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });

        const { getByTestId, queryByTestId } = await render(<CalendarScreen />);

        expect(queryByTestId("calendar-bulk-tag-button")).toBeNull();

        await fireEvent.press(getByTestId("calendar-view-mode-list"));

        expect(getByTestId("calendar-bulk-tag-button")).toBeTruthy();
      });

      it("shows the bulk-assign panel, tag badges, and selection circles once the tag icon is pressed, selecting a row instead of navigating", async () => {
        mockCommonHooks();
        (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
          events: [TODAY_EVENT, OTHER_DAY_EVENT],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });
        (useEventTagsByEvents as jest.Mock).mockReturnValue({
          tagsByEventId: { "event-1": [{ id: "tag-a", name: "旅行", color: "#ff0000" }] },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });

        const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);
        await fireEvent.press(getByTestId("calendar-view-mode-list"));

        // タグが設定中の予定は、一覧の各行の下に表示される。
        expect(getByText("旅行")).toBeTruthy();

        await fireEvent.press(getByTestId("calendar-bulk-tag-button"));

        expect(getByTestId("calendar-bulk-tag-panel")).toBeTruthy();
        expect(getByTestId("calendar-list-event-select-event-1")).toBeTruthy();

        await fireEvent.press(getByTestId("calendar-list-event-event-1"));

        expect(router.push).not.toHaveBeenCalled();
        expect(getByText("✓")).toBeTruthy();
      });

      it("hides the + (add event) button while bulk tag assignment is active, and shows it again after cancelling", async () => {
        mockCommonHooks();
        (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
          events: [TODAY_EVENT],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });

        const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
        await fireEvent.press(getByTestId("calendar-view-mode-list"));

        expect(getByTestId("calendar-add-event-fab")).toBeTruthy();

        await fireEvent.press(getByTestId("calendar-bulk-tag-button"));

        expect(queryByTestId("calendar-add-event-fab")).toBeNull();

        await fireEvent.press(getByTestId("calendar-bulk-tag-button"));

        expect(getByTestId("calendar-add-event-fab")).toBeTruthy();
      });

      it("assigns the selected tags to the selected events on confirm, then refetches and leaves bulk mode", async () => {
        mockCommonHooks();
        const refetchEvents = jest.fn();
        const refetchTags = jest.fn();
        (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
          events: [TODAY_EVENT, OTHER_DAY_EVENT],
          isLoading: false,
          error: null,
          refetch: refetchEvents,
        });
        (useEventTagsByEvents as jest.Mock).mockReturnValue({
          tagsByEventId: {},
          isLoading: false,
          error: null,
          refetch: refetchTags,
        });
        const attachTagsToEventsMock = jest.fn().mockResolvedValue(true);
        (useAttachTagsToEvents as jest.Mock).mockReturnValue({
          attachTagsToEvents: attachTagsToEventsMock,
          isSubmitting: false,
          error: null,
        });

        const { getByTestId, getByText, queryByTestId } = await render(<CalendarScreen />);
        await fireEvent.press(getByTestId("calendar-view-mode-list"));
        await fireEvent.press(getByTestId("calendar-bulk-tag-button"));

        await fireEvent.press(getByTestId("calendar-bulk-tag-tag-picker-tag-tag-a"));
        await fireEvent.press(getByTestId("calendar-list-event-select-event-1"));

        await fireEvent.press(getByTestId("calendar-bulk-tag-confirm"));
        expect(getByText("選択された予定にタグ「旅行」を設定してよろしいですか？")).toBeTruthy();
        await fireEvent.press(getByTestId("calendar-bulk-tag-confirm-ok"));

        await waitFor(() => expect(attachTagsToEventsMock).toHaveBeenCalledWith(["tag-a"], ["event-1"]));
        await waitFor(() => expect(refetchTags).toHaveBeenCalled());
        await waitFor(() => expect(refetchEvents).toHaveBeenCalled());
        expect(queryByTestId("calendar-bulk-tag-panel")).toBeNull();
      });

      it("switches to remove mode via 'まとめて削除' and removes all tags from the selected events on confirm", async () => {
        mockCommonHooks();
        (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
          events: [TODAY_EVENT, OTHER_DAY_EVENT],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });
        const removeAllTagsFromEventsMock = jest.fn().mockResolvedValue(true);
        (useRemoveAllTagsFromEvents as jest.Mock).mockReturnValue({
          removeAllTagsFromEvents: removeAllTagsFromEventsMock,
          isSubmitting: false,
          error: null,
        });

        const { getByTestId, getByText } = await render(<CalendarScreen />);
        await fireEvent.press(getByTestId("calendar-view-mode-list"));
        await fireEvent.press(getByTestId("calendar-bulk-tag-button"));

        await fireEvent.press(getByTestId("calendar-bulk-tag-switch-to-remove"));
        await fireEvent.press(getByTestId("calendar-list-event-select-event-1"));

        await fireEvent.press(getByTestId("calendar-bulk-tag-confirm"));
        expect(getByText("選択された予定の全てのタグを削除してよろしいですか？")).toBeTruthy();
        await fireEvent.press(getByTestId("calendar-bulk-tag-confirm-ok"));

        await waitFor(() => expect(removeAllTagsFromEventsMock).toHaveBeenCalledWith(["event-1"]));
      });
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

  describe("予定一覧でのタグの有無・未達成ToDo件数バッジ(日別モーダル・月の一覧表示)", () => {
    it("shows a tag mark and the incomplete-todo count next to the title, in the day-events modal", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, hasTags: true, incompleteTodoCount: 2 }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      const counts = getByTestId("calendar-event-counts-event-1");
      expect(getByTestId("calendar-event-tag-mark-event-1")).toBeTruthy();
      expect(within(counts).getByText("2")).toBeTruthy();
    });

    it("shows the same badges in the month list view", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, hasTags: true, incompleteTodoCount: 1 }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      const counts = getByTestId("calendar-list-event-counts-event-1");
      expect(getByTestId("calendar-list-event-tag-mark-event-1")).toBeTruthy();
      expect(within(counts).getByText("1")).toBeTruthy();
    });

    it("omits the todo count badge when there are no incomplete todos, and the tag mark when untagged", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, hasTags: false, incompleteTodoCount: 0 }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      expect(queryByTestId("calendar-event-counts-event-1")).toBeNull();
      expect(queryByTestId("calendar-event-tag-mark-event-1")).toBeNull();
    });
  });

  describe("予定一覧での対象者のアイコン(日別モーダル・月の一覧表示)", () => {
    const ASSIGNEES = [
      { userId: "user-2", displayName: "はなこ", avatarPath: null },
      { userId: "user-3", displayName: "じろう", avatarPath: null },
    ];

    it("shows the assignees' icons on the event in the day-events modal", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, assignees: ASSIGNEES }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      expect(getByTestId("calendar-event-assignees-event-1")).toBeTruthy();
      expect(getByTestId("calendar-event-assignees-event-1-user-2")).toBeTruthy();
      expect(getByTestId("calendar-event-assignees-event-1-user-3")).toBeTruthy();
      // 画像が無い人は頭文字
      expect(getByText("は")).toBeTruthy();
    });

    it("shows the assignees' icons in the month list view too", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, assignees: ASSIGNEES }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      expect(getByTestId("calendar-list-event-assignees-event-1-user-2")).toBeTruthy();
    });

    it("shows no assignee icons for an event without assignees", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [{ ...TODAY_EVENT, assignees: [] }, { ...OTHER_DAY_EVENT }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      expect(queryByTestId("calendar-event-assignees-event-1")).toBeNull();
      expect(queryByTestId("calendar-event-counts-event-1")).toBeNull();
    });
  });

  describe("予定一覧での場所・メモ・URLの表示(日別モーダル・月の一覧表示)", () => {
    const EVENT_WITH_DETAILS = {
      ...TODAY_EVENT,
      location: "渋谷カフェ",
      memo: "試食あり",
      url: "example.com/menu",
    };

    it("shows an icon+1-line summary for each of location/memo/url below the title, in the day-events modal", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [EVENT_WITH_DETAILS],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      const row = getByTestId("calendar-event-event-1");
      expect(within(row).getByText("渋谷カフェ")).toBeTruthy();
      expect(within(row).getByText("試食あり")).toBeTruthy();
      expect(within(row).getByText("example.com/menu")).toBeTruthy();
    });

    it("shows the same summary lines in the month list view", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [EVENT_WITH_DETAILS],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      const row = getByTestId("calendar-list-event-event-1");
      expect(within(row).getByText("渋谷カフェ")).toBeTruthy();
      expect(within(row).getByText("試食あり")).toBeTruthy();
      expect(within(row).getByText("example.com/menu")).toBeTruthy();
    });

    it("shows no summary lines when location/memo/url are all unset", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [TODAY_EVENT],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, queryByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));

      expect(queryByTestId("calendar-event-url-event-1")).toBeNull();
    });

    it("opens the url (normalizing a scheme-less one) when its summary line is tapped, in the day-events modal, without also navigating to the event detail (regression)", async () => {
      const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [EVENT_WITH_DETAILS],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-grid-cell-2026-08-18"));
      await fireEvent.press(getByTestId("calendar-event-url-event-1"));

      expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
      expect(router.push).not.toHaveBeenCalledWith("/event/event-1");
    });

    it("draws the url line's link icon in the same gray as the location/memo icons above it, not blue", async () => {
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [EVENT_WITH_DETAILS],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));

      const flatten = (style: unknown): Record<string, unknown> =>
        Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
      expect(flatten(getByTestId("calendar-list-event-url-icon-event-1").props.style).tintColor).toBe("#999");
      expect(flatten(getByTestId("calendar-list-event-location-icon-event-1").props.style).tintColor).toBe("#999");
    });

    it("opens the url when its summary line is tapped, in the month list view, without navigating to the event detail (regression)", async () => {
      const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
      mockCommonHooks();
      (useEventsInRangeForCalendars as jest.Mock).mockReturnValue({
        events: [EVENT_WITH_DETAILS],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);
      await fireEvent.press(getByTestId("calendar-view-mode-list"));
      await fireEvent.press(getByTestId("calendar-list-event-url-event-1"));

      expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
      expect(router.push).not.toHaveBeenCalledWith("/event/event-1");
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

  describe("週の開始曜日(個人設定)", () => {
    it("shows the weekday header starting on Sunday by default", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<CalendarScreen />);

      const labels = within(getByTestId("calendar-weekday-row"))
        .getAllByText(/^[日月火水木金土]$/)
        .map((node) => node.props.children);
      expect(labels).toEqual(["日", "月", "火", "水", "木", "金", "土"]);
    });

    it("starts the weekday header (and the grid) on Monday when the profile is set to weekStartsOn: 1", async () => {
      mockCommonHooks();
      (useMyProfile as jest.Mock).mockReturnValue({
        profile: { id: "user-1", displayName: "たろう", avatarUrl: null, weekStartsOn: 1 },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId } = await render(<CalendarScreen />);

      const labels = within(getByTestId("calendar-weekday-row"))
        .getAllByText(/^[日月火水木金土]$/)
        .map((node) => node.props.children);
      expect(labels).toEqual(["月", "火", "水", "木", "金", "土", "日"]);

      // "Now" is fixed at 2026-08-18 (see beforeEach) - August 2026 starts on
      // a Saturday, so a Monday-start grid's first row should begin on
      // Monday 2026-07-27 instead of the Sunday-start default's 2026-07-26.
      expect(getByTestId("calendar-grid-cell-2026-07-27")).toBeTruthy();
    });
  });
});
