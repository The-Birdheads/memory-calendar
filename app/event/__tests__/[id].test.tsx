import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import EventDetailScreen from "../[id]";
import { useAuthSession } from "../../../src/features/auth/hooks";
import { useCalendarMembers, useMyCalendars } from "../../../src/features/calendars/hooks";
import { useComments, useDeleteComment, usePostComment } from "../../../src/features/communication/hooks";
import {
  useAddEventReminder,
  useDeleteEvent,
  useEvent,
  useEventReminders,
  useRemoveEventReminder,
  useUpdateEvent,
} from "../../../src/features/events/hooks";
import type { Event } from "../../../src/features/events/types";
import {
  useAttachPhoto,
  useDetachPhoto,
  useEventPhotos,
  useSetPhotoThumbnail,
} from "../../../src/features/memories/hooks";
import { pickPhotoFromLibrary } from "../../../src/features/memories/imagePicker";
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
  useUpdateTodo,
} from "../../../src/features/todos/hooks";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useCalendarMembers: jest.fn(),
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/communication/hooks", () => ({
  useComments: jest.fn(),
  usePostComment: jest.fn(),
  useDeleteComment: jest.fn(),
}));

jest.mock("../../../src/features/events/hooks", () => ({
  useEvent: jest.fn(),
  useDeleteEvent: jest.fn(),
  useEventReminders: jest.fn(),
  useAddEventReminder: jest.fn(),
  useRemoveEventReminder: jest.fn(),
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

jest.mock("../../../src/features/memories/imagePicker", () => ({
  pickPhotoFromLibrary: jest.fn(),
}));

jest.mock("../../../src/features/memories/hooks", () => ({
  useEventPhotos: jest.fn(),
  useAttachPhoto: jest.fn(),
  useDetachPhoto: jest.fn(),
  useSetPhotoThumbnail: jest.fn(),
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
  useUpdateTodo: jest.fn(),
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
    tags?: unknown[];
    tagTree?: unknown[];
    todos?: unknown[];
    members?: { userId: string; role: string; displayName?: string | null }[];
    photos?: unknown[];
    reminders?: unknown[];
    refetchComments?: jest.Mock;
    refetchTags?: jest.Mock;
    refetchPhotos?: jest.Mock;
    refetchTodos?: jest.Mock;
    refetchEvent?: jest.Mock;
    refetchReminders?: jest.Mock;
    calendarKind?: "personal" | "group";
    calendars?: { id: string; name: string; kind: "personal" | "group"; color?: string }[];
  } = {}
) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: "event-1" });
  (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false });
  (useMyCalendars as jest.Mock).mockReturnValue({
    calendars: (
      overrides.calendars ?? [{ id: "cal-1", name: "我が家", kind: overrides.calendarKind ?? "group" }]
    ).map((calendar) => ({
      createdBy: "user-1",
      createdAt: "2026-08-01T00:00:00.000Z",
      color: "#2f6fed",
      ...calendar,
    })),
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
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

  (useDeleteEvent as jest.Mock).mockReturnValue({
    deleteEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  const refetchReminders = overrides.refetchReminders ?? jest.fn();
  (useEventReminders as jest.Mock).mockReturnValue({
    reminders: overrides.reminders ?? [],
    isLoading: false,
    error: null,
    refetch: refetchReminders,
  });
  (useAddEventReminder as jest.Mock).mockReturnValue({
    addEventReminder: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useRemoveEventReminder as jest.Mock).mockReturnValue({
    removeEventReminder: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useUpdateEvent as jest.Mock).mockReturnValue({
    updateEvent: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  const refetchPhotos = overrides.refetchPhotos ?? jest.fn();
  (useEventPhotos as jest.Mock).mockReturnValue({
    photos: overrides.photos ?? [],
    isLoading: false,
    error: null,
    refetch: refetchPhotos,
  });
  (useAttachPhoto as jest.Mock).mockReturnValue({
    attachPhoto: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useDetachPhoto as jest.Mock).mockReturnValue({
    detachPhoto: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useSetPhotoThumbnail as jest.Mock).mockReturnValue({
    setPhotoThumbnail: jest.fn().mockResolvedValue(true),
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
  (useUpdateTodo as jest.Mock).mockReturnValue({
    updateTodo: jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });

  (useCalendarMembers as jest.Mock).mockReturnValue({
    members: overrides.members ?? [{ userId: "user-1", role: "owner" }, { userId: "user-2", role: "member" }],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });

  return {
    refetchComments,
    refetchTags,
    refetchTodos,
    refetchEvent,
    refetchReminders,
    refetchPhotos,
  };
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

  it("navigates back when the header back button is pressed", async () => {
    mockCommonHooks();

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-detail-back"));

    expect(router.back).toHaveBeenCalled();
  });

  it("does not show a go-to-calendar button on this route (it's already the calendar's own detail view)", async () => {
    mockCommonHooks();

    const { queryByTestId } = await render(<EventDetailScreen />);

    expect(queryByTestId("event-detail-go-to-calendar")).toBeNull();
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

  it("shows no stamp/reaction UI at all, regardless of calendar kind (the feature was removed - comments only)", async () => {
    mockCommonHooks({ calendarKind: "group" });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    expect(getByTestId("event-comments-card")).toBeTruthy();
    expect(getByTestId("event-comment-input")).toBeTruthy();
    expect(queryByTestId("event-stamp-toggle")).toBeNull();
    expect(queryByTestId(/event-reaction/)).toBeNull();
  });

  it("shows a shared-group label for a group calendar's event, and a personal-only badge to distinguish the two groups", async () => {
    mockCommonHooks({ calendarKind: "group" });

    const { getByText, getByTestId } = await render(<EventDetailScreen />);

    expect(getByText("メンバーと共有")).toBeTruthy();
    expect(getByTestId("event-personal-group-label")).toBeTruthy();
    expect(getByText("個人用")).toBeTruthy();
  });

  it("hides the shared-group label for a personal calendar's event (there's no one to share with), but still shows comments", async () => {
    mockCommonHooks({ calendarKind: "personal" });

    const { queryByTestId, queryByText, getByTestId } = await render(<EventDetailScreen />);

    expect(queryByText("メンバーと共有")).toBeNull();
    expect(queryByTestId("event-shared-group-label")).toBeNull();
    expect(getByTestId("event-comments-card")).toBeTruthy();
  });

  it("orders sections タグ→ToDo→思い出→コメント (personal-only group before the shared group)", async () => {
    // Uses a past event so the 思い出(memories) section - hidden for future
    // events - actually renders, letting this test check its position too.
    mockCommonHooks({ calendarKind: "group", event: PAST_EVENT });

    const { toJSON } = await render(<EventDetailScreen />);

    const tree = JSON.stringify(toJSON());
    const personalLabelIndex = tree.indexOf("event-personal-group-label");
    const tagsEditButtonIndex = tree.indexOf("event-tags-edit-button");
    const todoInputIndex = tree.indexOf("event-todo-input");
    const sharedLabelIndex = tree.indexOf("event-shared-group-label");
    const memoriesIndex = tree.indexOf("思い出");
    const commentsIndex = tree.indexOf("event-comments-card");

    expect(personalLabelIndex).toBeGreaterThan(-1);
    expect(sharedLabelIndex).toBeGreaterThan(-1);
    // 個人用の枠(タグ→ToDo)がまず来て...
    expect(personalLabelIndex).toBeLessThan(tagsEditButtonIndex);
    expect(tagsEditButtonIndex).toBeLessThan(todoInputIndex);
    // ...続けて共有の枠(思い出→コメント)が来る。
    expect(todoInputIndex).toBeLessThan(sharedLabelIndex);
    expect(sharedLabelIndex).toBeLessThan(memoriesIndex);
    expect(memoriesIndex).toBeLessThan(commentsIndex);
  });

  it("wraps the shared (comments/memories) and personal (reminder/tags/todo) sections in two visually distinct, differently colored frames", async () => {
    mockCommonHooks({ calendarKind: "group" });

    const { getByTestId } = await render(<EventDetailScreen />);

    const flattenStyle = (style: unknown) =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

    const sharedFrameStyle = flattenStyle(getByTestId("event-shared-frame").props.style);
    const personalFrameStyle = flattenStyle(getByTestId("event-personal-frame").props.style);

    // Both frames are bordered...
    expect(sharedFrameStyle.borderWidth).toBeGreaterThan(0);
    expect(personalFrameStyle.borderWidth).toBeGreaterThan(0);
    // ...and colored differently from each other, so which is which is obvious at a glance.
    expect(sharedFrameStyle.backgroundColor).not.toBe(personalFrameStyle.backgroundColor);

    // Both the comment card and the ToDo section live inside their respective frame.
    expect(within(getByTestId("event-shared-frame")).getByTestId("event-comments-card")).toBeTruthy();
    expect(within(getByTestId("event-personal-frame")).getByTestId("event-todo-input")).toBeTruthy();
  });

  it("puts every section in the single personal-colored frame for a personal calendar's event (no shared/personal split, since there's no one to share with)", async () => {
    mockCommonHooks({ calendarKind: "personal" });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    // No separate blue "shared" frame - a personal calendar has nothing to
    // distinguish "shared" from "personal-only" (there's no one else on it).
    expect(queryByTestId("event-shared-frame")).toBeNull();
    // Everything - including comments/memories, which DO get their own blue
    // frame on a group calendar - lives inside the one gray personal frame.
    const personalFrame = getByTestId("event-personal-frame");
    expect(within(personalFrame).getByTestId("event-comments-card")).toBeTruthy();
    expect(within(personalFrame).getByTestId("event-todo-input")).toBeTruthy();
    // The "個人用" badge only makes sense as a contrast against a shared
    // section, which doesn't exist here - it's dropped too.
    expect(queryByTestId("event-personal-group-label")).toBeNull();
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

  it("does not show the tag picker or the edit modal's tag picker before entering tag edit mode", async () => {
    mockCommonHooks({
      tags: [TAG_A],
      tagTree: [{ ...TAG_A, children: [] }, { ...TAG_B, children: [] }],
    });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    expect(getByTestId("event-tags-edit-button")).toBeTruthy();
    expect(queryByTestId("event-tags-tag-tag-a")).toBeNull();

    // The event edit modal only covers the shared fields now (title, all-day,
    // dates, location, url, color) - tags are edited from their own section.
    await fireEvent.press(getByTestId("event-edit-button"));
    expect(queryByTestId("event-edit-tag-tag-a")).toBeNull();
  });

  it("pre-selects the event's current tags when entering tag edit mode", async () => {
    mockCommonHooks({
      tags: [TAG_A],
      tagTree: [{ ...TAG_A, children: [] }, { ...TAG_B, children: [] }],
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-tags-edit-button"));

    expect(getByTestId("event-tags-tag-tag-a")).toBeTruthy();
    expect(getByTestId("event-tags-tag-tag-b")).toBeTruthy();
  });

  it("adds and removes tags via tag edit mode and refetches when confirmed, then returns to showing the edit button", async () => {
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

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-tags-edit-button"));
    // tag-a is already attached; toggling it off should detach it on confirm.
    await fireEvent.press(getByTestId("event-tags-tag-tag-a"));
    // tag-b is not attached yet; toggling it on should attach it on confirm.
    await fireEvent.press(getByTestId("event-tags-tag-tag-b"));
    await fireEvent.press(getByTestId("event-tags-confirm-button"));

    await waitFor(() => expect(attachTagsToEventMock).toHaveBeenCalledWith("event-1", ["tag-b"]));
    await waitFor(() => expect(detachTagFromEventMock).toHaveBeenCalledWith("event-1", "tag-a"));
    await waitFor(() => expect(refetchTags).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId("event-tags-edit-button")).toBeTruthy());
    expect(queryByTestId("event-tags-confirm-button")).toBeNull();
  });

  it("does not attach or detach tags when confirming with the selection unchanged", async () => {
    mockCommonHooks({
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

    await fireEvent.press(getByTestId("event-tags-edit-button"));
    await fireEvent.press(getByTestId("event-tags-confirm-button"));

    expect(attachTagsToEventMock).not.toHaveBeenCalled();
    expect(detachTagFromEventMock).not.toHaveBeenCalled();
  });

  it("discards the selection and shows the original tags again when the cancel (X) button is pressed", async () => {
    mockCommonHooks({
      tags: [TAG_A],
      tagTree: [{ ...TAG_A, children: [] }, { ...TAG_B, children: [] }],
    });
    const attachTagsToEventMock = jest.fn().mockResolvedValue(true);
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: attachTagsToEventMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-tags-edit-button"));
    await fireEvent.press(getByTestId("event-tags-tag-tag-b"));
    await fireEvent.press(getByTestId("event-tags-cancel-button"));

    expect(attachTagsToEventMock).not.toHaveBeenCalled();
    expect(getByTestId("event-tags-edit-button")).toBeTruthy();
    expect(queryByTestId("event-tags-tag-tag-b")).toBeNull();
    expect(getByTestId("event-tag-badge-tag-a")).toBeTruthy();
  });

  it("saves the tag selection on unmount (screen navigated away) while still in tag edit mode", async () => {
    mockCommonHooks({
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

    const { getByTestId, unmount } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-tags-edit-button"));
    await fireEvent.press(getByTestId("event-tags-tag-tag-a"));
    await fireEvent.press(getByTestId("event-tags-tag-tag-b"));

    unmount();

    await waitFor(() => expect(attachTagsToEventMock).toHaveBeenCalledWith("event-1", ["tag-b"]));
    await waitFor(() => expect(detachTagFromEventMock).toHaveBeenCalledWith("event-1", "tag-a"));
  });

  it("does not save anything on unmount when tag edit mode was never entered", async () => {
    mockCommonHooks({ tags: [TAG_A], tagTree: [{ ...TAG_A, children: [] }] });
    const attachTagsToEventMock = jest.fn().mockResolvedValue(true);
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({
      attachTagsToEvent: attachTagsToEventMock,
      isSubmitting: false,
      error: null,
    });

    const { unmount } = await render(<EventDetailScreen />);

    unmount();

    expect(attachTagsToEventMock).not.toHaveBeenCalled();
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

  it("uses a trash icon instead of the 削除 text label for the todo delete button", async () => {
    mockCommonHooks({
      todos: [{ id: "todo-1", eventId: "event-1", title: "飲み物を買う", isDone: false, completedAt: null, reminderAt: null }],
    });

    const { queryByText, getByTestId } = await render(<EventDetailScreen />);

    expect(queryByText("削除")).toBeNull();
    expect(getByTestId("event-todo-delete-todo-1")).toBeTruthy();
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

  it("shows a reminder bell on each todo and saves a picked reminder via updateTodo", async () => {
    const { refetchTodos } = mockCommonHooks({
      event: FUTURE_EVENT,
      todos: [{ id: "todo-1", eventId: "event-1", title: "飲み物を買う", isDone: false, completedAt: null, reminderAt: null }],
    });
    const updateTodoMock = jest.fn().mockResolvedValue(true);
    (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: updateTodoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    expect(getByTestId("event-todo-reminder-bell-todo-1")).toBeTruthy();

    await fireEvent.press(getByTestId("event-todo-reminder-icon-todo-1"));
    await fireEvent.press(getByTestId("event-todo-reminder-todo-1-option-before_1h"));

    await waitFor(() =>
      expect(updateTodoMock).toHaveBeenCalledWith("todo-1", { reminderAt: "2098-12-31T23:00:00.000Z" })
    );
    await waitFor(() => expect(refetchTodos).toHaveBeenCalled());
  });

  it("edits a todo's title via the pencil icon and saves via updateTodo", async () => {
    const { refetchTodos } = mockCommonHooks({
      event: FUTURE_EVENT,
      todos: [{ id: "todo-1", eventId: "event-1", title: "飲み物を買う", isDone: false, completedAt: null, reminderAt: null }],
    });
    const updateTodoMock = jest.fn().mockResolvedValue(true);
    (useUpdateTodo as jest.Mock).mockReturnValue({ updateTodo: updateTodoMock, isSubmitting: false, error: null });

    const { getByTestId, queryByText } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-todo-edit-todo-1"));
    expect(getByTestId("event-todo-title-input-todo-1").props.value).toBe("飲み物を買う");

    await fireEvent.changeText(getByTestId("event-todo-title-input-todo-1"), "炭酸水を買う");
    await fireEvent.press(getByTestId("event-todo-title-confirm-todo-1"));

    await waitFor(() => expect(updateTodoMock).toHaveBeenCalledWith("todo-1", { title: "炭酸水を買う" }));
    await waitFor(() => expect(refetchTodos).toHaveBeenCalled());
    expect(queryByText("削除")).toBeNull();
  });

  it("shows the timed reminder options for a timed event, with none checked by default when no reminders exist yet", async () => {
    mockCommonHooks({ event: FUTURE_EVENT, reminders: [] });

    const { getByText, queryByTestId } = await render(<EventDetailScreen />);

    expect(getByText("開始時")).toBeTruthy();
    expect(getByText("10分前")).toBeTruthy();
    expect(getByText("1時間前")).toBeTruthy();
    expect(queryByTestId("event-reminder-option-before_10m-checked")).toBeNull();
  });

  it("adds a reminder and refetches when an unchecked option is pressed", async () => {
    const { refetchReminders } = mockCommonHooks({ event: FUTURE_EVENT, reminders: [] });
    const addEventReminderMock = jest.fn().mockResolvedValue(true);
    (useAddEventReminder as jest.Mock).mockReturnValue({
      addEventReminder: addEventReminderMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-reminder-option-before_10m"));

    await waitFor(() => expect(addEventReminderMock).toHaveBeenCalledWith("event-1", "before_10m", undefined));
    await waitFor(() => expect(refetchReminders).toHaveBeenCalled());
  });

  it("removes a reminder and refetches when an already-checked option is pressed", async () => {
    const reminder = { id: "r1", eventId: "event-1", userId: "user-1", kind: "before_10m", customValue: null, customUnit: null, remindAt: "2026-01-01T00:00:00.000Z" };
    const { refetchReminders } = mockCommonHooks({ event: FUTURE_EVENT, reminders: [reminder] });
    const removeEventReminderMock = jest.fn().mockResolvedValue(true);
    (useRemoveEventReminder as jest.Mock).mockReturnValue({
      removeEventReminder: removeEventReminderMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    expect(getByTestId("event-reminder-option-before_10m-checked")).toBeTruthy();
    await fireEvent.press(getByTestId("event-reminder-option-before_10m"));

    await waitFor(() => expect(removeEventReminderMock).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(refetchReminders).toHaveBeenCalled());
  });

  it("adds a custom reminder via the value/unit picker and refetches", async () => {
    const { refetchReminders } = mockCommonHooks({ event: FUTURE_EVENT, reminders: [] });
    const addEventReminderMock = jest.fn().mockResolvedValue(true);
    (useAddEventReminder as jest.Mock).mockReturnValue({
      addEventReminder: addEventReminderMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-reminder-option-custom"));
    await fireEvent.press(getByTestId("event-reminder-custom-value-picker-option-3"));
    await fireEvent.press(getByTestId("event-reminder-custom-unit-picker-option-hour"));
    await fireEvent.press(getByTestId("event-reminder-custom-picker-confirm"));

    await waitFor(() =>
      expect(addEventReminderMock).toHaveBeenCalledWith("event-1", "custom", { value: 3, unit: "hour" })
    );
    await waitFor(() => expect(refetchReminders).toHaveBeenCalled());
  });

  it("shows multiple existing custom reminders and removes just the one pressed", async () => {
    const customA = { id: "r-custom-a", eventId: "event-1", userId: "user-1", kind: "custom", customValue: 30, customUnit: "minute", remindAt: "2026-01-01T00:00:00.000Z" };
    const customB = { id: "r-custom-b", eventId: "event-1", userId: "user-1", kind: "custom", customValue: 2, customUnit: "day", remindAt: "2026-01-01T00:00:00.000Z" };
    mockCommonHooks({ event: FUTURE_EVENT, reminders: [customA, customB] });
    const removeEventReminderMock = jest.fn().mockResolvedValue(true);
    (useRemoveEventReminder as jest.Mock).mockReturnValue({
      removeEventReminder: removeEventReminderMock,
      isSubmitting: false,
      error: null,
    });

    const { getByText, getByTestId } = await render(<EventDetailScreen />);

    expect(getByText("30分前")).toBeTruthy();
    expect(getByText("2日前")).toBeTruthy();

    await fireEvent.press(getByTestId("event-reminder-custom-r-custom-a"));

    await waitFor(() => expect(removeEventReminderMock).toHaveBeenCalledWith("r-custom-a"));
  });

  it("hides the reminder section for a past event, since reminders no longer make sense for it", async () => {
    mockCommonHooks({ event: PAST_EVENT, reminders: [] });

    const { queryByTestId, queryByText } = await render(<EventDetailScreen />);

    expect(queryByTestId("event-reminder-option-custom")).toBeNull();
    expect(queryByText("リマインド")).toBeNull();
  });

  it("does not show the memory section for a future event", async () => {
    mockCommonHooks({ event: FUTURE_EVENT });

    const { queryByText } = await render(<EventDetailScreen />);

    expect(queryByText("思い出")).toBeNull();
  });

  it("shows the memory section for a past event", async () => {
    mockCommonHooks({ event: PAST_EVENT });

    const { getByText } = await render(<EventDetailScreen />);

    expect(getByText("思い出")).toBeTruthy();
  });

  it("shows the add-photo button when I have not added my own photo yet, and hides it once I have", async () => {
    mockCommonHooks({ event: PAST_EVENT, photos: [] });
    const { getByTestId, rerender } = await render(<EventDetailScreen />);
    expect(getByTestId("event-photo-add")).toBeTruthy();

    mockCommonHooks({
      event: PAST_EVENT,
      photos: [
        { id: "photo-1", eventId: "event-1", storagePath: "event-1/a.jpg", uploadedBy: "user-1", isThumbnail: false, createdAt: "2026-01-01", url: "https://example.com/a.jpg" },
      ],
    });
    await rerender(<EventDetailScreen />);

    expect(() => getByTestId("event-photo-add")).toThrow();
  });

  it("picks a photo and attaches it, then refetches", async () => {
    const { refetchPhotos } = mockCommonHooks({ event: PAST_EVENT, photos: [] });
    const attachPhotoMock = jest.fn().mockResolvedValue(true);
    (useAttachPhoto as jest.Mock).mockReturnValue({ attachPhoto: attachPhotoMock, isSubmitting: false, error: null });
    (pickPhotoFromLibrary as jest.Mock).mockResolvedValue({
      fileName: "a.jpg",
      contentType: "image/jpeg",
      data: "blob",
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-photo-add"));

    await waitFor(() =>
      expect(attachPhotoMock).toHaveBeenCalledWith("event-1", {
        fileName: "a.jpg",
        contentType: "image/jpeg",
        data: "blob",
      })
    );
    await waitFor(() => expect(refetchPhotos).toHaveBeenCalled());
  });

  it("does not attach anything when the photo picker is cancelled", async () => {
    mockCommonHooks({ event: PAST_EVENT, photos: [] });
    const attachPhotoMock = jest.fn().mockResolvedValue(true);
    (useAttachPhoto as jest.Mock).mockReturnValue({ attachPhoto: attachPhotoMock, isSubmitting: false, error: null });
    (pickPhotoFromLibrary as jest.Mock).mockResolvedValue(null);

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-photo-add"));

    expect(attachPhotoMock).not.toHaveBeenCalled();
  });

  it("deletes my own photo and refetches when its delete button is pressed", async () => {
    const myPhoto = { id: "photo-1", eventId: "event-1", storagePath: "event-1/a.jpg", uploadedBy: "user-1", isThumbnail: false, createdAt: "2026-01-01", url: "https://example.com/a.jpg" };
    const { refetchPhotos } = mockCommonHooks({ event: PAST_EVENT, photos: [myPhoto] });
    const detachPhotoMock = jest.fn().mockResolvedValue(true);
    (useDetachPhoto as jest.Mock).mockReturnValue({ detachPhoto: detachPhotoMock, isSubmitting: false, error: null });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-photo-photo-1-delete"));

    await waitFor(() => expect(detachPhotoMock).toHaveBeenCalledWith("photo-1", "event-1/a.jpg"));
    await waitFor(() => expect(refetchPhotos).toHaveBeenCalled());
  });

  it("sets the pressed photo as the thumbnail and refetches", async () => {
    const otherPhoto = { id: "photo-2", eventId: "event-1", storagePath: "event-1/b.jpg", uploadedBy: "user-2", isThumbnail: false, createdAt: "2026-01-01", url: "https://example.com/b.jpg" };
    const { refetchPhotos } = mockCommonHooks({ event: PAST_EVENT, photos: [otherPhoto] });
    const setPhotoThumbnailMock = jest.fn().mockResolvedValue(true);
    (useSetPhotoThumbnail as jest.Mock).mockReturnValue({
      setPhotoThumbnail: setPhotoThumbnailMock,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-photo-photo-2"));

    await waitFor(() => expect(setPhotoThumbnailMock).toHaveBeenCalledWith("event-1", "photo-2"));
    await waitFor(() => expect(refetchPhotos).toHaveBeenCalled());
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

  it("uses icons instead of text for the 編集/追加 buttons (title edit, tag edit, ToDo add, photo add)", async () => {
    mockCommonHooks({ event: PAST_EVENT }); // past event, so the photo-add button also renders

    const { queryByText, getByTestId } = await render(<EventDetailScreen />);

    // No plain-text "編集"/"追加" labels anywhere in the detail view.
    expect(queryByText("編集")).toBeNull();
    expect(queryByText("追加")).toBeNull();

    // The buttons themselves are still there, driven by an icon.
    expect(getByTestId("event-edit-button")).toBeTruthy();
    expect(getByTestId("event-tags-edit-button")).toBeTruthy();
    expect(getByTestId("event-todo-add")).toBeTruthy();
    expect(getByTestId("event-photo-add")).toBeTruthy();
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
        })
      )
    );
    await waitFor(() => expect(refetchEvent).toHaveBeenCalled());
  });

  it("uses icons instead of text for the edit modal's cancel/save buttons", async () => {
    mockCommonHooks();

    const { getByTestId, queryByText } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));

    expect(queryByText("キャンセル")).toBeNull();
    expect(queryByText("保存")).toBeNull();
    expect(getByTestId("event-edit-cancel")).toBeTruthy();
    expect(getByTestId("event-edit-submit")).toBeTruthy();
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

  it("closes the edit modal without saving when tapping outside it, on the backdrop", async () => {
    mockCommonHooks();
    const updateEventMock = jest.fn().mockResolvedValue(true);
    (useUpdateEvent as jest.Mock).mockReturnValue({ updateEvent: updateEventMock, isSubmitting: false, error: null });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));
    await fireEvent.press(getByTestId("event-edit-backdrop"));

    expect(updateEventMock).not.toHaveBeenCalled();
    expect(queryByTestId("event-edit-title-input")).toBeNull();
  });

  it("never shows a personal-only badge in the edit modal, since it now only covers shared fields (tags moved out)", async () => {
    mockCommonHooks({ calendarKind: "group" });

    const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

    await fireEvent.press(getByTestId("event-edit-button"));

    expect(getByTestId("event-edit-title-input")).toBeTruthy();
    expect(queryByTestId("event-edit-personal-group-label")).toBeNull();
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

  describe("switching the event's calendar", () => {
    it("shows the event's calendar at the top of the header, tappable to open the picker", async () => {
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "我が家", kind: "group" },
          { id: "cal-2", name: "Myカレンダー", kind: "personal" },
        ],
      });

      const { getByTestId, getByText } = await render(<EventDetailScreen />);

      expect(getByTestId("event-calendar-switch-button")).toBeTruthy();
      expect(getByText("我が家")).toBeTruthy();
    });

    it("opens the calendar picker showing all of the caller's calendars, with the current one checked", async () => {
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "我が家", kind: "group" },
          { id: "cal-2", name: "友人グループ", kind: "group" },
        ],
      });

      const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

      await fireEvent.press(getByTestId("event-calendar-switch-button"));

      expect(getByTestId("event-calendar-picker-option-cal-1-checked")).toBeTruthy();
      expect(queryByTestId("event-calendar-picker-option-cal-2-checked")).toBeNull();
    });

    it("selecting the same (current) calendar and confirming does nothing - no warning, no update", async () => {
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "我が家", kind: "group" },
          { id: "cal-2", name: "友人グループ", kind: "group" },
        ],
      });
      const updateEventMock = jest.fn();
      (useUpdateEvent as jest.Mock).mockReturnValue({ updateEvent: updateEventMock, isSubmitting: false, error: null });

      const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

      await fireEvent.press(getByTestId("event-calendar-switch-button"));
      await fireEvent.press(getByTestId("event-calendar-picker-confirm"));

      expect(queryByTestId("event-calendar-picker-backdrop")).toBeNull();
      expect(queryByTestId("event-calendar-switch-warning-confirm")).toBeNull();
      expect(updateEventMock).not.toHaveBeenCalled();
    });

    it("personal -> shared: warns which items become shared, and switches on OK", async () => {
      const refetchEvent = jest.fn();
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "Myカレンダー", kind: "personal" },
          { id: "cal-2", name: "我が家", kind: "group" },
        ],
        refetchEvent,
      });
      const updateEventMock = jest.fn().mockResolvedValue(true);
      (useUpdateEvent as jest.Mock).mockReturnValue({ updateEvent: updateEventMock, isSubmitting: false, error: null });

      const { getByTestId, getByText } = await render(<EventDetailScreen />);

      await fireEvent.press(getByTestId("event-calendar-switch-button"));
      await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));
      await fireEvent.press(getByTestId("event-calendar-picker-confirm"));

      expect(getByText("カレンダーを変更しますか?")).toBeTruthy();
      expect(getByText(/「我が家」のメンバーに共有されます/)).toBeTruthy();

      await fireEvent.press(getByTestId("event-calendar-switch-warning-confirm"));

      await waitFor(() => expect(updateEventMock).toHaveBeenCalledWith("event-1", { calendarId: "cal-2" }));
      await waitFor(() => expect(refetchEvent).toHaveBeenCalled());
    });

    it("shared -> personal: warns that the original calendar's members lose access", async () => {
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "我が家", kind: "group" },
          { id: "cal-2", name: "Myカレンダー", kind: "personal" },
        ],
      });

      const { getByTestId, getByText } = await render(<EventDetailScreen />);

      await fireEvent.press(getByTestId("event-calendar-switch-button"));
      await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));
      await fireEvent.press(getByTestId("event-calendar-picker-confirm"));

      expect(getByText(/「我が家」のメンバーは、移動後この予定を見られなくなります/)).toBeTruthy();
    });

    it("shared -> a different shared calendar: shows both warnings", async () => {
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "我が家", kind: "group" },
          { id: "cal-2", name: "友人グループ", kind: "group" },
        ],
      });

      const { getByTestId, getByText } = await render(<EventDetailScreen />);

      await fireEvent.press(getByTestId("event-calendar-switch-button"));
      await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));
      await fireEvent.press(getByTestId("event-calendar-picker-confirm"));

      expect(getByText(/「友人グループ」のメンバーに共有されます/)).toBeTruthy();
      expect(getByText(/「我が家」のメンバーは、移動後この予定を見られなくなります/)).toBeTruthy();
    });

    it("cancels the warning without switching the calendar", async () => {
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "我が家", kind: "group" },
          { id: "cal-2", name: "友人グループ", kind: "group" },
        ],
      });
      const updateEventMock = jest.fn();
      (useUpdateEvent as jest.Mock).mockReturnValue({ updateEvent: updateEventMock, isSubmitting: false, error: null });

      const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

      await fireEvent.press(getByTestId("event-calendar-switch-button"));
      await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));
      await fireEvent.press(getByTestId("event-calendar-picker-confirm"));
      await fireEvent.press(getByTestId("event-calendar-switch-warning-cancel"));

      expect(updateEventMock).not.toHaveBeenCalled();
      expect(queryByTestId("event-calendar-switch-warning-confirm")).toBeNull();
    });

    it("cancels the picker via the backdrop without opening the warning", async () => {
      mockCommonHooks({
        calendars: [
          { id: "cal-1", name: "我が家", kind: "group" },
          { id: "cal-2", name: "友人グループ", kind: "group" },
        ],
      });

      const { getByTestId, queryByTestId } = await render(<EventDetailScreen />);

      await fireEvent.press(getByTestId("event-calendar-switch-button"));
      await fireEvent.press(getByTestId("event-calendar-picker-option-cal-2"));
      await fireEvent.press(getByTestId("event-calendar-picker-backdrop"));

      expect(queryByTestId("event-calendar-switch-warning-confirm")).toBeNull();
      expect(queryByTestId("event-calendar-picker-backdrop")).toBeNull();
    });
  });
});
