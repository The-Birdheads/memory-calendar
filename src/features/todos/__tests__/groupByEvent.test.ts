import { countIncomplete, groupTodosByEvent } from "../groupByEvent";
import type { TodoWithEventTitle } from "../types";

function makeTodo(overrides: Partial<TodoWithEventTitle>): TodoWithEventTitle {
  return {
    id: "todo-x",
    eventId: "event-x",
    eventCalendarId: "cal-1",
    title: "todo",
    isDone: false,
    completedAt: null,
    reminderAt: null,
    createdBy: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    eventTitle: "event",
    eventStartAt: "2026-08-01T00:00:00.000Z",
    eventEndAt: "2026-08-01T00:00:00.000Z",
    eventIsAllDay: false,
    ...overrides,
  };
}

describe("groupTodosByEvent", () => {
  it("groups todos that share the same event", () => {
    const todos = [
      makeTodo({ id: "todo-1", eventId: "event-1", eventCalendarId: "cal-2", title: "楽譜購入", eventTitle: "発表会", eventStartAt: "2026-09-01T10:00:00.000Z" }),
      makeTodo({ id: "todo-2", eventId: "event-1", eventCalendarId: "cal-2", title: "練習", eventTitle: "発表会", eventStartAt: "2026-09-01T10:00:00.000Z" }),
    ];

    const groups = groupTodosByEvent(todos);

    expect(groups).toHaveLength(1);
    expect(groups[0].eventId).toBe("event-1");
    expect(groups[0].eventCalendarId).toBe("cal-2");
    expect(groups[0].todos.map((t) => t.id)).toEqual(["todo-1", "todo-2"]);
  });

  it("orders groups by the linked event's start time, not by todo order", () => {
    const todos = [
      makeTodo({ id: "todo-1", eventId: "event-late", eventTitle: "夏祭り", eventStartAt: "2026-08-20T10:00:00.000Z" }),
      makeTodo({ id: "todo-2", eventId: "event-early", eventTitle: "誕生日会", eventStartAt: "2026-08-05T10:00:00.000Z" }),
    ];

    const groups = groupTodosByEvent(todos);

    expect(groups.map((g) => g.eventId)).toEqual(["event-early", "event-late"]);
  });

  it("keeps each todo's original relative order within its group", () => {
    const todos = [
      makeTodo({ id: "todo-b", eventId: "event-1", eventStartAt: "2026-08-01T00:00:00.000Z" }),
      makeTodo({ id: "todo-a", eventId: "event-1", eventStartAt: "2026-08-01T00:00:00.000Z" }),
    ];

    const groups = groupTodosByEvent(todos);

    expect(groups[0].todos.map((t) => t.id)).toEqual(["todo-b", "todo-a"]);
  });

  it("returns an empty array for no todos", () => {
    expect(groupTodosByEvent([])).toEqual([]);
  });
});

describe("countIncomplete", () => {
  it("counts only the todos that aren't done yet", () => {
    const group = groupTodosByEvent([
      makeTodo({ id: "todo-1", eventId: "event-1", isDone: false }),
      makeTodo({ id: "todo-2", eventId: "event-1", isDone: true }),
      makeTodo({ id: "todo-3", eventId: "event-1", isDone: false }),
    ])[0];

    expect(countIncomplete(group)).toBe(2);
  });

  it("returns 0 when every todo in the group is done", () => {
    const group = groupTodosByEvent([
      makeTodo({ id: "todo-1", eventId: "event-1", isDone: true }),
    ])[0];

    expect(countIncomplete(group)).toBe(0);
  });
});
