import { fireEvent, render, waitFor } from "@testing-library/react-native";

import TodosScreen from "../todos";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import { useEventsInRange } from "../../../src/features/events/hooks";
import { useEventTagsByEvents } from "../../../src/features/tags/hooks";
import {
  useDeleteTodo,
  useOrphanedTodos,
  useReattachTodoToExistingEvent,
  useReattachTodoToNewPersonalEvent,
  useToggleDone,
  useTodosByCalendars,
  useUpdateTodo,
} from "../../../src/features/todos/hooks";

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: jest.fn() },
    Tabs: {
      Screen: ({ options }: any) =>
        React.createElement(React.Fragment, null, options?.headerTitle?.(), options?.headerRight?.()),
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

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/events/hooks", () => ({
  useEventsInRange: jest.fn(),
}));

jest.mock("../../../src/features/tags/hooks", () => ({
  useEventTagsByEvents: jest.fn(),
}));

jest.mock("../../../src/features/todos/hooks", () => ({
  useTodosByCalendars: jest.fn(),
  useOrphanedTodos: jest.fn(),
  useReattachTodoToExistingEvent: jest.fn(),
  useReattachTodoToNewPersonalEvent: jest.fn(),
  useToggleDone: jest.fn(),
  useDeleteTodo: jest.fn(),
  useUpdateTodo: jest.fn(),
}));

// EventDetailContent has its own large, independently-tested suite - mocking
// it here (via the shared EventDetailModal it's wrapped in) keeps this file
// focused on TodosScreen's own job (opening the in-tab detail modal for the
// right event) instead of re-mocking that component's own hook dependencies.
jest.mock("../../../src/features/events/components/EventDetailContent", () => {
  const { Text, TouchableOpacity } = require("react-native");
  return {
    EventDetailContent: ({ eventId, onBack }: { eventId: string; onBack: () => void }) => (
      <TouchableOpacity testID="mock-event-detail-content" onPress={onBack}>
        <Text>{eventId}</Text>
      </TouchableOpacity>
    ),
  };
});

const CALENDARS = [
  { id: "cal-1", name: "我が家", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
  { id: "cal-2", name: "友人グループ", createdBy: "user-2", createdAt: "2026-08-17T01:00:00.000Z" },
];

const TODOS = [
  {
    id: "todo-1",
    eventId: "event-1",
    eventCalendarId: "cal-1",
    title: "楽譜購入",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "発表会",
    eventStartAt: "2026-09-10T10:00:00.000Z",
    eventEndAt: "2026-09-10T12:00:00.000Z",
    eventIsAllDay: false,
  },
  {
    id: "todo-2",
    eventId: "event-1",
    eventCalendarId: "cal-1",
    title: "練習",
    isDone: true,
    completedAt: "2026-08-17T00:00:00.000Z",
    reminderAt: "2026-08-19T09:00:00.000Z",
    eventTitle: "発表会",
    eventStartAt: "2026-09-10T10:00:00.000Z",
    eventEndAt: "2026-09-10T12:00:00.000Z",
    eventIsAllDay: false,
  },
];

const TODOS_TWO_EVENTS = [
  ...TODOS,
  {
    id: "todo-3",
    eventId: "event-2",
    eventCalendarId: "cal-2",
    title: "花火を買う",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "夏祭り",
    eventStartAt: "2026-08-01T10:00:00.000Z",
    eventEndAt: "2026-08-01T20:00:00.000Z",
    eventIsAllDay: false,
  },
];

const TODOS_PAST_DONE_EVENT = [
  {
    id: "todo-5",
    eventId: "event-4",
    eventCalendarId: "cal-1",
    title: "出店の片付け",
    isDone: true,
    completedAt: "2026-08-01T00:00:00.000Z",
    reminderAt: "2026-07-25T09:00:00.000Z",
    eventTitle: "夏祭り",
    eventStartAt: "2026-08-01T10:00:00.000Z",
    eventEndAt: "2026-08-01T20:00:00.000Z",
    eventIsAllDay: false,
  },
];

// "today" (JST) is fixed at 2026-09-05 wherever these are used - see the
// system time set in the tests below.
const TODOS_URGENCY = [
  {
    id: "u-overdue",
    eventId: "event-o",
    eventCalendarId: "cal-1",
    title: "資料を作成する",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "総会",
    eventStartAt: "2026-09-01T01:00:00.000Z", // 2026-09-01 JST
    eventEndAt: "2026-09-01T03:00:00.000Z",
    eventIsAllDay: false,
  },
  {
    id: "u-today",
    eventId: "event-t",
    eventCalendarId: "cal-1",
    title: "プレゼントを買う",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "誕生日会",
    eventStartAt: "2026-09-05T01:00:00.000Z", // 2026-09-05 JST
    eventEndAt: "2026-09-05T03:00:00.000Z",
    eventIsAllDay: false,
  },
  {
    id: "u-tomorrow",
    eventId: "event-tm",
    eventCalendarId: "cal-1",
    title: "ケーキを予約する",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "パーティー",
    eventStartAt: "2026-09-06T01:00:00.000Z", // 2026-09-06 JST
    eventEndAt: "2026-09-06T03:00:00.000Z",
    eventIsAllDay: false,
  },
  {
    id: "u-none",
    eventId: "event-n",
    eventCalendarId: "cal-1",
    title: "チケットを買う",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "旅行",
    eventStartAt: "2026-09-20T01:00:00.000Z", // far future
    eventEndAt: "2026-09-20T03:00:00.000Z",
    eventIsAllDay: false,
  },
];

const TODOS_MULTI_DAY_EVENT = [
  {
    id: "todo-4",
    eventId: "event-3",
    eventCalendarId: "cal-1",
    title: "宿の予約",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "旅行",
    eventStartAt: "2026-09-10T10:00:00.000Z",
    eventEndAt: "2026-09-12T10:00:00.000Z",
    eventIsAllDay: false,
  },
];

function mockCommonHooks(todos: typeof TODOS, refetch = jest.fn()) {
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null, refetch: jest.fn() });
  (useTodosByCalendars as jest.Mock).mockReturnValue({ todos, isLoading: false, error: null, refetch });
  (useOrphanedTodos as jest.Mock).mockReturnValue({
    todos: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useEventsInRange as jest.Mock).mockReturnValue({ events: [], isLoading: false, error: null, refetch: jest.fn() });
  (useEventTagsByEvents as jest.Mock).mockReturnValue({
    tagsByEventId: {},
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useReattachTodoToExistingEvent as jest.Mock).mockReturnValue({
    reattachTodoToExistingEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useReattachTodoToNewPersonalEvent as jest.Mock).mockReturnValue({
    reattachTodoToNewPersonalEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useToggleDone as jest.Mock).mockReturnValue({ toggleDone: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
}

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
}

describe("TodosScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Before every fixture event date used in this file (2026-08-01,
    // 2026-08-19, 2026-09-10, 2026-09-12), so they're all "future" by
    // default unless a test explicitly moves "now" past one of them.
    jest.setSystemTime(new Date("2026-07-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("groups todos into a section per linked event", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId, getByText } = await render(<TodosScreen />);

    expect(getByText("発表会")).toBeTruthy();
    expect(getByTestId("todo-item-todo-1")).toBeTruthy();

    // todo-2 is done, so it starts out collapsed under the "完了済み" toggle.
    await fireEvent.press(getByTestId("todo-done-toggle-event-1"));
    expect(getByTestId("todo-item-todo-2")).toBeTruthy();
  });

  it("marks the screen as personal-only, since ToDos aren't shared with other calendar members", async () => {
    mockCommonHooks(TODOS);

    const { getByText, getByTestId } = await render(<TodosScreen />);

    expect(getByText("個人用")).toBeTruthy();
    expect(getByTestId("personal-only-badge-lock-icon")).toBeTruthy();
  });

  it("orders sections by the linked event's start time", async () => {
    mockCommonHooks(TODOS_TWO_EVENTS);

    const { getByTestId } = await render(<TodosScreen />);

    const container = getByTestId("todos-section-list");
    const sectionIds = container.props.data.map((group: { eventId: string }) => group.eventId);
    expect(sectionIds).toEqual(["event-2", "event-1"]);
  });

  it("shows a calendar switcher (in the header filter sheet) defaulting to all calendars selected, toggling a calendar off/on to narrow the list", async () => {
    mockCommonHooks([]);

    const { getByTestId } = await render(<TodosScreen />);
    await fireEvent.press(getByTestId("todos-filter"));

    expect(getByTestId("todos-calendar-switch-cal-1")).toBeTruthy();
    expect(getByTestId("todos-calendar-switch-cal-2")).toBeTruthy();
    await waitFor(() =>
      expect(useTodosByCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"])
    );

    // 両方選択済みの状態からcal-2をタップすると外れる
    await fireEvent.press(getByTestId("todos-calendar-switch-cal-2"));
    await waitFor(() => expect(useTodosByCalendars).toHaveBeenLastCalledWith(["cal-1"]));

    // 再度タップすると戻る
    await fireEvent.press(getByTestId("todos-calendar-switch-cal-2"));
    await waitFor(() =>
      expect(useTodosByCalendars).toHaveBeenLastCalledWith(["cal-1", "cal-2"])
    );
  });

  it("keeps a calendar deselected after toggling, even though useTodosByCalendars' own refetch identity changes with the selection (regression: the filter must not silently reset itself on every toggle)", async () => {
    mockCommonHooks([]);
    // The real useTodosByCalendars hands back a *new* refetch function every
    // time the calendar id list changes (it's keyed on the joined ids) -
    // this is exactly what exposed the bug: bundling the filter's
    // reset-on-blur cleanup into the same useFocusEffect as a refetch call
    // meant every toggle (which changes refetch's identity) tore down and
    // rebuilt that effect, firing the *previous* run's cleanup - the reset -
    // immediately, so the tap looked like it did nothing.
    (useTodosByCalendars as jest.Mock).mockImplementation(() => ({
      todos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    }));

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);
    await fireEvent.press(getByTestId("todos-filter"));

    await fireEvent.press(getByTestId("todos-calendar-switch-cal-2"));

    expect(queryByTestId("todos-calendar-switch-cal-2-check")).toBeNull();
  });

  it("refetches when the tab regains focus, so ToDos added elsewhere (e.g. from the calendar) show up", async () => {
    const refetch = jest.fn();
    mockCommonHooks(TODOS, refetch);

    await render(<TodosScreen />);

    // The screen mounting counts as "gaining focus" here (see the
    // useFocusEffect mock) - the important thing is it's driven by focus,
    // not just the hook's own mount-time fetch, so switching back to this
    // tab later (an already-mounted screen regaining focus, not a fresh
    // mount) would also trigger it in the real app.
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("collapses and expands a section when its header is pressed", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    expect(getByTestId("todo-item-todo-1")).toBeTruthy();

    await fireEvent.press(getByTestId("todo-section-event-1"));
    expect(queryByTestId("todo-item-todo-1")).toBeNull();

    await fireEvent.press(getByTestId("todo-section-event-1"));
    expect(getByTestId("todo-item-todo-1")).toBeTruthy();
  });

  it("opens the event's detail in an in-tab modal when its '...' button is pressed", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId, getByText, queryByTestId } = await render(<TodosScreen />);

    expect(queryByTestId("mock-event-detail-content")).toBeNull();

    await fireEvent.press(getByTestId("todo-section-open-event-event-1"));

    expect(getByTestId("mock-event-detail-content")).toBeTruthy();
    expect(getByText("event-1")).toBeTruthy();
  });

  it("closes the event detail modal when its back button is pressed", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-section-open-event-event-1"));
    expect(getByTestId("mock-event-detail-content")).toBeTruthy();

    await fireEvent.press(getByTestId("mock-event-detail-content"));

    expect(queryByTestId("mock-event-detail-content")).toBeNull();
  });

  it("opens the right event's detail when todos span multiple events/calendars", async () => {
    mockCommonHooks(TODOS_TWO_EVENTS);

    const { getByTestId, getByText } = await render(<TodosScreen />);

    // event-2 (夏祭り) belongs to cal-2, unlike event-1 which belongs to cal-1.
    await fireEvent.press(getByTestId("todo-section-open-event-event-2"));

    expect(getByText("event-2")).toBeTruthy();
  });

  it("shows a summary of how many todos are incomplete, due soon, and overdue - as three separate counts", async () => {
    mockCommonHooks(TODOS_URGENCY);
    jest.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));

    const { getByText } = await render(<TodosScreen />);

    expect(getByText("未完了 4件")).toBeTruthy();
    // "期限が近い" now covers only today (event-t) + tomorrow (event-tm) = 2;
    // the overdue one (event-o) gets its own count, and the far-future one doesn't count at all.
    expect(getByText("期限が近い 2件")).toBeTruthy();
    expect(getByText("期限超過 1件")).toBeTruthy();
  });

  it("shows a 'タップで展開' hint on the overdue panel and reveals the overdue events (with their badge) when tapped", async () => {
    mockCommonHooks(TODOS_URGENCY);
    jest.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));

    const { getByTestId, queryByTestId, getByText } = await render(<TodosScreen />);

    expect(getByText("タップで展開")).toBeTruthy();
    expect(queryByTestId("todo-section-container-event-o")).toBeNull();

    await fireEvent.press(getByTestId("todos-summary-overdue"));

    expect(getByTestId("todo-section-container-event-o")).toBeTruthy();
    expect(getByText("期限超過")).toBeTruthy();
    expect(getByText("タップで隠す")).toBeTruthy();
  });

  it("shows no 'タップで展開' hint, and doesn't respond to taps, on the overdue panel when there's nothing overdue", async () => {
    mockCommonHooks(TODOS); // no overdue todos in this fixture
    jest.setSystemTime(new Date("2026-07-01T00:00:00.000Z"));

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    expect(queryByTestId("todos-summary-overdue-hint")).toBeNull();

    await fireEvent.press(getByTestId("todos-summary-overdue"));

    expect(queryByTestId("todos-overdue-section")).toBeNull();
  });

  it("responds to tapping the 未完了/期限が近い summary panels without crashing (they scroll the list into view)", async () => {
    mockCommonHooks(TODOS_URGENCY);
    jest.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todos-summary-incomplete"));
    await fireEvent.press(getByTestId("todos-summary-urgent"));

    expect(getByTestId("todos-summary")).toBeTruthy();
  });

  it("badges today's and tomorrow's event sections, and leaves a far-future one unbadged", async () => {
    mockCommonHooks(TODOS_URGENCY);
    jest.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));

    const { getByTestId, queryByTestId, getByText } = await render(<TodosScreen />);

    expect(getByTestId("todo-section-badge-event-t")).toBeTruthy();
    expect(getByText("今日")).toBeTruthy();
    expect(getByTestId("todo-section-badge-event-tm")).toBeTruthy();
    expect(getByText("明日")).toBeTruthy();
    expect(queryByTestId("todo-section-badge-event-n")).toBeNull();
  });

  it("shows each section's done/total progress count as 'N件/N件', not 'N/N' (easy to mistake for a date)", async () => {
    mockCommonHooks(TODOS); // event-1: todo-1 not done, todo-2 done => 1件/2件

    const { getByText } = await render(<TodosScreen />);

    expect(getByText("1件/2件")).toBeTruthy();
  });

  it("keeps completed todos collapsed by default within a section, expandable via a toggle", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId, queryByTestId, getByText } = await render(<TodosScreen />);

    expect(queryByTestId("todo-item-todo-2")).toBeNull();
    expect(getByText("完了済みを表示 (1)")).toBeTruthy();

    await fireEvent.press(getByTestId("todo-done-toggle-event-1"));

    expect(getByTestId("todo-item-todo-2")).toBeTruthy();
    expect(getByText("完了済みを隠す")).toBeTruthy();

    await fireEvent.press(getByTestId("todo-done-toggle-event-1"));

    expect(queryByTestId("todo-item-todo-2")).toBeNull();
  });

  it("hides the completed-todos toggle entirely when a section has no completed todos", async () => {
    mockCommonHooks(TODOS_TWO_EVENTS); // event-2 has only one, incomplete, todo

    const { queryByTestId } = await render(<TodosScreen />);

    expect(queryByTestId("todo-done-toggle-event-2")).toBeNull();
  });

  it("shows the event's tags next to its title when it has any", async () => {
    mockCommonHooks(TODOS); // event-1
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

    const { getByTestId, getByText } = await render(<TodosScreen />);

    expect(getByTestId("todo-section-tags-event-1")).toBeTruthy();
    expect(getByText("音楽")).toBeTruthy();
    expect(useEventTagsByEvents).toHaveBeenLastCalledWith(["event-1"]);
  });

  it("shows no tags row for an event with no tags", async () => {
    mockCommonHooks(TODOS); // useEventTagsByEvents defaults to an empty map via mockCommonHooks

    const { queryByTestId } = await render(<TodosScreen />);

    expect(queryByTestId("todo-section-tags-event-1")).toBeNull();
  });

  it("shows the event's start date (no time) beside each section", async () => {
    mockCommonHooks(TODOS);

    const { getByText } = await render(<TodosScreen />);

    expect(getByText("2026/09/10")).toBeTruthy();
  });

  it("shows a date range when the linked event spans multiple days", async () => {
    mockCommonHooks(TODOS_MULTI_DAY_EVENT);

    const { getByText } = await render(<TodosScreen />);

    expect(getByText("2026/09/10〜2026/09/12")).toBeTruthy();
  });

  it("toggles done state and refetches so the list updates immediately", async () => {
    const refetch = jest.fn();
    mockCommonHooks(TODOS, refetch);
    const toggleDoneMock = jest.fn().mockResolvedValue(true);
    (useToggleDone as jest.Mock).mockReturnValue({ toggleDone: toggleDoneMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-checkbox-todo-1"));

    await waitFor(() => expect(toggleDoneMock).toHaveBeenCalledWith("todo-1", true));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("uses icons instead of text for the delete-confirmation modal's cancel/delete buttons", async () => {
    mockCommonHooks(TODOS);
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });

    const { getByTestId, queryByText } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-delete-todo-1"));

    expect(queryByText("キャンセル")).toBeNull();
    expect(queryByText("削除する")).toBeNull();
    expect(getByTestId("todo-delete-cancel-todo-1")).toBeTruthy();
    expect(getByTestId("todo-delete-confirm-todo-1")).toBeTruthy();
  });

  it("shows a delete confirmation modal before deleting, and deletes + refetches on confirm", async () => {
    const refetch = jest.fn();
    mockCommonHooks(TODOS, refetch);
    const deleteTodoMock = jest.fn().mockResolvedValue(true);
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: deleteTodoMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-delete-todo-1"));
    expect(deleteTodoMock).not.toHaveBeenCalled();
    expect(getByTestId("todo-delete-confirm-todo-1")).toBeTruthy();

    await fireEvent.press(getByTestId("todo-delete-confirm-todo-1"));

    await waitFor(() => expect(deleteTodoMock).toHaveBeenCalledWith("todo-1"));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(queryByTestId("todo-delete-confirm-todo-1")).toBeNull();
  });

  it("cancels deletion without calling deleteTodo when the delete confirmation is dismissed", async () => {
    mockCommonHooks(TODOS);
    const deleteTodoMock = jest.fn().mockResolvedValue(true);
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: deleteTodoMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-delete-todo-1"));
    await fireEvent.press(getByTestId("todo-delete-cancel-todo-1"));

    expect(deleteTodoMock).not.toHaveBeenCalled();
    expect(queryByTestId("todo-delete-confirm-todo-1")).toBeNull();
  });

  it("cancels deletion without calling deleteTodo when tapping outside the confirmation card, on the backdrop", async () => {
    mockCommonHooks(TODOS);
    const deleteTodoMock = jest.fn().mockResolvedValue(true);
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: deleteTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-delete-todo-1"));
    await fireEvent.press(getByTestId("todo-delete-backdrop-todo-1"));

    expect(deleteTodoMock).not.toHaveBeenCalled();
  });

  it("shows the reminder status icon active (bell, blue) when a reminder is set, on the same row as the title", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId } = await render(<TodosScreen />);

    // todo-2 is done, so it starts out collapsed under the "完了済み" toggle.
    await fireEvent.press(getByTestId("todo-done-toggle-event-1"));

    const flattened = flattenStyle(getByTestId("todo-reminder-bell-todo-2").props.style);
    expect(flattened.tintColor).toBe("#2f6fed");
  });

  it("shows the reminder status icon inactive (bell-off, gray) when no reminder is set", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId } = await render(<TodosScreen />);

    const flattened = flattenStyle(getByTestId("todo-reminder-bell-todo-1").props.style);
    expect(flattened.tintColor).toBe("#999");
  });

  it("opens the reminder modal by tapping the bell icon itself (no separate settings button), and saves a picked reminder", async () => {
    const refetch = jest.fn();
    mockCommonHooks(TODOS, refetch);
    const updateTodoMock = jest.fn().mockResolvedValue(true);
    (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: updateTodoMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    expect(queryByTestId("todo-settings-todo-1")).toBeNull(); // the old gear button is gone

    await fireEvent.press(getByTestId("todo-reminder-icon-todo-1"));
    // todo-1's linked event starts 2026-09-10T10:00:00.000Z (timed, not all-day).
    await fireEvent.press(getByTestId("todo-reminder-todo-1-option-before_1h"));

    await waitFor(() =>
      expect(updateTodoMock).toHaveBeenCalledWith("todo-1", { reminderAt: "2026-09-10T09:00:00.000Z" })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("closes the reminder modal via its close button without having picked anything, leaving the bell off", async () => {
    mockCommonHooks(TODOS);
    const updateTodoMock = jest.fn().mockResolvedValue(true);
    (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: updateTodoMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-reminder-icon-todo-1"));
    await fireEvent.press(getByTestId("todo-reminder-close-todo-1"));

    expect(updateTodoMock).not.toHaveBeenCalled();
    expect(queryByTestId("todo-reminder-todo-1-option-before_1h")).toBeNull();
    const flattened = flattenStyle(getByTestId("todo-reminder-bell-todo-1").props.style);
    expect(flattened.tintColor).toBe("#999"); // still bell-off
  });

  it("closes the reminder modal without saving when tapping outside it, on the backdrop", async () => {
    mockCommonHooks(TODOS);
    const updateTodoMock = jest.fn().mockResolvedValue(true);
    (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: updateTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-reminder-icon-todo-1"));
    await fireEvent.press(getByTestId("todo-reminder-backdrop-todo-1"));

    expect(updateTodoMock).not.toHaveBeenCalled();
  });

  it("shows the all-day reminder options for a todo linked to an all-day event", async () => {
    const allDayTodo = { ...TODOS[0], eventIsAllDay: true };
    mockCommonHooks([allDayTodo]);

    const { getByTestId, getByText, queryByText } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-reminder-icon-todo-1"));

    expect(getByText("当日")).toBeTruthy();
    expect(getByText("1日前")).toBeTruthy();
    expect(queryByText("開始時")).toBeNull();
  });

  it("shows only future events in the main list by default", async () => {
    mockCommonHooks(TODOS_TWO_EVENTS);
    // event-2 (夏祭り, 2026-08-01) is now in the past; event-1 (発表会, 2026-09-10) is future.
    jest.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));

    const { getByTestId } = await render(<TodosScreen />);

    const container = getByTestId("todos-section-list");
    const sectionIds = container.props.data.map((group: { eventId: string }) => group.eventId);
    expect(sectionIds).toEqual(["event-1"]);
  });

  it("always shows the overdue alert row for a past event with still-incomplete todos, outside the past toggle", async () => {
    mockCommonHooks(TODOS_TWO_EVENTS);
    // event-2 (夏祭り, 2026-08-01) is past, and its only todo isn't done yet.
    jest.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));

    const { getByTestId, getByText, queryByTestId } = await render(<TodosScreen />);

    expect(getByText("期限超過 1件")).toBeTruthy();
    // Nothing is fully-completed-and-past here, so the past toggle has nothing to show.
    expect(queryByTestId("todos-past-toggle")).toBeNull();

    await fireEvent.press(getByTestId("todos-summary-overdue"));

    expect(getByTestId("todo-section-container-event-2")).toBeTruthy();
    expect(getByTestId("todo-section-badge-event-2")).toBeTruthy();
  });

  it("reveals fully-completed past events via the past-todos toggle, and can hide them again", async () => {
    mockCommonHooks(TODOS_PAST_DONE_EVENT);
    jest.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));

    const { getByTestId, getByText, queryByTestId } = await render(<TodosScreen />);

    expect(getByText("過去のToDoを表示 (1)")).toBeTruthy();
    expect(queryByTestId("todos-past-section-list")).toBeNull();
    // A fully-completed past event has nothing left to act on, so it's not an overdue section.
    expect(queryByTestId("todo-section-container-event-4")).toBeNull();

    await fireEvent.press(getByTestId("todos-past-toggle"));

    const pastContainer = getByTestId("todos-past-section-list");
    expect(pastContainer.props.data.map((group: { eventId: string }) => group.eventId)).toEqual(["event-4"]);
    expect(getByText("過去のToDoを隠す")).toBeTruthy();

    await fireEvent.press(getByTestId("todos-past-toggle"));

    expect(queryByTestId("todos-past-section-list")).toBeNull();
  });

  it("shows a 今後のToDoはありません message when every event has already passed, listing incomplete ones as overdue instead", async () => {
    mockCommonHooks(TODOS_TWO_EVENTS);
    // Past both event-1 (2026-09-10) and event-2 (2026-08-01); both still have incomplete todos.
    jest.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));

    const { getByText, getByTestId, queryByTestId } = await render(<TodosScreen />);

    expect(getByText("今後のToDoはありません")).toBeTruthy();
    expect(queryByTestId("todos-section-list")).toBeNull();
    // Both events are overdue (still incomplete), not fully-completed, so the past toggle is empty/absent.
    expect(queryByTestId("todos-past-toggle")).toBeNull();

    await fireEvent.press(getByTestId("todos-summary-overdue"));

    expect(getByTestId("todo-section-container-event-1")).toBeTruthy();
    expect(getByTestId("todo-section-container-event-2")).toBeTruthy();
  });

  const ORPHANED_TODO = { id: "orphan-1", eventId: null, title: "宛名を書く", isDone: false, completedAt: null, reminderAt: null };

  it("shows a section of orphaned (unlinked) todos, hidden when there are none", async () => {
    mockCommonHooks(TODOS);

    const { queryByTestId } = await render(<TodosScreen />);

    expect(queryByTestId("orphaned-todos-section")).toBeNull();
  });

  it("shows orphaned todos in their own section", async () => {
    mockCommonHooks(TODOS);
    (useOrphanedTodos as jest.Mock).mockReturnValue({
      todos: [ORPHANED_TODO],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByTestId, getByText } = await render(<TodosScreen />);

    expect(getByTestId("orphaned-todos-section")).toBeTruthy();
    expect(getByText("未紐付けのToDo")).toBeTruthy();
    expect(getByTestId("orphaned-todo-item-orphan-1")).toBeTruthy();
  });

  it("toggles an orphaned todo's done state and refetches the orphaned list", async () => {
    mockCommonHooks(TODOS);
    const refetchOrphaned = jest.fn();
    const toggleDoneMock = jest.fn().mockResolvedValue(true);
    (useOrphanedTodos as jest.Mock).mockReturnValue({
      todos: [ORPHANED_TODO],
      isLoading: false,
      error: null,
      refetch: refetchOrphaned,
    });
    (useToggleDone as jest.Mock).mockReturnValue({ toggleDone: toggleDoneMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("orphaned-todo-checkbox-orphan-1"));

    await waitFor(() => expect(toggleDoneMock).toHaveBeenCalledWith("orphan-1", true));
    await waitFor(() => expect(refetchOrphaned).toHaveBeenCalled());
  });

  it("deletes an orphaned todo and refetches the orphaned list", async () => {
    mockCommonHooks(TODOS);
    const refetchOrphaned = jest.fn();
    const deleteTodoMock = jest.fn().mockResolvedValue(true);
    (useOrphanedTodos as jest.Mock).mockReturnValue({
      todos: [ORPHANED_TODO],
      isLoading: false,
      error: null,
      refetch: refetchOrphaned,
    });
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: deleteTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("orphaned-todo-delete-orphan-1"));

    await waitFor(() => expect(deleteTodoMock).toHaveBeenCalledWith("orphan-1"));
    await waitFor(() => expect(refetchOrphaned).toHaveBeenCalled());
  });

  it("opens the reattach modal for an orphaned todo and reattaches it to an existing event", async () => {
    mockCommonHooks(TODOS);
    const refetchOrphaned = jest.fn();
    const refetch = jest.fn();
    const reattachMock = jest.fn().mockResolvedValue(true);
    (useTodosByCalendars as jest.Mock).mockReturnValue({ todos: TODOS, isLoading: false, error: null, refetch });
    (useOrphanedTodos as jest.Mock).mockReturnValue({
      todos: [ORPHANED_TODO],
      isLoading: false,
      error: null,
      refetch: refetchOrphaned,
    });
    (useEventsInRange as jest.Mock).mockReturnValue({
      events: [
        {
          id: "event-9",
          title: "誕生日会",
          startAt: "2026-09-20T10:00:00.000Z",
          endAt: "2026-09-20T12:00:00.000Z",
          isAllDay: false,
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useReattachTodoToExistingEvent as jest.Mock).mockReturnValue({
      reattachTodoToExistingEvent: reattachMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("orphaned-todo-reattach-orphan-1"));
    expect(getByTestId("reattach-todo-event-event-9")).toBeTruthy();

    await fireEvent.press(getByTestId("reattach-todo-event-event-9"));

    await waitFor(() => expect(reattachMock).toHaveBeenCalledWith("orphan-1", "event-9"));
    await waitFor(() => expect(refetchOrphaned).toHaveBeenCalled());
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(queryByTestId("reattach-todo-close")).toBeNull();
  });
});
