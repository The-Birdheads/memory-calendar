import { fireEvent, render, waitFor } from "@testing-library/react-native";

import HistoryScreen from "../history";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import { usePastEventsByTag } from "../../../src/features/history/hooks";
import { useEventIdsWithPhotos, useMemoriesTimeline } from "../../../src/features/memories/hooks";
import { useEventTagsByEvents, useTagTree } from "../../../src/features/tags/hooks";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    Tabs: {
      Screen: ({ options }: any) => React.createElement(React.Fragment, null, options?.headerRight?.()),
    },
    // Treats "focus" as "mount" and "blur" as "unmount" for testing purposes,
    // since there's no real navigation container here to fire actual
    // focus/blur events - forwarding the callback's own return value keeps
    // its cleanup (used here to reset the filter on leaving the panel) wired
    // up exactly like the real useFocusEffect does.
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/tags/hooks", () => ({
  useTagTree: jest.fn(),
  useEventTagsByEvents: jest.fn(),
}));

jest.mock("../../../src/features/history/hooks", () => ({
  usePastEventsByTag: jest.fn(),
}));

jest.mock("../../../src/features/memories/hooks", () => ({
  useEventIdsWithPhotos: jest.fn(),
  useMemoriesTimeline: jest.fn(),
}));

// EventDetailContent has its own large, independently-tested suite
// (app/event/__tests__/[id].test.tsx) - mocking it here keeps this file
// focused on HistoryScreen's own job (switching between the timeline/photo
// panels, opening/closing the in-tab detail modal with the right event,
// showing timeline/tag/photo indicators) instead of re-mocking that
// component's own dozen-plus hook dependencies.
jest.mock("../../../src/features/events/components/EventDetailContent", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    EventDetailContent: ({
      eventId,
      onBack,
      showGoToCalendarButton,
    }: {
      eventId: string;
      onBack: () => void;
      showGoToCalendarButton?: boolean;
    }) => (
      <TouchableOpacity testID="mock-event-detail-content" onPress={onBack}>
        <Text>{eventId}</Text>
        <Text>{showGoToCalendarButton ? "go-to-calendar-shown" : "go-to-calendar-hidden"}</Text>
      </TouchableOpacity>
    ),
  };
});

const CALENDARS: { id: string; name: string; kind: "personal" | "group"; createdBy: string; createdAt: string }[] = [
  { id: "cal-1", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
  { id: "cal-2", name: "友人グループ", kind: "group", createdBy: "user-2", createdAt: "2026-08-17T01:00:00.000Z" },
];

const TAG_TREE = [
  {
    id: "tag-1",
    parentId: null,
    level: "major" as const,
    name: "行事",
    color: "#ff0000",
    createdAt: "2026-08-18T00:00:00.000Z",
    children: [
      {
        id: "tag-2",
        parentId: "tag-1",
        level: "mid" as const,
        name: "誕生日",
        color: "#00ff00",
        createdAt: "2026-08-18T00:01:00.000Z",
        children: [],
      },
    ],
  },
];

const PAST_EVENTS = [
  { id: "event-1", calendarId: "cal-1", title: "先週の集まり", startAt: "2026-08-10T10:00:00.000Z" },
];

const MEMORY_ENTRIES = [
  {
    id: "event-1",
    calendarId: "cal-1",
    title: "誕生日会",
    startAt: "2026-08-10T10:00:00.000Z",
    endAt: "2026-08-10T11:00:00.000Z",
    thumbnailStoragePath: "event-1/a.jpg",
    thumbnailUrl: "https://example.com/signed/a.jpg",
  },
];

function mockCommonHooks() {
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null, refetch: jest.fn() });
  (useTagTree as jest.Mock).mockReturnValue({ tagTree: TAG_TREE, isLoading: false, error: null });
  (useEventTagsByEvents as jest.Mock).mockReturnValue({ tagsByEventId: {}, isLoading: false, error: null, refetch: jest.fn() });
  (useEventIdsWithPhotos as jest.Mock).mockReturnValue({
    eventIdsWithPhotos: new Set(),
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null });
  (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: [], isLoading: false, error: null, refetch: jest.fn() });
}

describe("HistoryScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows the 年表/画像 mode switch, defaulting to 年表 (timeline)", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

    expect(getByTestId("history-mode-switch")).toBeTruthy();
    expect(getByTestId("history-filter")).toBeTruthy();
    expect(queryByTestId("memories-filter")).toBeNull();
  });

  it("switches to the 画像 (photo grid) panel and back, resetting each panel's own state on the way", async () => {
    mockCommonHooks();

    const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

    expect(getByTestId("history-filter")).toBeTruthy();
    expect(queryByTestId("memories-filter")).toBeNull();

    await fireEvent.press(getByTestId("history-mode-photos"));

    expect(getByTestId("memories-filter")).toBeTruthy();
    expect(queryByTestId("history-filter")).toBeNull();

    await fireEvent.press(getByTestId("history-mode-timeline"));

    expect(getByTestId("history-filter")).toBeTruthy();
    expect(queryByTestId("memories-filter")).toBeNull();
  });

  describe("年表 (timeline panel)", () => {
    it("shows past events across all calendars by default, grouped under a year-month header", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: PAST_EVENTS, isLoading: false, error: null });

      const { getByText } = await render(<HistoryScreen />);

      expect(getByText("2026年8月")).toBeTruthy();
      expect(getByText("先週の集まり")).toBeTruthy();
      expect(getByText("8月10日 月曜日")).toBeTruthy();
      expect(usePastEventsByTag).toHaveBeenCalledWith(undefined, ["cal-1", "cal-2"]);
    });

    it("groups events by JST year-month, in the order the events already come in", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: [
          { id: "event-1", calendarId: "cal-1", title: "9月の予定", startAt: "2026-09-10T01:00:00.000Z" },
          { id: "event-2", calendarId: "cal-1", title: "8月の予定", startAt: "2026-08-20T01:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
      });

      const { getByTestId } = await render(<HistoryScreen />);

      const timeline = getByTestId("history-timeline");
      expect(timeline.props.data.map((g: { label: string }) => g.label)).toEqual(["2026年9月", "2026年8月"]);
    });

    it("shows a photo indicator next to an event's title when it has photos, and hides it otherwise", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: [
          ...PAST_EVENTS,
          { id: "event-2", calendarId: "cal-1", title: "写真なしの予定", startAt: "2026-08-11T10:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
      });
      (useEventIdsWithPhotos as jest.Mock).mockReturnValue({
        eventIdsWithPhotos: new Set(["event-1"]),
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

      expect(getByTestId("history-event-photo-icon-event-1")).toBeTruthy();
      expect(queryByTestId("history-event-photo-icon-event-2")).toBeNull();
    });

    it("shows the event's tags next to its title when it has any", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: PAST_EVENTS, isLoading: false, error: null });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {
          "event-1": [
            { id: "tag-1", parentId: null, level: "major", name: "音楽", color: "#ff0000", createdAt: "2026-08-01" },
          ],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByText } = await render(<HistoryScreen />);

      expect(getByText("音楽")).toBeTruthy();
      expect(useEventTagsByEvents).toHaveBeenCalledWith(["event-1"]);
    });

    it("omits the time for an all-day past event", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: [{ ...PAST_EVENTS[0], isAllDay: true }],
        isLoading: false,
        error: null,
      });

      const { getByText } = await render(<HistoryScreen />);

      // Only the date (no time) is shown regardless of isAllDay - the
      // timeline groups by day already, so a per-row time was redundant.
      expect(getByText("8月10日 月曜日")).toBeTruthy();
    });

    it("shows only top-level tag filters at first, revealing children once their parent is selected", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      expect(getByTestId("history-tag-filter-all")).toBeTruthy();
      expect(getByTestId("history-tag-filter-tag-1")).toBeTruthy();
      expect(queryByTestId("history-tag-filter-tag-2")).toBeNull();

      await fireEvent.press(getByTestId("history-tag-filter-tag-1"));

      expect(getByTestId("history-tag-filter-tag-2")).toBeTruthy();
    });

    it("requests past events filtered by the selected tag, across all calendars, when a filter is pressed", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      await fireEvent.press(getByTestId("history-tag-filter-tag-1"));
      await fireEvent.press(getByTestId("history-tag-filter-tag-2"));

      await waitFor(() =>
        expect(usePastEventsByTag).toHaveBeenLastCalledWith("tag-2", ["cal-1", "cal-2"])
      );
    });

    it("shows an empty state message when no events match", async () => {
      mockCommonHooks();

      const { getByText } = await render(<HistoryScreen />);

      expect(getByText("該当する予定がありません")).toBeTruthy();
    });

    it("shows a calendar filter defaulting to all calendars selected, toggling a calendar off/on to narrow the list", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      expect(getByTestId("history-calendar-filter-cal-1")).toBeTruthy();
      expect(getByTestId("history-calendar-filter-cal-2")).toBeTruthy();
      await waitFor(() =>
        expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1", "cal-2"])
      );

      // 両方選択済みの状態からcal-2をタップすると外れる
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));
      await waitFor(() => expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1"]));

      // 再度タップすると戻る
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));
      await waitFor(() =>
        expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1", "cal-2"])
      );
    });

    it("keeps the calendar filter and tag filter independent of each other", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      await fireEvent.press(getByTestId("history-tag-filter-tag-1"));
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));

      await waitFor(() => expect(usePastEventsByTag).toHaveBeenLastCalledWith("tag-1", ["cal-1"]));
    });

    it("shows an active-filter indicator once a calendar or tag filter is touched, and clears it via reset", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

      expect(queryByTestId("history-filter-active-dot")).toBeNull();

      await fireEvent.press(getByTestId("history-filter"));
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));

      expect(getByTestId("history-filter-active-dot")).toBeTruthy();

      await fireEvent.press(getByTestId("history-filter-reset"));

      expect(queryByTestId("history-filter-active-dot")).toBeNull();
    });

    it("resets both the calendar and tag selections when the sheet's reset link is pressed", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      await fireEvent.press(getByTestId("history-tag-filter-tag-1"));
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));
      await waitFor(() => expect(usePastEventsByTag).toHaveBeenLastCalledWith("tag-1", ["cal-1"]));

      await fireEvent.press(getByTestId("history-filter-reset"));

      await waitFor(() =>
        expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1", "cal-2"])
      );
    });

    it("opens the event detail in an in-tab modal (not navigation) when a past event row is pressed, showing its own go-to-calendar button, and closes it via onBack", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: PAST_EVENTS, isLoading: false, error: null });

      const { getByTestId, getByText, queryByTestId } = await render(<HistoryScreen />);

      expect(queryByTestId("mock-event-detail-content")).toBeNull();

      await fireEvent.press(getByTestId("history-event-event-1"));

      expect(getByTestId("mock-event-detail-content")).toBeTruthy();
      expect(getByText("event-1")).toBeTruthy();
      // The timeline panel isn't the calendar screen itself, so it needs its
      // own way to jump there - EventDetailContent's go-to-calendar button.
      expect(getByText("go-to-calendar-shown")).toBeTruthy();

      // The mock's onPress calls onBack, standing in for its real back button.
      await fireEvent.press(getByTestId("mock-event-detail-content"));

      expect(queryByTestId("mock-event-detail-content")).toBeNull();
    });
  });

  describe("画像 (photo grid panel)", () => {
    async function renderPhotoPanel() {
      const utils = await render(<HistoryScreen />);
      await fireEvent.press(utils.getByTestId("history-mode-photos"));
      return utils;
    }

    it("shows a thumbnail and title for each memory in the timeline", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: MEMORY_ENTRIES, isLoading: false, error: null, refetch: jest.fn() });

      const { getByText, getByTestId } = await renderPhotoPanel();

      expect(getByText("誕生日会")).toBeTruthy();
      expect(getByTestId("memory-thumbnail-event-1").props.source).toEqual({
        uri: "https://example.com/signed/a.jpg",
      });
    });

    it("shows an empty state message when there are no memories", async () => {
      mockCommonHooks();

      const { getByText } = await renderPhotoPanel();

      expect(getByText("思い出がありません")).toBeTruthy();
    });

    it("groups memories under a year-month header, like an album divided into chapters", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({
        entries: [
          { ...MEMORY_ENTRIES[0], id: "event-2", title: "花火大会", startAt: "2026-07-01T10:00:00.000Z" },
          MEMORY_ENTRIES[0],
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText } = await renderPhotoPanel();

      expect(getByTestId("memories-month-group-2026-07")).toBeTruthy();
      expect(getByTestId("memories-month-group-2026-08")).toBeTruthy();
      expect(getByText("誕生日会")).toBeTruthy();
      expect(getByText("花火大会")).toBeTruthy();
    });

    it("surfaces a 'n年前の今日' surprise card for a past memory that falls on today's date, but not for the unfiltered view's own current-year entries", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-10T01:00:00.000Z")); // 2026-08-10 JST

      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({
        entries: [
          MEMORY_ENTRIES[0], // 2026-08-10 (今年 = 対象外)
          { ...MEMORY_ENTRIES[0], id: "event-3", title: "去年の誕生日会", startAt: "2025-08-10T10:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText, queryByText } = await renderPhotoPanel();

      expect(getByTestId("memories-on-this-day")).toBeTruthy();
      expect(getByTestId("memories-on-this-day-item-event-3")).toBeTruthy();
      expect(getByText("1年前")).toBeTruthy();
      expect(queryByText("2年前")).toBeNull();

      jest.useRealTimers();
    });

    it("hides the 'n年前の今日' card while filtering to a specific year/month", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-10T01:00:00.000Z"));

      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({
        entries: [{ ...MEMORY_ENTRIES[0], id: "event-3", title: "去年の誕生日会", startAt: "2025-08-10T10:00:00.000Z" }],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, queryByTestId } = await renderPhotoPanel();
      await fireEvent.press(getByTestId("memories-filter"));
      await fireEvent.press(getByTestId("memories-filter-month-toggle"));

      expect(queryByTestId("memories-on-this-day")).toBeNull();

      jest.useRealTimers();
    });

    it("opens the event's detail in an in-tab modal when its photo is tapped", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: MEMORY_ENTRIES, isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, getByText, queryByTestId } = await renderPhotoPanel();

      expect(queryByTestId("mock-event-detail-content")).toBeNull();

      await fireEvent.press(getByTestId("memory-item-event-1"));

      expect(getByTestId("mock-event-detail-content")).toBeTruthy();
      expect(getByText("event-1")).toBeTruthy();
    });

    it("closes the event detail modal when its back button is pressed", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: MEMORY_ENTRIES, isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, queryByTestId } = await renderPhotoPanel();

      await fireEvent.press(getByTestId("memory-item-event-1"));
      expect(getByTestId("mock-event-detail-content")).toBeTruthy();

      await fireEvent.press(getByTestId("mock-event-detail-content"));

      expect(queryByTestId("mock-event-detail-content")).toBeNull();
    });

    it("shows a calendar switcher defaulting to all calendars selected, toggling a calendar off/on to narrow the timeline", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: MEMORY_ENTRIES, isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId } = await renderPhotoPanel();
      await fireEvent.press(getByTestId("memories-filter"));

      expect(getByTestId("memories-calendar-switch-cal-1")).toBeTruthy();
      expect(getByTestId("memories-calendar-switch-cal-2")).toBeTruthy();
      await waitFor(() =>
        expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1", "cal-2"], undefined)
      );

      // 両方選択済みの状態からcal-2をタップすると外れる
      await fireEvent.press(getByTestId("memories-calendar-switch-cal-2"));
      await waitFor(() => expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1"], undefined));

      // 再度タップすると戻る
      await fireEvent.press(getByTestId("memories-calendar-switch-cal-2"));
      await waitFor(() =>
        expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1", "cal-2"], undefined)
      );
    });

    it("shows the unfiltered timeline by default (すべて active, no year/month filter)", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: MEMORY_ENTRIES, isLoading: false, error: null, refetch: jest.fn() });

      await renderPhotoPanel();

      expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1", "cal-2"], undefined);
    });

    it("filters the timeline to the current year/month when the month filter is enabled, and steps month-by-month", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-18T12:00:00.000Z"));
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: MEMORY_ENTRIES, isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, getByText } = await renderPhotoPanel();
      await fireEvent.press(getByTestId("memories-filter"));

      await fireEvent.press(getByTestId("memories-filter-month-toggle"));

      expect(getByText("2026年8月")).toBeTruthy();
      await waitFor(() =>
        expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1", "cal-2"], { year: 2026, month: 8 })
      );

      await fireEvent.press(getByTestId("memories-month-next"));

      expect(getByText("2026年9月")).toBeTruthy();
      await waitFor(() =>
        expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1", "cal-2"], { year: 2026, month: 9 })
      );

      jest.useRealTimers();
    });

    it("clears the year/month filter when すべて is pressed again", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-08-18T12:00:00.000Z"));
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: MEMORY_ENTRIES, isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId } = await renderPhotoPanel();
      await fireEvent.press(getByTestId("memories-filter"));

      await fireEvent.press(getByTestId("memories-filter-month-toggle"));
      await waitFor(() =>
        expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1", "cal-2"], { year: 2026, month: 8 })
      );

      await fireEvent.press(getByTestId("memories-filter-all"));

      await waitFor(() =>
        expect(useMemoriesTimeline).toHaveBeenLastCalledWith(["cal-1", "cal-2"], undefined)
      );

      jest.useRealTimers();
    });
  });
});
