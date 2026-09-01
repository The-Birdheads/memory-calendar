import { fireEvent, render } from "@testing-library/react-native";

import MemoriesScreen from "../memories";
import { useAuthSession } from "../../../src/features/auth/hooks";
import { useMyCalendars } from "../../../src/features/calendars/hooks";
import { useComments, usePostComment, useReactions, useToggleReaction } from "../../../src/features/communication/hooks";
import { useAddReflection, useAttachPhoto, useEventPhotos, useMemoriesTimeline } from "../../../src/features/memories/hooks";

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("../../../src/features/calendars/hooks", () => ({
  useMyCalendars: jest.fn(),
}));

jest.mock("../../../src/features/memories/hooks", () => ({
  useMemoriesTimeline: jest.fn(),
  useEventPhotos: jest.fn(),
  useAttachPhoto: jest.fn(),
  useAddReflection: jest.fn(),
}));

jest.mock("../../../src/features/communication/hooks", () => ({
  useComments: jest.fn(),
  usePostComment: jest.fn(),
  useReactions: jest.fn(),
  useToggleReaction: jest.fn(),
}));

const CALENDARS: { id: string; name: string; kind: "personal" | "group"; createdBy: string; createdAt: string }[] = [
  { id: "cal-1", name: "我が家", kind: "group", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
];

const ENTRIES = [
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

function mockCommonHooks(entries: typeof ENTRIES, calendars: typeof CALENDARS = CALENDARS) {
  (useAuthSession as jest.Mock).mockReturnValue({ session: { user: { id: "user-1" } } });
  (useMyCalendars as jest.Mock).mockReturnValue({ calendars, isLoading: false, error: null });
  (useMemoriesTimeline as jest.Mock).mockReturnValue({ entries, isLoading: false, error: null, refetch: jest.fn() });
  (useEventPhotos as jest.Mock).mockReturnValue({ photos: [], isLoading: false, error: null, refetch: jest.fn() });
  (useAttachPhoto as jest.Mock).mockReturnValue({ attachPhoto: jest.fn(), isSubmitting: false, error: null });
  (useAddReflection as jest.Mock).mockReturnValue({ addReflection: jest.fn(), isSubmitting: false, error: null });
  (useComments as jest.Mock).mockReturnValue({ comments: [], isLoading: false, error: null, refetch: jest.fn() });
  (usePostComment as jest.Mock).mockReturnValue({ postComment: jest.fn(), isSubmitting: false, error: null });
  (useReactions as jest.Mock).mockReturnValue({ reactions: [], isLoading: false, error: null, refetch: jest.fn() });
  (useToggleReaction as jest.Mock).mockReturnValue({ toggleReaction: jest.fn(), isSubmitting: false, error: null });
}

describe("MemoriesScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows a thumbnail and title for each memory in the timeline", async () => {
    mockCommonHooks(ENTRIES);

    const { getByText, getByTestId } = await render(<MemoriesScreen />);

    expect(getByText("誕生日会")).toBeTruthy();
    expect(getByTestId("memory-thumbnail-event-1").props.source).toEqual({
      uri: "https://example.com/signed/a.jpg",
    });
  });

  it("shows an empty state message when there are no memories", async () => {
    mockCommonHooks([]);

    const { getByText } = await render(<MemoriesScreen />);

    expect(getByText("思い出がありません")).toBeTruthy();
  });

  it("shows the detail view (date, photos, comments, stamps) when a memory is selected", async () => {
    mockCommonHooks(ENTRIES);

    const { getByTestId, getByText } = await render(<MemoriesScreen />);

    await fireEvent.press(getByTestId("memory-item-event-1"));

    expect(getByText("2026/08/10 10:00")).toBeTruthy();
    expect(useEventPhotos).toHaveBeenLastCalledWith("event-1");
    expect(useComments).toHaveBeenLastCalledWith("event-1");
    expect(useReactions).toHaveBeenLastCalledWith("event-1");
  });

  it("shows the stamp bar for a group calendar's memory", async () => {
    mockCommonHooks(ENTRIES);

    const { getByTestId } = await render(<MemoriesScreen />);

    await fireEvent.press(getByTestId("memory-item-event-1"));

    expect(getByTestId("event-reaction-add-👍")).toBeTruthy();
  });

  it("hides the stamp bar for a personal calendar's memory", async () => {
    mockCommonHooks(ENTRIES, [{ ...CALENDARS[0], kind: "personal" }]);

    const { getByTestId, queryByTestId } = await render(<MemoriesScreen />);

    await fireEvent.press(getByTestId("memory-item-event-1"));

    expect(queryByTestId("event-reaction-add-👍")).toBeNull();
  });
});
