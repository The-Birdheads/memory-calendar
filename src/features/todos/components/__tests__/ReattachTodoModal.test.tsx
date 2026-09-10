import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ReattachTodoModal } from "../ReattachTodoModal";
import { useEventsInRange } from "../../../events/hooks";
import { useReattachTodoToExistingEvent, useReattachTodoToNewPersonalEvent } from "../../hooks";
import type { Todo } from "../../types";

jest.mock("../../../events/hooks", () => ({
  useEventsInRange: jest.fn(),
}));

jest.mock("../../hooks", () => ({
  useReattachTodoToExistingEvent: jest.fn(),
  useReattachTodoToNewPersonalEvent: jest.fn(),
}));

const TODO: Todo = {
  id: "todo-1",
  eventId: null,
  title: "宛名を書く",
  isDone: false,
  completedAt: null,
  reminderAt: null,
  createdBy: "user-1",
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

const CALENDARS = [
  { id: "cal-1", name: "我が家" },
  { id: "cal-2", name: "友人グループ" },
];

const EVENTS = [
  {
    id: "event-1",
    calendarId: "cal-1",
    seriesId: null,
    title: "誕生日会",
    location: null,
    memo: null,
    url: null,
    categoryColor: null,
    startAt: "2026-09-20T10:00:00.000Z",
    endAt: "2026-09-20T12:00:00.000Z",
    isAllDay: false,
    reminderAt: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    tagColor: null,
  },
];

function mockHooks(overrides: { events?: typeof EVENTS } = {}) {
  (useEventsInRange as jest.Mock).mockReturnValue({
    events: overrides.events ?? EVENTS,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  const reattachToExisting = jest.fn().mockResolvedValue(true);
  const reattachToNew = jest.fn().mockResolvedValue(true);
  (useReattachTodoToExistingEvent as jest.Mock).mockReturnValue({
    reattachTodoToExistingEvent: reattachToExisting,
    isSubmitting: false,
    error: null,
  });
  (useReattachTodoToNewPersonalEvent as jest.Mock).mockReturnValue({
    reattachTodoToNewPersonalEvent: reattachToNew,
    isSubmitting: false,
    error: null,
  });
  return { reattachToExisting, reattachToNew };
}

describe("ReattachTodoModal", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows the todo's title and the events of the initially selected calendar", async () => {
    mockHooks();

    const { getByText } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={jest.fn()} onReattached={jest.fn()} />
    );

    expect(getByText("「宛名を書く」を予定に紐付ける")).toBeTruthy();
    expect(getByText("誕生日会")).toBeTruthy();
    expect(useEventsInRange).toHaveBeenLastCalledWith("cal-1", expect.any(Object));
  });

  it("reloads the event list for the newly selected calendar when switched", async () => {
    mockHooks();

    const { getByTestId } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={jest.fn()} onReattached={jest.fn()} />
    );

    await fireEvent.press(getByTestId("reattach-todo-calendar-cal-2"));

    expect(useEventsInRange).toHaveBeenLastCalledWith("cal-2", expect.any(Object));
  });

  it("reattaches the todo to the selected existing event", async () => {
    const { reattachToExisting } = mockHooks();
    const onReattached = jest.fn();

    const { getByTestId } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={jest.fn()} onReattached={onReattached} />
    );

    await fireEvent.press(getByTestId("reattach-todo-event-event-1"));

    await waitFor(() => expect(reattachToExisting).toHaveBeenCalledWith("todo-1", "event-1"));
    await waitFor(() => expect(onReattached).toHaveBeenCalled());
  });

  it("shows an empty message when the selected calendar has no events", async () => {
    mockHooks({ events: [] });

    const { getByText } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={jest.fn()} onReattached={jest.fn()} />
    );

    expect(getByText("このカレンダーには予定がありません")).toBeTruthy();
  });

  it("creates a new personal event and reattaches the todo, pre-filled with the todo's own title", async () => {
    const { reattachToNew } = mockHooks();
    const onReattached = jest.fn();

    const { getByTestId } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={jest.fn()} onReattached={onReattached} />
    );

    await fireEvent.press(getByTestId("reattach-todo-mode-new"));
    expect(getByTestId("reattach-todo-new-title-input").props.value).toBe("宛名を書く");

    await fireEvent.changeText(getByTestId("reattach-todo-new-date-input"), "2026-10-05");
    await fireEvent.press(getByTestId("reattach-todo-new-submit"));

    await waitFor(() =>
      expect(reattachToNew).toHaveBeenCalledWith("todo-1", { title: "宛名を書く", date: "2026-10-05" })
    );
    await waitFor(() => expect(onReattached).toHaveBeenCalled());
  });

  it("does not submit the new-event form when no date has been entered", async () => {
    const { reattachToNew } = mockHooks();

    const { getByTestId } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={jest.fn()} onReattached={jest.fn()} />
    );

    await fireEvent.press(getByTestId("reattach-todo-mode-new"));
    await fireEvent.press(getByTestId("reattach-todo-new-submit"));

    expect(reattachToNew).not.toHaveBeenCalled();
  });

  it("calls onClose when the close button is pressed", async () => {
    mockHooks();
    const onClose = jest.fn();

    const { getByTestId } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={onClose} onReattached={jest.fn()} />
    );

    await fireEvent.press(getByTestId("reattach-todo-close"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when tapping outside the card, on the backdrop", async () => {
    mockHooks();
    const onClose = jest.fn();

    const { getByTestId } = await render(
      <ReattachTodoModal todo={TODO} calendars={CALENDARS} onClose={onClose} onReattached={jest.fn()} />
    );

    await fireEvent.press(getByTestId("reattach-todo-backdrop"));

    expect(onClose).toHaveBeenCalled();
  });
});
