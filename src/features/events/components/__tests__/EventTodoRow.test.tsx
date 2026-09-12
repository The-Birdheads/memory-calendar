import { fireEvent, render } from "@testing-library/react-native";

import { EventTodoRow } from "../EventTodoRow";
import type { Todo } from "../../../todos/types";

const BASE_TODO: Todo = {
  id: "todo-1",
  eventId: "event-1",
  title: "飲み物を買う",
  isDone: false,
  completedAt: null,
  reminderAt: null,
  createdBy: "user-1",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
}

const TIMED_EVENT = { isAllDay: false, eventStartAt: "2026-09-10T10:00:00.000Z" };

describe("EventTodoRow", () => {
  it("shows an inactive (gray, bell-off) reminder icon when the todo has no reminder", async () => {
    const { getByTestId } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={jest.fn()}
        onEditTitle={jest.fn()}
      />
    );

    expect(flattenStyle(getByTestId("event-todo-reminder-bell-todo-1").props.style).tintColor).toBe("#999");
  });

  it("shows an active (blue) reminder icon when the todo has a reminder set", async () => {
    const { getByTestId } = await render(
      <EventTodoRow
        todo={{ ...BASE_TODO, reminderAt: "2026-09-10T09:00:00.000Z" }}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={jest.fn()}
        onEditTitle={jest.fn()}
      />
    );

    expect(flattenStyle(getByTestId("event-todo-reminder-bell-todo-1").props.style).tintColor).toBe("#2f6fed");
  });

  it("opens the reminder picker by tapping the bell and reports the picked reminder", async () => {
    const onSetReminder = jest.fn();
    const { getByTestId } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={onSetReminder}
        onEditTitle={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("event-todo-reminder-icon-todo-1"));
    await fireEvent.press(getByTestId("event-todo-reminder-todo-1-option-before_1h"));

    expect(onSetReminder).toHaveBeenCalledWith("todo-1", "2026-09-10T09:00:00.000Z");
  });

  it("offers the all-day reminder options when the linked event is all-day", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay
        eventStartAt="2026-09-10T00:00:00.000Z"
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={jest.fn()}
        onEditTitle={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("event-todo-reminder-icon-todo-1"));

    expect(getByTestId("event-todo-reminder-todo-1-option-on_day")).toBeTruthy();
    expect(queryByTestId("event-todo-reminder-todo-1-option-before_1h")).toBeNull();
  });

  it("closes the reminder modal via its close button", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={jest.fn()}
        onEditTitle={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("event-todo-reminder-icon-todo-1"));
    await fireEvent.press(getByTestId("event-todo-reminder-close-todo-1"));

    expect(queryByTestId("event-todo-reminder-todo-1-option-before_1h")).toBeNull();
  });

  it("still toggles and deletes via the checkbox and trash icon", async () => {
    const onToggle = jest.fn();
    const onDelete = jest.fn();
    const { getByTestId } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={onToggle}
        onDelete={onDelete}
        onSetReminder={jest.fn()}
        onEditTitle={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId("event-todo-checkbox-todo-1"));
    expect(onToggle).toHaveBeenCalledWith(BASE_TODO);

    await fireEvent.press(getByTestId("event-todo-delete-todo-1"));
    expect(onDelete).toHaveBeenCalledWith("todo-1");
  });

  it("edits the title: tapping the pencil reveals a text field seeded with the current title, and ✓ confirms it", async () => {
    const onEditTitle = jest.fn();
    const { getByTestId, queryByTestId, queryByText } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={jest.fn()}
        onEditTitle={onEditTitle}
      />
    );

    expect(queryByTestId("event-todo-title-input-todo-1")).toBeNull();

    await fireEvent.press(getByTestId("event-todo-edit-todo-1"));

    expect(getByTestId("event-todo-title-input-todo-1").props.value).toBe("飲み物を買う");
    // 編集中はベル/ゴミ箱を隠し、テキスト欄+✓/✕だけを出す
    expect(queryByTestId("event-todo-reminder-icon-todo-1")).toBeNull();
    expect(queryByTestId("event-todo-delete-todo-1")).toBeNull();
    expect(queryByText("飲み物を買う")).toBeNull();

    await fireEvent.changeText(getByTestId("event-todo-title-input-todo-1"), "炭酸水を買う");
    await fireEvent.press(getByTestId("event-todo-title-confirm-todo-1"));

    expect(onEditTitle).toHaveBeenCalledWith("todo-1", "炭酸水を買う");
    expect(queryByTestId("event-todo-title-input-todo-1")).toBeNull();
  });

  it("cancels the title edit via ✕ without calling onEditTitle", async () => {
    const onEditTitle = jest.fn();
    const { getByTestId, queryByTestId, getByText } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={jest.fn()}
        onEditTitle={onEditTitle}
      />
    );

    await fireEvent.press(getByTestId("event-todo-edit-todo-1"));
    await fireEvent.changeText(getByTestId("event-todo-title-input-todo-1"), "書きかけの変更");
    await fireEvent.press(getByTestId("event-todo-title-cancel-todo-1"));

    expect(onEditTitle).not.toHaveBeenCalled();
    expect(queryByTestId("event-todo-title-input-todo-1")).toBeNull();
    expect(getByText("飲み物を買う")).toBeTruthy();
  });

  it("does not call onEditTitle when confirming an unchanged or blank title", async () => {
    const onEditTitle = jest.fn();
    const { getByTestId } = await render(
      <EventTodoRow
        todo={BASE_TODO}
        isAllDay={TIMED_EVENT.isAllDay}
        eventStartAt={TIMED_EVENT.eventStartAt}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onSetReminder={jest.fn()}
        onEditTitle={onEditTitle}
      />
    );

    await fireEvent.press(getByTestId("event-todo-edit-todo-1"));
    await fireEvent.press(getByTestId("event-todo-title-confirm-todo-1"));
    expect(onEditTitle).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId("event-todo-edit-todo-1"));
    await fireEvent.changeText(getByTestId("event-todo-title-input-todo-1"), "   ");
    await fireEvent.press(getByTestId("event-todo-title-confirm-todo-1"));
    expect(onEditTitle).not.toHaveBeenCalled();
    // 空欄は確定できず、編集モードのままであること
    expect(getByTestId("event-todo-title-input-todo-1")).toBeTruthy();
  });
});
