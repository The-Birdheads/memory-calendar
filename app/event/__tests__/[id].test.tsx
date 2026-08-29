import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import EventDetailScreen from "../[id]";
import { useAuthSession } from "../../../src/features/auth/hooks";
import { useCalendarMembers } from "../../../src/features/calendars/hooks";
import {
  useAddReaction,
  useComments,
  useDeleteComment,
  usePostComment,
  useReactions,
} from "../../../src/features/communication/hooks";
import {
  useDeleteEvent,
  useEvent,
  useSetReminderTargets,
  useUpdateEvent,
} from "../../../src/features/events/hooks";
import type { Event } from "../../../src/features/events/types";
import { useAddReflection, useEventPhotos } from "../../../src/features/memories/hooks";
import {
  useAttachTagsToEvent,
  useDetachTagFromEvent,
  useEventTags,
  useTagTree,
} from "../../../src/features/tags/hooks";
import {
  useCreateTodo,
  useDeleteTodo,
  useToggleDone,
  useTodosByEvent,
} from "../../../src/features/todos/hooks";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
  Stack: { Screen: () => null },
}));

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useCalendarMembers: jest.fn(),
}));

jest.mock("../../../src/features/communication/hooks", () => ({
  useComments: jest.fn(),
  usePostComment: jest.fn(),
  useDeleteComment: jest.fn(),
  useReactions: jest.fn(),
  useAddReaction: jest.fn(),
}));

jest.mock("../../../src/features/events/hooks", () => ({
  useEvent: jest.fn(),
  useDeleteEvent: jest.fn(),
  useSetReminderTargets: jest.fn(),
  useUpdateEvent: jest.fn(),
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

jest.mock("../../../src/features/memories/hooks", () => ({
  useEventPhotos: jest.fn(),
  useAddReflection: jest.fn(),
}));

jest.mock("../../../src/features/tags/hooks", () => ({
  useEventTags: jest.fn(),
  useTagTree: jest.fn(),
  useAttachTagsToEvent: jest.fn(),
  useDetachTagFromEvent: jest.fn(),
}));

jest.mock("../../../src/features/todos/hooks", () => ({
  useTodosByEvent: jest.fn(),
  useCreateTodo: jest.fn(),
  useToggleDone: jest.fn(),
  useDeleteTodo: jest.fn(),
}));

const FUTURE_EVENT: Event = {
  id: "event-1",
  calendarId: "cal-1",
  seriesId: null,
  title: "誕生日会",
  location: null,
  memo: null,
  url: null,
  categoryColor: "#2f6fed",
  startAt: "2099-01-01T00:00:00.000Z",
  endAt: "2099-01-01T02:00:00.000Z",
  isAllDay: false,
  reminderAt: null,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const PAST_EVENT = { ...FUTURE_EVENT, startAt: "2020-01-01T00:00:00.000Z", endAt: "2020-01-01T02:00:00.000Z" };

const TAG_A = { id: "tag-a", calendarId: "cal-1", parentId: null, level: "major", name: "旅行", color: "#ff0000", createdAt: "2026-08-01T00:00:00.000Z" };
const TAG_B = { id: "tag-b", calendarId: "cal-1", parentId: null, level: "major", name: "誕生日", color: "#00ff00", createdAt: "2026-08-01T00:00:00.000Z" };

function mockCommonHooks(
  overrides: {
    event?: typeof FUTURE_EVENT | null;
    isEventLoading?: boolean;
    comments?: unknown[];
    reactions?: unknown[];
    tags?: unknown[];
    tagTree?: unknown[];
    todos?: unknown[];
    members?: { userId: string; role: string; displayName?: string | null }[];
    photos?: unknown[];
    refetchComments?: jest.Mock;
    refetchReactions?: jest.Mock;
    refetchTags?: jest.Mock;
    refetchTodos?: jest.Mock;
    refetchEvent?: jest.Mock;
  } = {}
) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: "event-1" });
  (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false });
  const refetchEvent = overrides.refetchEvent ?? jest.fn();
  (useEvent as jest.Mock).mockReturnValue({
    event: overrides.event === undefined ? FUTURE_EVENT : overrides.event,
    isLoading: overrides.isEventLoading ?? false,
    error: null,
    refetch: refetchEvent,
  });

  const refetchComments = overrides.refetchComments ?? jest.fn();
  (useComments as jest.Mock).mockReturnValue({
    comments: overrides.comments ?? [],
    isLoading: false,
    error: null,
    refetch: refetchComments,
  });
  (usePostComment as jest.Mock).mockReturnValue({
    postComment: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useDeleteComment as jest.Mock).mockReturnValue({
    deleteComment: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  const refetchReactions = overrides.refetchReactions ?? jest.fn();
  (useReactions as jest.Mock).mockReturnValue({
    reactions: overrides.reactions ?? [],
    isLoading: false,
    error: null,
    refetch: refetchReactions,
  });
  (useAddReaction as jest.Mock).mockReturnValue({
    addReaction: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  (useDeleteEvent as jest.Mock).mockReturnValue({
    deleteEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useSetReminderTargets as jest.Mock).mockReturnValue({
    setReminderTargets: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateEvent as jest.Mock).mockReturnValue({
    updateEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  (useEventPhotos as jest.Mock).mockReturnValue({
    photos: overrides.photos ?? [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useAddReflection as jest.Mock).mockReturnValue({
    addReflection: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  const refetchTags = overrides.refetchTags ?? jest.fn();
  (useEventTags as jest.Mock).mockReturnValue({
    tags: overrides.tags ?? [],
    isLoading: false,
    error: null,
    refetch: refetchTags,
  });
  (useTagTree as jest.Mock).mockReturnValue({
    tagTree: overrides.tagTree ?? [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useAttachTagsToEvent as jest.Mock).mockReturnValue({
    attachTagsToEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useDetachTagFromEvent as jest.Mock).mockReturnValue({
    detachTagFromEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  const refetchTodos = overrides.refetchTodos ?? jest.fn();
  (useTodosByEvent as jest.Mock).mockReturnValue({
    todos: overrides.todos ?? [],
    isLoading: false,
    error: null,
    refetch: refetchTodos,
  });
  (useCreateTodo as jest.Mock).mockReturnValue({
    createTodo: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useToggleDone as jest.Mock).mockReturnValue({
    toggleDone: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useDeleteTodo as jest.Mock).mockReturnValue({
    deleteTodo: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  (useCalendarMembers as jest.Mock).mockReturnValue({
    members: overrides.members ?? [{ userId: "user-1", role: "owner" }, { userId: "user-2", role: "member" }],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });

  return { refetchComments, refetchReactions, refetchTags, refetchTodos, refetchEvent };
}

describe("EventDetailScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading state while the event is loading", async () => {
    mockCommonHooks({ isEventLoading: true, event: null });

    const { getByText } = await render(<EventDetailScreen />);

    expect(getByText("読み込み中...")).toBeTruthy();
  });

  it("shows the event title once loaded", async () => {
    mockCommonHooks();

    const { getByText } = await render(<EventDetailScreen />);

    expect(getByText("誕生日会")).toBeTruthy();
  });

  it("posts a comment and refetches the comment list", async () => {
    const { refetchComments } = mockCommonHooks();
    const postCommentMock = jest.fn().mockResolvedValue(true);
    (usePostComment as jest.Mock).mockReturnValue({ postComment: postCommentMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.changeText(getByTestId("event-comment-input"), "楽しみ！");
    await fireEvent.press(getByTestId("event-comment-submit"));

    await waitFor(() => expect(postCommentMock).toHaveBeenCalledWith("event-1", "楽しみ！"));
    await waitFor(() => expect(refetchComments).toHaveBeenCalled());
  });

  it("deletes own comment and refetches", async () => {
    const { refetchComments } = mockCommonHooks({
      comments: [{ id: "comment-1", eventId: "event-1", userId: "user-1", body: "hi", createdAt: "2026-08-01T00:00:00.000Z" }],
    });
    const deleteCommentMock = jest.fn().mockResolvedValue(true);
    (useDeleteComment as jest.Mock).mockReturnValue({ deleteComment: deleteCommentMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-comment-delete-comment-1"));

    await waitFor(() => expect(deleteCommentMock).toHaveBeenCalledWith("comment-1"));
    await waitFor(() => expect(refetchComments).toHaveBeenCalled());
  });

  it("adds a reaction and refetches", async () => {
    const { refetchReactions } = mockCommonHooks();
    const addReactionMock = jest.fn().mockResolvedValue(true);
    (useAddReaction as jest.Mock).mockReturnValue({ addReaction: addReactionMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-reaction-add-👍"));

    await waitFor(() => expect(addReactionMock).toHaveBeenCalledWith("event-1", "👍"));
    await waitFor(() => expect(refetchReactions).toHaveBeenCalled());
  });

  it("shows attached tag badges", async () => {
    mockCommonHooks({ tags: [TAG_A] });

    const { getByTestId } = await render(<EventDetailScreen />);

    expect(getByTestId("event-tag-badge-tag-a")).toBeTruthy();
  });

  it("shows a message when no tags are attached yet", async () => {
    mockCommonHooks({ tags: [] });

    const { getByText, queryByTestId } = await render(<EventDetailScreen />);

    expect(getByText("タグはまだありません（編集から追加できます）")).toBeTruthy();
    expect(queryByTestId("event-tag-badge-tag-a")).toBeNull();
  });

  it("pre-selects the event's current tags in the edit modal's tag picker", async () => {
    mockCommonHooks({
      tags: [TAG_A],
      tagTree: [{ ...TAG_A, children: [] }, { ...TAG_B, children: [] }],
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));

    expect(getByTestId("event-edit-tag-tag-a")).toBeTruthy();
    expect(getByTestId("event-edit-tag-tag-b")).toBeTruthy();
  });

  it("adds and removes tags via the edit modal and refetches on save", async () => {
    const { refetchTags } = mockCommonHooks({
      tags: [TAG_A],
      tagTree: [{ ...TAG_A, children: [] }, { ...TAG_B, children: [] }],
    });
    const attachTagsToEventMock = jest.fn().mockResolvedValue(true);
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: attachTagsToEventMock,
      isSubmitting: false,
      error: null,
    });
    const detachTagFromEventMock = jest.fn().mockResolvedValue(true);
    (useDetachTagFromEvent as jest.Mock).mockReturnValue({
      detachTagFromEvent: detachTagFromEventMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));
    // tag-a is already attached; toggling it off should detach it on save.
    await fireEvent.press(getByTestId("event-edit-tag-tag-a"));
    // tag-b is not attached yet; toggling it on should attach it on save.
    await fireEvent.press(getByTestId("event-edit-tag-tag-b"));
    await fireEvent.press(getByTestId("event-edit-submit"));

    await waitFor(() => expect(attachTagsToEventMock).toHaveBeenCalledWith("event-1", ["tag-b"]));
    await waitFor(() => expect(detachTagFromEventMock).toHaveBeenCalledWith("event-1", "tag-a"));
    await waitFor(() => expect(refetchTags).toHaveBeenCalled());
  });

  it("does not touch tags on save when the selection is unchanged", async () => {
    const { refetchEvent } = mockCommonHooks({
      tags: [TAG_A],
      tagTree: [{ ...TAG_A, children: [] }],
    });
    const attachTagsToEventMock = jest.fn().mockResolvedValue(true);
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: attachTagsToEventMock,
      isSubmitting: false,
      error: null,
    });
    const detachTagFromEventMock = jest.fn().mockResolvedValue(true);
    (useDetachTagFromEvent as jest.Mock).mockReturnValue({
      detachTagFromEvent: detachTagFromEventMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));
    await fireEvent.press(getByTestId("event-edit-submit"));

    await waitFor(() => expect(refetchEvent).toHaveBeenCalled());
    expect(attachTagsToEventMock).not.toHaveBeenCalled();
    expect(detachTagFromEventMock).not.toHaveBeenCalled();
  });

  it("adds a todo scoped to the event and refetches", async () => {
    const { refetchTodos } = mockCommonHooks();
    const createTodoMock = jest.fn().mockResolvedValue(true);
    (useCreateTodo as jest.Mock).mockReturnValue({ createTodo: createTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.changeText(getByTestId("event-todo-input"), "飲み物を買う");
    await fireEvent.press(getByTestId("event-todo-add"));

    await waitFor(() => expect(createTodoMock).toHaveBeenCalledWith({ eventId: "event-1", title: "飲み物を買う" }));
    await waitFor(() => expect(refetchTodos).toHaveBeenCalled());
  });

  it("toggles a todo and refetches", async () => {
    const { refetchTodos } = mockCommonHooks({
      todos: [{ id: "todo-1", eventId: "event-1", title: "飲み物を買う", isDone: false, completedAt: null, reminderAt: null }],
    });
    const toggleDoneMock = jest.fn().mockResolvedValue(true);
    (useToggleDone as jest.Mock).mockReturnValue({ toggleDone: toggleDoneMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-todo-checkbox-todo-1"));

    await waitFor(() => expect(toggleDoneMock).toHaveBeenCalledWith("todo-1", true));
    await waitFor(() => expect(refetchTodos).toHaveBeenCalled());
  });

  it("deletes a todo and refetches", async () => {
    const { refetchTodos } = mockCommonHooks({
      todos: [{ id: "todo-1", eventId: "event-1", title: "飲み物を買う", isDone: false, completedAt: null, reminderAt: null }],
    });
    const deleteTodoMock = jest.fn().mockResolvedValue(true);
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: deleteTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-todo-delete-todo-1"));

    await waitFor(() => expect(deleteTodoMock).toHaveBeenCalledWith("todo-1"));
    await waitFor(() => expect(refetchTodos).toHaveBeenCalled());
  });

  it("selects a reminder target member and saves", async () => {
    mockCommonHooks({ members: [{ userId: "user-1", role: "owner" }, { userId: "user-2", role: "member" }] });
    const setReminderTargetsMock = jest.fn().mockResolvedValue(true);
    (useSetReminderTargets as jest.Mock).mockReturnValue({
      setReminderTargets: setReminderTargetsMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("reminder-target-member-user-2"));
    await fireEvent.press(getByTestId("event-reminder-targets-save"));

    await waitFor(() => expect(setReminderTargetsMock).toHaveBeenCalledWith("event-1", ["user-2"]));
  });

  it("does not show the memory section for a future event", async () => {
    mockCommonHooks({ event: FUTURE_EVENT });

    const { queryByTestId } = await render(<EventDetailScreen />);

    expect(queryByTestId("event-reflection-input")).toBeNull();
  });

  it("shows the memory section and adds a reflection for a past event", async () => {
    const { refetchComments } = mockCommonHooks({ event: PAST_EVENT });
    const addReflectionMock = jest.fn().mockResolvedValue(true);
    (useAddReflection as jest.Mock).mockReturnValue({
      addReflection: addReflectionMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.changeText(getByTestId("event-reflection-input"), "楽しかった");
    await fireEvent.press(getByTestId("event-reflection-submit"));

    await waitFor(() => expect(addReflectionMock).toHaveBeenCalledWith("event-1", "楽しかった"));
    await waitFor(() => expect(refetchComments).toHaveBeenCalled());
  });

  it("opens the delete confirmation modal and deletes the event on confirm", async () => {
    mockCommonHooks();
    const deleteEventMock = jest.fn().mockResolvedValue(true);
    (useDeleteEvent as jest.Mock).mockReturnValue({ deleteEvent: deleteEventMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-delete-button"));
    await fireEvent.press(getByTestId("delete-event-confirm-button"));

    await waitFor(() => expect(deleteEventMock).toHaveBeenCalledWith("event-1"));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it("cancels the delete confirmation without deleting", async () => {
    mockCommonHooks();
    const deleteEventMock = jest.fn().mockResolvedValue(true);
    (useDeleteEvent as jest.Mock).mockReturnValue({ deleteEvent: deleteEventMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-delete-button"));
    await fireEvent.press(getByTestId("delete-event-cancel-button"));

    expect(deleteEventMock).not.toHaveBeenCalled();
    expect(queryByTestId("delete-event-confirm-button")).toBeNull();
  });

  it("shows the event location and url when present", async () => {
    mockCommonHooks({ event: { ...FUTURE_EVENT, location: "渋谷", url: "https://example.com" } });

    const { getByText } = await render(<EventDetailScreen />);

    expect(getByText(/渋谷/)).toBeTruthy();
    expect(getByText(/https:\/\/example\.com/)).toBeTruthy();
  });

  it("opens the edit modal pre-filled with the current event values and submits the update", async () => {
    const { refetchEvent } = mockCommonHooks({
      event: { ...FUTURE_EVENT, location: "渋谷", url: "https://example.com" },
    });
    const updateEventMock = jest.fn().mockResolvedValue(true);
    (useUpdateEvent as jest.Mock).mockReturnValue({ updateEvent: updateEventMock, isSubmitting: false, error: null });

    const { getByTestId, getByDisplayValue } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));

    expect(getByDisplayValue("誕生日会")).toBeTruthy();
    expect(getByDisplayValue("渋谷")).toBeTruthy();
    expect(getByDisplayValue("https://example.com")).toBeTruthy();

    await fireEvent.changeText(getByTestId("event-edit-title-input"), "誕生日会2");
    await fireEvent.press(getByTestId("event-edit-submit"));

    await waitFor(() =>
      expect(updateEventMock).toHaveBeenCalledWith(
        "event-1",
        expect.objectContaining({
          title: "誕生日会2",
          location: "渋谷",
          url: "https://example.com",
          isAllDay: false,
          categoryColor: "#2f6fed",
        })
      )
    );
    await waitFor(() => expect(refetchEvent).toHaveBeenCalled());
  });

  it("closes the edit modal without saving when cancelled", async () => {
    mockCommonHooks();
    const updateEventMock = jest.fn().mockResolvedValue(true);
    (useUpdateEvent as jest.Mock).mockReturnValue({ updateEvent: updateEventMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));
    expect(getByTestId("event-edit-cancel")).toBeTruthy();

    await fireEvent.press(getByTestId("event-edit-cancel"));

    expect(updateEventMock).not.toHaveBeenCalled();
    expect(queryByTestId("event-edit-title-input")).toBeNull();
  });

  it("shows the commenter's display name instead of their raw user id", async () => {
    mockCommonHooks({
      comments: [{ id: "comment-1", eventId: "event-1", userId: "user-2", body: "hi", createdAt: "2026-08-01T00:00:00.000Z" }],
      members: [
        { userId: "user-1", role: "owner", displayName: "たろう" },
        { userId: "user-2", role: "member", displayName: "はなこ" },
      ],
    });

    const { getByTestId, queryByText } = await render(<EventDetailScreen />);

    expect(within(getByTestId("event-comment-comment-1")).getByText("はなこ")).toBeTruthy();
    expect(queryByText("user-2")).toBeNull();
  });

  it("shows reminder target members' display names instead of their raw user ids", async () => {
    mockCommonHooks({
      members: [
        { userId: "user-1", role: "owner", displayName: "たろう" },
        { userId: "user-2", role: "member", displayName: "はなこ" },
      ],
    });

    const { getByText, queryByText } = await render(<EventDetailScreen />);

    expect(getByText("はなこ")).toBeTruthy();
    expect(queryByText("user-2")).toBeNull();
  });
});
