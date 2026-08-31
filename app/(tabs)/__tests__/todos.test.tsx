import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import TodosScreen from "../todos";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import {
  useDeleteTodo,
  useToggleDone,
  useTodosByCalendar,
  useUpdateTodo,
} from "../../../src/features/todos/hooks";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/todos/hooks", () => ({
  useTodosByCalendar: jest.fn(),
  useToggleDone: jest.fn(),
  useDeleteTodo: jest.fn(),
  useUpdateTodo: jest.fn(),
}));

const CALENDARS = [
  { id: "cal-1", name: "我が家", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
  { id: "cal-2", name: "友人グループ", createdBy: "user-2", createdAt: "2026-08-17T01:00:00.000Z" },
];

const TODOS = [
  {
    id: "todo-1",
    eventId: "event-1",
    title: "楽譜購入",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "発表会",
    eventStartAt: "2026-09-10T10:00:00.000Z",
  },
  {
    id: "todo-2",
    eventId: "event-1",
    title: "練習",
    isDone: true,
    completedAt: "2026-08-17T00:00:00.000Z",
    reminderAt: "2026-08-19T09:00:00.000Z",
    eventTitle: "発表会",
    eventStartAt: "2026-09-10T10:00:00.000Z",
  },
];

const TODOS_TWO_EVENTS = [
  ...TODOS,
  {
    id: "todo-3",
    eventId: "event-2",
    title: "花火を買う",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    eventTitle: "夏祭り",
    eventStartAt: "2026-08-01T10:00:00.000Z",
  },
];

function mockCommonHooks(todos: typeof TODOS, refetch = jest.fn()) {
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars: CALENDARS, isLoading: false, error: null });
  (useTodosByCalendar as jest.Mock).mockReturnValue({ todos, isLoading: false, error: null, refetch });
  (useToggleDone as jest.Mock).mockReturnValue({ toggleDone: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
  (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: jest.fn().mockResolvedValue(true), isSubmitting: false, error: null });
}

describe("TodosScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("groups todos into a section per linked event", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId, getByText } = await render(<TodosScreen />);

    expect(getByText("発表会")).toBeTruthy();
    expect(getByTestId("todo-item-todo-1")).toBeTruthy();
    expect(getByTestId("todo-item-todo-2")).toBeTruthy();
  });

  it("orders sections by the linked event's start time", async () => {
    mockCommonHooks(TODOS_TWO_EVENTS);

    const { getByTestId } = await render(<TodosScreen />);

    const container = getByTestId("todos-section-list");
    const sectionIds = container.props.data.map((group: { eventId: string }) => group.eventId);
    expect(sectionIds).toEqual(["event-2", "event-1"]);
  });

  it("shows a calendar switcher and updates the list when switched", async () => {
    mockCommonHooks([]);

    const { getByTestId } = await render(<TodosScreen />);

    expect(getByTestId("todos-calendar-switch-cal-1")).toBeTruthy();
    expect(getByTestId("todos-calendar-switch-cal-2")).toBeTruthy();

    await fireEvent.press(getByTestId("todos-calendar-switch-cal-2"));

    await waitFor(() => expect(useTodosByCalendar).toHaveBeenLastCalledWith("cal-2"));
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

  it("navigates to the calendar screen on the event's date when 'カレンダーへ' is pressed", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-section-calendar-event-1"));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/(tabs)/calendar",
        params: expect.objectContaining({ date: "2026-09-10", calendarId: "cal-1" }),
      })
    );
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

  it("deletes a todo and refetches so it disappears from the list", async () => {
    const refetch = jest.fn();
    mockCommonHooks(TODOS, refetch);
    const deleteTodoMock = jest.fn().mockResolvedValue(true);
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: deleteTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-delete-todo-1"));

    await waitFor(() => expect(deleteTodoMock).toHaveBeenCalledWith("todo-1"));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  function flattenStyle(style: unknown): Record<string, unknown> {
    return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
  }

  it("shows the reminder icon active with the formatted time when a reminder is set", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId, getByText, queryByTestId } = await render(<TodosScreen />);

    expect(getByText("2026/08/19 09:00")).toBeTruthy();
    const flattened = flattenStyle(getByTestId("todo-reminder-icon-todo-2").props.style);
    expect(flattened.opacity).toBeUndefined();
    expect(flattened.textDecorationLine).toBeUndefined();
    expect(queryByTestId("todo-reminder-input-todo-2")).toBeNull();
  });

  it("shows the reminder icon inactive (dimmed + struck through) when no reminder is set", async () => {
    mockCommonHooks(TODOS);

    const { getByTestId } = await render(<TodosScreen />);

    const flattened = flattenStyle(getByTestId("todo-reminder-icon-todo-1").props.style);
    expect(flattened.opacity).toBeLessThan(1);
    expect(flattened.textDecorationLine).toBe("line-through");
  });

  it("opens the reminder modal from the icon and saves a reminder date", async () => {
    const refetch = jest.fn();
    mockCommonHooks(TODOS, refetch);
    const updateTodoMock = jest.fn().mockResolvedValue(true);
    (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: updateTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-reminder-open-todo-1"));
    await fireEvent.changeText(getByTestId("todo-reminder-input-todo-1"), "2026-08-20T09:00:00.000Z");
    await fireEvent.press(getByTestId("todo-reminder-save-todo-1"));

    await waitFor(() =>
      expect(updateTodoMock).toHaveBeenCalledWith("todo-1", { reminderAt: "2026-08-20T09:00:00.000Z" })
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("closes the reminder modal without saving when cancelled", async () => {
    mockCommonHooks(TODOS);
    const updateTodoMock = jest.fn().mockResolvedValue(true);
    (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: updateTodoMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<TodosScreen />);

    await fireEvent.press(getByTestId("todo-reminder-open-todo-1"));
    await fireEvent.press(getByTestId("todo-reminder-cancel-todo-1"));

    expect(updateTodoMock).not.toHaveBeenCalled();
    expect(queryByTestId("todo-reminder-input-todo-1")).toBeNull();
  });
});
