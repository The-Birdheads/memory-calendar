import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import HistoryScreen from "../history";
import { AdsProvider, useAds } from "../../../src/features/ads/AdsProvider";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import { usePastEventsByTag } from "../../../src/features/history/hooks";
import { useEventIdsWithPhotos, useMemoriesTimeline } from "../../../src/features/memories/hooks";
import {
  useAttachTagsToEvents,
  useEventTagsByEvents,
  useRemoveAllTagsFromEvents,
  useTagTree,
} from "../../../src/features/tags/hooks";

jest.mock("expo-tracking-transparency", () => ({
  requestTrackingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: "granted" }),
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

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: jest.fn() },
    Tabs: {
      Screen: ({ options }: any) =>
        React.createElement(React.Fragment, null, options?.headerLeft?.(), options?.headerRight?.()),
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

jest.mock("../../../src/features/tags/hooks", () => {
  const actual = jest.requireActual("../../../src/features/tags/hooks");
  return {
    useTagTree: jest.fn(),
    useEventTagsByEvents: jest.fn(),
    useAttachTagsToEvents: jest.fn(),
    useRemoveAllTagsFromEvents: jest.fn(),
    // useBulkTagSelection is pure client-side selection state (no Supabase
    // calls) and already has its own dedicated test suite - using the real
    // implementation here lets these integration tests exercise the actual
    // bulk-mode UI flow instead of re-mocking that state machine.
    useBulkTagSelection: actual.useBulkTagSelection,
  };
});

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

// EventCreateModal has its own large, independently-tested suite
// (app/(tabs)/__tests__/calendar.test.tsx) - mocking it here keeps this file
// focused on HistoryScreen's own job (showing the + FAB, wiring it up with
// this screen's calendars/tagTree, and refetching once a new event is
// created) instead of re-mocking that component's own hook dependencies.
jest.mock("../../../src/features/events/components/EventCreateModal", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    EventCreateModal: ({
      visible,
      onClose,
      onCreated,
      defaultCalendarId,
    }: {
      visible: boolean;
      onClose: () => void;
      onCreated: () => void;
      defaultCalendarId: string;
    }) =>
      visible ? (
        <TouchableOpacity
          testID="mock-event-create-modal"
          onPress={() => {
            onCreated();
            onClose();
          }}
        >
          <Text>{defaultCalendarId}</Text>
        </TouchableOpacity>
      ) : null,
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
  (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
  (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: [], isLoading: false, error: null, refetch: jest.fn() });
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

    it("refetches tags when the panel regains focus, so a tag change made elsewhere shows up (regression)", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: PAST_EVENTS, isLoading: false, error: null });
      const refetchEventTags = jest.fn();
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {},
        isLoading: false,
        error: null,
        refetch: refetchEventTags,
      });

      await render(<HistoryScreen />);

      await waitFor(() => expect(refetchEventTags).toHaveBeenCalled());
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
      expect(getByTestId("history-tag-filter-tag-tag-1")).toBeTruthy();
      expect(queryByTestId("history-tag-filter-tag-tag-2")).toBeNull();

      await fireEvent.press(getByTestId("history-tag-filter-tag-tag-1"));

      expect(getByTestId("history-tag-filter-tag-tag-2")).toBeTruthy();
    });

    it("always fetches unfiltered across all calendars (tag filtering happens client-side) regardless of which tags are selected", async () => {
      mockCommonHooks();

      const { getByTestId } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      await fireEvent.press(getByTestId("history-tag-filter-tag-tag-1"));
      await fireEvent.press(getByTestId("history-tag-filter-tag-tag-2"));

      await waitFor(() =>
        expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1", "cal-2"])
      );
    });

    it("supports selecting multiple tags at once, narrowing to events that have every selected tag (AND, not OR)", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: [
          { id: "event-a", calendarId: "cal-1", title: "行事のみ", startAt: "2026-08-10T10:00:00.000Z" },
          { id: "event-b", calendarId: "cal-1", title: "行事と誕生日", startAt: "2026-08-11T10:00:00.000Z" },
          { id: "event-c", calendarId: "cal-1", title: "誕生日のみ", startAt: "2026-08-12T10:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {
          "event-a": [{ id: "tag-1", name: "行事", color: "#ff0000" }],
          "event-b": [
            { id: "tag-1", name: "行事", color: "#ff0000" },
            { id: "tag-2", name: "誕生日", color: "#00ff00" },
          ],
          "event-c": [{ id: "tag-2", name: "誕生日", color: "#00ff00" }],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText, queryByText } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      // Selecting only 行事 (tag-1) keeps both events that have it.
      await fireEvent.press(getByTestId("history-tag-filter-tag-tag-1"));
      expect(getByText("行事のみ")).toBeTruthy();
      expect(getByText("行事と誕生日")).toBeTruthy();
      expect(queryByText("誕生日のみ")).toBeNull();

      // Also selecting 誕生日 (tag-2) narrows to only the event with both.
      await fireEvent.press(getByTestId("history-tag-filter-tag-tag-2"));
      expect(queryByText("行事のみ")).toBeNull();
      expect(getByText("行事と誕生日")).toBeTruthy();
      expect(queryByText("誕生日のみ")).toBeNull();
    });

    it("filters to events with no tags at all when 未設定 is selected, fetching unfiltered and narrowing client-side", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: [
          { id: "event-1", calendarId: "cal-1", title: "タグ無し予定", startAt: "2026-08-10T10:00:00.000Z" },
          { id: "event-2", calendarId: "cal-1", title: "タグ有り予定", startAt: "2026-08-11T10:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
      });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        // event-1 has no entry at all (no tags) - event-2 has one.
        tagsByEventId: { "event-2": [{ id: "tag-1", name: "行事", color: "#ff0000" }] },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText, queryByText } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      expect(getByText("タグ無し予定")).toBeTruthy();
      expect(getByText("タグ有り予定")).toBeTruthy();

      await fireEvent.press(getByTestId("history-tag-filter-untagged"));

      // usePastEventsByTag is still called with undefined (no server-side tag
      // filter) - "未設定" narrows client-side using the already-fetched tags.
      await waitFor(() => expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1", "cal-2"]));
      expect(getByText("タグ無し予定")).toBeTruthy();
      expect(queryByText("タグ有り予定")).toBeNull();
    });

    it("shows an empty state message when no events match", async () => {
      mockCommonHooks();

      const { getByText } = await render(<HistoryScreen />);

      expect(getByText("該当する予定がありません")).toBeTruthy();
    });

    it("shows a loading message instead of the empty state while events are still loading (regression)", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: true, error: null, refetch: jest.fn() });

      const { getByText, queryByText } = await render(<HistoryScreen />);

      expect(getByText("読み込み中…")).toBeTruthy();
      expect(queryByText("該当する予定がありません")).toBeNull();
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

      await fireEvent.press(getByTestId("history-tag-filter-tag-tag-1"));
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));

      await waitFor(() => expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1"]));
      // Toggling the calendar filter didn't clear the tag selection - tag-1's
      // child (tag-2) is still revealed, proving tag-1 is still selected.
      expect(getByTestId("history-tag-filter-tag-tag-2")).toBeTruthy();
    });

    it("shows an active-filter indicator once a calendar or tag filter is touched, and clears it via reset", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

      expect(queryByTestId("history-filter-active-indicator")).toBeNull();

      await fireEvent.press(getByTestId("history-filter"));
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));

      expect(getByTestId("history-filter-active-indicator")).toBeTruthy();

      await fireEvent.press(getByTestId("history-filter-reset"));

      expect(queryByTestId("history-filter-active-indicator")).toBeNull();
    });

    it("resets both the calendar and tag selections when the sheet's reset link is pressed", async () => {
      mockCommonHooks();

      const { getByTestId, queryByTestId } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      await fireEvent.press(getByTestId("history-tag-filter-tag-tag-1"));
      await fireEvent.press(getByTestId("history-calendar-filter-cal-2"));
      await waitFor(() => expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1"]));
      expect(getByTestId("history-tag-filter-tag-tag-2")).toBeTruthy();

      await fireEvent.press(getByTestId("history-filter-reset"));

      await waitFor(() =>
        expect(usePastEventsByTag).toHaveBeenLastCalledWith(undefined, ["cal-1", "cal-2"])
      );
      // tag-1 was cleared too, so its child tag-2 is no longer revealed.
      expect(queryByTestId("history-tag-filter-tag-tag-2")).toBeNull();
    });

    it("narrows the timeline by 期間 (start/end date), applied client-side on top of the tag-filtered events", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: [
          { id: "event-1", calendarId: "cal-1", title: "夏祭り", startAt: "2026-08-01T10:00:00.000Z" },
          { id: "event-2", calendarId: "cal-1", title: "発表会", startAt: "2026-09-10T10:00:00.000Z" },
        ],
        isLoading: false,
        error: null,
      });

      const { getByTestId, getByText, queryByText } = await render(<HistoryScreen />);
      await fireEvent.press(getByTestId("history-filter"));

      expect(getByText("夏祭り")).toBeTruthy();
      expect(getByText("発表会")).toBeTruthy();

      await fireEvent.press(getByTestId("history-period-enable"));
      await fireEvent.press(getByTestId("history-period-start-button"));
      await fireEvent.changeText(getByTestId("history-period-start-picker"), "2026-08-01T00:00:00.000Z");
      await waitFor(() => expect(getByText("開始 2026-08-01")).toBeTruthy());
      await fireEvent.press(getByTestId("history-period-picker-done"));

      await fireEvent.press(getByTestId("history-period-end-button"));
      await fireEvent.changeText(getByTestId("history-period-end-picker"), "2026-08-31T00:00:00.000Z");
      await waitFor(() => expect(getByText("終了 2026-08-31")).toBeTruthy());
      await fireEvent.press(getByTestId("history-period-picker-done"));

      expect(getByText("夏祭り")).toBeTruthy();
      expect(queryByText("発表会")).toBeNull();
    });

    describe("キーワード検索(「絞り込み」ボタンで確定)", () => {
      const TWO_EVENTS = [
        { id: "event-1", calendarId: "cal-1", title: "夏祭り", startAt: "2026-08-01T10:00:00.000Z" },
        { id: "event-2", calendarId: "cal-1", title: "発表会", startAt: "2026-09-10T10:00:00.000Z" },
      ];

      function mockTwoEvents() {
        mockCommonHooks();
        (usePastEventsByTag as jest.Mock).mockReturnValue({ events: TWO_EVENTS, isLoading: false, error: null });
      }

      it("narrows the timeline by the title keyword only after 「絞り込み」 is pressed, and shows everything again when applied empty", async () => {
        mockTwoEvents();

        const { getByTestId, getByText, queryByText } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-filter"));
        await fireEvent.changeText(getByTestId("history-keyword-input"), "祭り");

        // Typing alone doesn't filter - IME composition must not be interrupted.
        expect(getByText("夏祭り")).toBeTruthy();
        expect(getByText("発表会")).toBeTruthy();

        await fireEvent.press(getByTestId("history-filter-apply"));

        expect(getByText("夏祭り")).toBeTruthy();
        expect(queryByText("発表会")).toBeNull();

        await fireEvent.press(getByTestId("history-filter"));
        await fireEvent.changeText(getByTestId("history-keyword-input"), "");
        await fireEvent.press(getByTestId("history-filter-apply"));

        expect(getByText("夏祭り")).toBeTruthy();
        expect(getByText("発表会")).toBeTruthy();
      });

      it("does not re-render the screen on each keystroke (a controlled input rebuilt from screen state broke Japanese IME conversion)", async () => {
        mockTwoEvents();

        const { getByTestId } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-filter"));
        const callsBefore = (usePastEventsByTag as jest.Mock).mock.calls.length;

        await fireEvent.changeText(getByTestId("history-keyword-input"), "あ");
        await fireEvent.changeText(getByTestId("history-keyword-input"), "あし");
        await fireEvent.changeText(getByTestId("history-keyword-input"), "あした");

        expect((usePastEventsByTag as jest.Mock).mock.calls.length).toBe(callsBefore);
        expect(getByTestId("history-keyword-input").props.value).toBe("あした");
      });

      it("keeps the applied keyword in the input when the sheet is reopened", async () => {
        mockTwoEvents();

        const { getByTestId } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-filter"));
        await fireEvent.changeText(getByTestId("history-keyword-input"), "祭り");
        await fireEvent.press(getByTestId("history-filter-apply"));

        await fireEvent.press(getByTestId("history-filter"));

        expect(getByTestId("history-keyword-input").props.value).toBe("祭り");
      });

      it("discards an unapplied keyword when the sheet is closed with 「閉じる」", async () => {
        mockTwoEvents();

        const { getByTestId, getByText } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-filter"));
        await fireEvent.changeText(getByTestId("history-keyword-input"), "祭り");
        await fireEvent.press(getByTestId("history-filter-close"));

        expect(getByText("発表会")).toBeTruthy();
        await fireEvent.press(getByTestId("history-filter"));
        expect(getByTestId("history-keyword-input").props.value).toBe("");
      });

      it("shows the empty message when no event title matches the applied keyword", async () => {
        mockTwoEvents();

        const { getByTestId, getByText } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-filter"));
        await fireEvent.changeText(getByTestId("history-keyword-input"), "ハロウィン");
        await fireEvent.press(getByTestId("history-filter-apply"));

        expect(getByText("該当する予定がありません")).toBeTruthy();
      });

      it("counts only an applied keyword as an active filter (blue trigger) and clears it, input included, via reset", async () => {
        mockCommonHooks();

        const { getByTestId, queryByTestId } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-filter"));

        await fireEvent.changeText(getByTestId("history-keyword-input"), "祭り");
        expect(queryByTestId("history-filter-active-indicator")).toBeNull();

        await fireEvent.press(getByTestId("history-filter-apply"));
        expect(getByTestId("history-filter-active-indicator")).toBeTruthy();

        await fireEvent.press(getByTestId("history-filter"));
        await fireEvent.press(getByTestId("history-filter-reset"));

        expect(queryByTestId("history-filter-active-indicator")).toBeNull();
        expect(getByTestId("history-keyword-input").props.value).toBe("");
      });

      it("clears a typed-but-unapplied keyword from the input when reset is pressed", async () => {
        mockCommonHooks();

        const { getByTestId } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-filter"));
        await fireEvent.changeText(getByTestId("history-keyword-input"), "祭り");

        await fireEvent.press(getByTestId("history-filter-reset"));

        expect(getByTestId("history-keyword-input").props.value).toBe("");
      });
    });

    it("opens the event detail in an in-tab modal (not navigation) when a past event row is pressed, showing its own go-to-calendar button, and closes it via onBack", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: PAST_EVENTS,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

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

    it("refetches events and tags when the event detail modal closes, so a tag removed there shows up immediately (regression: closing the modal didn't refresh the timeline)", async () => {
      mockCommonHooks();
      const refetchEventsByTag = jest.fn();
      const refetchEventTags = jest.fn();
      (usePastEventsByTag as jest.Mock).mockReturnValue({
        events: PAST_EVENTS,
        isLoading: false,
        error: null,
        refetch: refetchEventsByTag,
      });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {},
        isLoading: false,
        error: null,
        refetch: refetchEventTags,
      });

      const { getByTestId } = await render(<HistoryScreen />);

      await fireEvent.press(getByTestId("history-event-event-1"));
      refetchEventTags.mockClear();
      refetchEventsByTag.mockClear();
      await fireEvent.press(getByTestId("mock-event-detail-content"));

      expect(refetchEventTags).toHaveBeenCalled();
      expect(refetchEventsByTag).toHaveBeenCalled();
    });

    it("shows a + FAB that opens the create-event modal in place (not navigating away), hidden while まとめてタグ付与/削除 is active", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });

      const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

      expect(queryByTestId("mock-event-create-modal")).toBeNull();

      await fireEvent.press(getByTestId("history-add-event-fab"));

      // Still on the same screen (no navigation) - the in-tab modal is up.
      expect(getByTestId("mock-event-create-modal")).toBeTruthy();
      expect(getByTestId("history-mode-switch")).toBeTruthy();

      await fireEvent.press(getByTestId("history-bulk-tag-button"));
      expect(queryByTestId("history-add-event-fab")).toBeNull();
    });

    it("refetches events and tags once a new event is created from the in-tab create modal", async () => {
      mockCommonHooks();
      const refetchEventsByTag = jest.fn();
      const refetchEventTags = jest.fn();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: refetchEventsByTag });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {},
        isLoading: false,
        error: null,
        refetch: refetchEventTags,
      });

      const { getByTestId, queryByTestId } = await render(<HistoryScreen />);

      await fireEvent.press(getByTestId("history-add-event-fab"));
      refetchEventsByTag.mockClear();
      refetchEventTags.mockClear();
      await fireEvent.press(getByTestId("mock-event-create-modal"));

      expect(refetchEventsByTag).toHaveBeenCalled();
      expect(refetchEventTags).toHaveBeenCalled();
      expect(queryByTestId("mock-event-create-modal")).toBeNull();
    });

    describe("まとめてタグ付与/削除", () => {
      const BULK_EVENTS = [
        { id: "event-1", calendarId: "cal-1", title: "夏祭り", startAt: "2026-08-01T10:00:00.000Z" },
        { id: "event-2", calendarId: "cal-1", title: "発表会", startAt: "2026-08-10T10:00:00.000Z" },
      ];

      it("shows the bulk-assign panel and selection circles once the header tag icon is pressed, instead of opening the event detail on row tap", async () => {
        mockCommonHooks();
        (usePastEventsByTag as jest.Mock).mockReturnValue({
          events: BULK_EVENTS,
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });

        const { getByTestId, getByText, queryByTestId } = await render(<HistoryScreen />);

        expect(queryByTestId("history-bulk-tag-panel")).toBeNull();

        await fireEvent.press(getByTestId("history-bulk-tag-button"));

        expect(getByTestId("history-bulk-tag-panel")).toBeTruthy();
        expect(getByTestId("history-event-select-event-1")).toBeTruthy();

        // While bulk mode is active, tapping the row selects it instead of
        // opening the event detail modal.
        await fireEvent.press(getByTestId("history-event-event-1"));
        expect(queryByTestId("mock-event-detail-content")).toBeNull();
        expect(getByText("✓")).toBeTruthy(); // the row's selection circle is now checked
      });

      it("assigns the selected tags to the selected events on confirm, then refetches and leaves bulk mode", async () => {
        mockCommonHooks();
        const refetchEvents = jest.fn();
        const refetchTags = jest.fn();
        (usePastEventsByTag as jest.Mock).mockReturnValue({
          events: BULK_EVENTS,
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

        const { getByTestId, getByText, queryByTestId } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-bulk-tag-button"));

        await fireEvent.press(getByTestId("history-bulk-tag-tag-picker-tag-tag-1"));
        await fireEvent.press(getByTestId("history-event-select-event-1"));
        await fireEvent.press(getByTestId("history-event-select-event-2"));

        await fireEvent.press(getByTestId("history-bulk-tag-confirm"));
        expect(getByText("選択された予定にタグ「行事」を設定してよろしいですか？")).toBeTruthy();
        await fireEvent.press(getByTestId("history-bulk-tag-confirm-ok"));

        await waitFor(() =>
          expect(attachTagsToEventsMock).toHaveBeenCalledWith(["tag-1"], ["event-1", "event-2"])
        );
        await waitFor(() => expect(refetchTags).toHaveBeenCalled());
        await waitFor(() => expect(refetchEvents).toHaveBeenCalled());
        expect(queryByTestId("history-bulk-tag-panel")).toBeNull();
      });

      it("switches to remove mode via 'まとめて削除' and removes all tags from the selected events on confirm", async () => {
        mockCommonHooks();
        (usePastEventsByTag as jest.Mock).mockReturnValue({
          events: BULK_EVENTS,
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

        const { getByTestId, getByText } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-bulk-tag-button"));

        await fireEvent.press(getByTestId("history-bulk-tag-switch-to-remove"));
        await fireEvent.press(getByTestId("history-event-select-event-1"));

        await fireEvent.press(getByTestId("history-bulk-tag-confirm"));
        expect(getByText("選択された予定の全てのタグを削除してよろしいですか？")).toBeTruthy();
        await fireEvent.press(getByTestId("history-bulk-tag-confirm-ok"));

        await waitFor(() => expect(removeAllTagsFromEventsMock).toHaveBeenCalledWith(["event-1"]));
      });

      it("closes bulk mode (and its selections) when the header tag icon is pressed again", async () => {
        mockCommonHooks();
        (usePastEventsByTag as jest.Mock).mockReturnValue({
          events: BULK_EVENTS,
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });

        const { getByTestId, queryByTestId } = await render(<HistoryScreen />);
        await fireEvent.press(getByTestId("history-bulk-tag-button"));
        await fireEvent.press(getByTestId("history-event-select-event-1"));

        await fireEvent.press(getByTestId("history-bulk-tag-button"));

        expect(queryByTestId("history-bulk-tag-panel")).toBeNull();
        expect(queryByTestId("history-bulk-tag-bar")).toBeNull();
      });
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

    it("shows a loading message instead of the empty state while memories are still loading (regression)", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: [], isLoading: true, error: null, refetch: jest.fn() });

      const { getByText, queryByText } = await renderPhotoPanel();

      expect(getByText("読み込み中…")).toBeTruthy();
      expect(queryByText("思い出がありません")).toBeNull();
    });

    it("refetches memories when the panel regains focus, so a photo added elsewhere (e.g. from the calendar) shows up (regression)", async () => {
      mockCommonHooks();
      const refetchMemories = jest.fn();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({
        entries: [],
        isLoading: false,
        error: null,
        refetch: refetchMemories,
      });

      await renderPhotoPanel();

      await waitFor(() => expect(refetchMemories).toHaveBeenCalled());
    });

    it("shows a tag filter (colored badge chips, AND semantics), narrowing the photo grid to memories that have every selected tag (regression: tag filter was missing from this panel entirely)", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({
        entries: [
          { ...MEMORY_ENTRIES[0], id: "event-a", title: "行事のみ" },
          { ...MEMORY_ENTRIES[0], id: "event-b", title: "誕生日のみ" },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {
          "event-a": [{ id: "tag-1", name: "行事", color: "#ff0000" }],
          "event-b": [{ id: "tag-2", name: "誕生日", color: "#00ff00" }],
        },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText, queryByText } = await renderPhotoPanel();
      await fireEvent.press(getByTestId("memories-filter"));

      const flattenStyle = (style: unknown) =>
        Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
      expect(flattenStyle(getByTestId("memories-tag-filter-tag-tag-1").props.style).backgroundColor).toBe("#ff0000");

      await fireEvent.press(getByTestId("memories-tag-filter-tag-tag-1"));

      expect(getByText("行事のみ")).toBeTruthy();
      expect(queryByText("誕生日のみ")).toBeNull();
    });

    it("filters the photo grid to memories with no tags at all when 未設定 is selected", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({
        entries: [
          { ...MEMORY_ENTRIES[0], id: "event-a", title: "タグ無し" },
          { ...MEMORY_ENTRIES[0], id: "event-b", title: "タグ有り" },
        ],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: { "event-b": [{ id: "tag-1", name: "行事", color: "#ff0000" }] },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { getByTestId, getByText, queryByText } = await renderPhotoPanel();
      await fireEvent.press(getByTestId("memories-filter"));
      await fireEvent.press(getByTestId("memories-tag-filter-untagged"));

      expect(getByText("タグ無し")).toBeTruthy();
      expect(queryByText("タグ有り")).toBeNull();
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

    it("refetches memories and tags when the event detail modal closes, so a tag removed there shows up immediately (regression)", async () => {
      mockCommonHooks();
      const refetchMemories = jest.fn();
      const refetchEventTags = jest.fn();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({
        entries: MEMORY_ENTRIES,
        isLoading: false,
        error: null,
        refetch: refetchMemories,
      });
      (useEventTagsByEvents as jest.Mock).mockReturnValue({
        tagsByEventId: {},
        isLoading: false,
        error: null,
        refetch: refetchEventTags,
      });

      const { getByTestId } = await renderPhotoPanel();

      await fireEvent.press(getByTestId("memory-item-event-1"));
      refetchMemories.mockClear();
      refetchEventTags.mockClear();
      await fireEvent.press(getByTestId("mock-event-detail-content"));

      expect(refetchEventTags).toHaveBeenCalled();
      expect(refetchMemories).toHaveBeenCalled();
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

  describe("広告", () => {
    function AdsStarter() {
      const { start } = useAds();
      start();
      return null;
    }

    async function renderWithAds() {
      const utils = await render(
        <AdsProvider>
          <AdsStarter />
          <HistoryScreen />
        </AdsProvider>
      );
      await act(async () => {});
      return utils;
    }

    // 月(2026-M)ごとに1件ずつの過去の予定。
    function makeMonthlyEvents(count: number) {
      return Array.from({ length: count }, (_, index) => ({
        id: `month-event-${index + 1}`,
        calendarId: "cal-1",
        title: `予定${index + 1}`,
        startAt: `2026-${String(12 - index).padStart(2, "0")}-10T10:00:00.000Z`,
        endAt: `2026-${String(12 - index).padStart(2, "0")}-10T11:00:00.000Z`,
      }));
    }

    function monthKey(index: number): string {
      return `2026-${String(12 - index).padStart(2, "0")}`;
    }

    async function measureTimeline(utils: Awaited<ReturnType<typeof renderWithAds>>, groupHeight: number, viewportHeight: number, count: number) {
      for (let index = 0; index < count; index += 1) {
        const group = utils.queryByTestId(`history-month-group-${monthKey(index)}`);
        if (group) {
          await fireEvent(group, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: groupHeight } } });
        }
      }
      await fireEvent(utils.getByTestId("history-timeline"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 360, height: viewportHeight } },
      });
    }

    it("puts a banner after every 2 months of the timeline, but not on the first screen", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: makeMonthlyEvents(8), isLoading: false, error: null, refetch: jest.fn() });
      const utils = await renderWithAds();

      // 1か月分=200・画面=500: 2か月目の直後(下端400)は最初の画面の中なので出ない。4か月目の直後(800)は出る
      await measureTimeline(utils, 200, 500, 8);

      expect(utils.queryByTestId("history-timeline-ad-1")).toBeNull();
      expect(utils.getByTestId("history-timeline-ad-3")).toBeTruthy();
    });

    it("puts no banner in the timeline when it all fits on the first screen", async () => {
      mockCommonHooks();
      (usePastEventsByTag as jest.Mock).mockReturnValue({ events: makeMonthlyEvents(4), isLoading: false, error: null, refetch: jest.fn() });
      const utils = await renderWithAds();

      await measureTimeline(utils, 100, 5000, 4);

      expect(utils.queryByTestId("history-timeline-ad-1")).toBeNull();
      expect(utils.queryByTestId("history-timeline-ad-3")).toBeNull();
    });

    // 同じ月に n 枚の写真つきの予定(1行に2枚並ぶ)。
    function makePhotoEntries(count: number) {
      return Array.from({ length: count }, (_, index) => ({
        id: `photo-event-${index + 1}`,
        calendarId: "cal-1",
        title: `思い出${index + 1}`,
        startAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
        endAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T11:00:00.000Z`,
        thumbnailStoragePath: `photo-event-${index + 1}/a.jpg`,
        thumbnailUrl: `https://example.com/signed/${index + 1}.jpg`,
      }));
    }

    it("puts a large ad in the photo grid after every 10 rows (20 photos)", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: makePhotoEntries(24), isLoading: false, error: null, refetch: jest.fn() });
      const utils = await renderWithAds();
      await fireEvent.press(utils.getByTestId("history-mode-photos"));

      // 並びは新しい順。20枚目の写真の直後に広告が入る。
      expect(utils.getAllByTestId(/^memories-ad-after-photo-event-\d+$/)).toHaveLength(1);
      expect(utils.getByTestId(/^memories-ad-after-photo-event-\d+-view$/).props.size).toBe("MEDIUM_RECTANGLE");
    });

    it("puts no ad in the photo grid when there are fewer than 10 rows", async () => {
      mockCommonHooks();
      (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries: makePhotoEntries(10), isLoading: false, error: null, refetch: jest.fn() });
      const utils = await renderWithAds();
      await fireEvent.press(utils.getByTestId("history-mode-photos"));

      expect(utils.queryAllByTestId(/^memories-ad-after-photo-event-\d+$/)).toHaveLength(0);
    });
  });
});
