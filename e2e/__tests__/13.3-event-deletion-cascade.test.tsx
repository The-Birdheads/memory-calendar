import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import EventDetailScreen from "../../app/event/[id]";
import { useAuthSession } from "../../src/features/auth/hooks";
import { useCalendarMembers } from "../../src/features/calendars/hooks";
import {
  useAddReaction,
  useComments,
  useDeleteComment,
  usePostComment,
  useReactions,
} from "../../src/features/communication/hooks";
import { useAddReflection, useEventPhotos } from "../../src/features/memories/hooks";
import { getSupabaseClient } from "../../src/shared/api/supabaseClient";
import { useAttachTagsToEvent, useEventTags, useTagTree } from "../../src/features/tags/hooks";
import { useCreateTodo, useDeleteTodo, useToggleDone, useTodosByEvent } from "../../src/features/todos/hooks";
import { createFakeSupabaseClient } from "../testUtils/fakeSupabaseClient";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("../../src/shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../src/features/calendars/hooks", () => ({
  useCalendarMembers: jest.fn(),
}));

jest.mock("../../src/features/communication/hooks", () => ({
  useComments: jest.fn(),
  usePostComment: jest.fn(),
  useDeleteComment: jest.fn(),
  useReactions: jest.fn(),
  useAddReaction: jest.fn(),
}));

jest.mock("../../src/features/memories/hooks", () => ({
  useEventPhotos: jest.fn(),
  useAddReflection: jest.fn(),
}));

jest.mock("../../src/features/tags/hooks", () => ({
  useEventTags: jest.fn(),
  useTagTree: jest.fn(),
  useAttachTagsToEvent: jest.fn(),
}));

jest.mock("../../src/features/todos/hooks", () => ({
  useTodosByEvent: jest.fn(),
  useCreateTodo: jest.fn(),
  useToggleDone: jest.fn(),
  useDeleteTodo: jest.fn(),
}));

// events/hooks (useEvent, useDeleteEvent) are intentionally left un-mocked so the
// real hook -> service -> Supabase client chain is exercised against the fake DB.

const EVENT_ROW = {
  id: "event-1",
  calendar_id: "cal-1",
  series_id: null,
  title: "夏祭り",
  location: null,
  memo: null,
  category_color: "#2f6fed",
  start_at: "2020-08-01T10:00:00.000Z",
  end_at: "2020-08-01T12:00:00.000Z",
  is_all_day: false,
  reminder_at: null,
  created_by: "user-1",
  updated_by: "user-1",
};

describe("13.3 予定削除フローの検証", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockAuxiliaryHooks() {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: "event-1" });
    (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false });
    (useCalendarMembers as jest.Mock).mockReturnValue({ members: [], isLoading: false, error: null, refetch: jest.fn() });
    (useComments as jest.Mock).mockReturnValue({ comments: [], isLoading: false, error: null, refetch: jest.fn() });
    (usePostComment as jest.Mock).mockReturnValue({ postComment: jest.fn(), isSubmitting: false, error: null });
    (useDeleteComment as jest.Mock).mockReturnValue({ deleteComment: jest.fn(), isSubmitting: false, error: null });
    (useReactions as jest.Mock).mockReturnValue({ reactions: [], isLoading: false, error: null, refetch: jest.fn() });
    (useAddReaction as jest.Mock).mockReturnValue({ addReaction: jest.fn(), isSubmitting: false, error: null });
    (useEventPhotos as jest.Mock).mockReturnValue({ photos: [], isLoading: false, error: null, refetch: jest.fn() });
    (useAddReflection as jest.Mock).mockReturnValue({ addReflection: jest.fn(), isSubmitting: false, error: null });
    (useEventTags as jest.Mock).mockReturnValue({ tags: [], isLoading: false, error: null, refetch: jest.fn() });
    (useTagTree as jest.Mock).mockReturnValue({ tagTree: [], isLoading: false, error: null, refetch: jest.fn() });
    (useAttachTagsToEvent as jest.Mock).mockReturnValue({ attachTagsToEvent: jest.fn(), isSubmitting: false, error: null });
    (useTodosByEvent as jest.Mock).mockReturnValue({ todos: [], isLoading: false, error: null, refetch: jest.fn() });
    (useCreateTodo as jest.Mock).mockReturnValue({ createTodo: jest.fn(), isSubmitting: false, error: null });
    (useToggleDone as jest.Mock).mockReturnValue({ toggleDone: jest.fn(), isSubmitting: false, error: null });
    (useDeleteTodo as jest.Mock).mockReturnValue({ deleteTodo: jest.fn(), isSubmitting: false, error: null });
  }

  it("shows the memory-data warning in the confirm modal, then cascades the delete on confirm", async () => {
    mockAuxiliaryHooks();
    const fakeClient = createFakeSupabaseClient({
      events: [EVENT_ROW],
      todos: [{ id: "todo-1", event_id: "event-1", title: "花火を買う", is_done: false, completed_at: null, reminder_at: null }],
      event_photos: [{ id: "photo-1", event_id: "event-1", storage_path: "event-1/photo.jpg", uploaded_by: "user-1" }],
      event_comments: [{ id: "comment-1", event_id: "event-1", user_id: "user-1", body: "楽しかった" }],
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(fakeClient);

    const { getByTestId, getByText } = await render(<EventDetailScreen />);

    await waitFor(() => expect(getByText("夏祭り")).toBeTruthy());

    await fireEvent.press(getByTestId("event-delete-button"));

    expect(getByText("この予定に紐づく思い出データ(写真・コメント)も削除されます")).toBeTruthy();

    await fireEvent.press(getByTestId("delete-event-confirm-button"));

    await waitFor(() => expect(fakeClient.getTable("events")).toHaveLength(0));
    expect(fakeClient.getTable("todos")).toHaveLength(0);
    expect(fakeClient.getTable("event_photos")).toHaveLength(0);
    expect(fakeClient.getTable("event_comments")).toHaveLength(0);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });
});
