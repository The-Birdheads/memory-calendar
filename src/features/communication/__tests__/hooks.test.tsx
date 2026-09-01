import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { deleteComment, listComments, listReactions, postComment, toggleReaction } from "../service";
import {
  useComments,
  useDeleteComment,
  usePostComment,
  useReactions,
  useToggleReaction,
} from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  postComment: jest.fn(),
  listComments: jest.fn(),
  deleteComment: jest.fn(),
  toggleReaction: jest.fn(),
  listReactions: jest.fn(),
}));

describe("useComments", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the comments for the given event on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const comments = [
      { id: "comment-1", eventId: "event-1", userId: "user-1", body: "楽しみ", createdAt: "2026-08-18" },
    ];
    (listComments as jest.Mock).mockResolvedValue({ ok: true, value: comments });

    const { result } = await renderHook(() => useComments("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toEqual(comments);
    expect(listComments).toHaveBeenCalledWith({}, "event-1");
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listComments as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useComments("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("usePostComment", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when posting succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (postComment as jest.Mock).mockResolvedValue({ ok: true, value: { id: "comment-1" } });

    const { result } = await renderHook(() => usePostComment());

    let success = false;
    await act(async () => {
      success = await result.current.postComment("event-1", "楽しみですね");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(postComment).toHaveBeenCalledWith({}, "event-1", "楽しみですね");
  });

  it("returns false and sets the error when posting fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (postComment as jest.Mock).mockResolvedValue({
      ok: false,
      error: { type: "ValidationError", field: "body" },
    });

    const { result } = await renderHook(() => usePostComment());

    let success = true;
    await act(async () => {
      success = await result.current.postComment("event-1", "");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "ValidationError", field: "body" });
  });
});

describe("useDeleteComment", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when deletion succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteComment as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDeleteComment());

    let success = false;
    await act(async () => {
      success = await result.current.deleteComment("comment-1");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(deleteComment).toHaveBeenCalledWith({}, "comment-1");
  });

  it("returns false and sets the error when deletion fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteComment as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useDeleteComment());

    let success = true;
    await act(async () => {
      success = await result.current.deleteComment("comment-1");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useReactions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the reactions for the given event on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const reactions = [
      { id: "reaction-1", eventId: "event-1", userId: "user-1", stampType: "👍", createdAt: "2026-08-18" },
    ];
    (listReactions as jest.Mock).mockResolvedValue({ ok: true, value: reactions });

    const { result } = await renderHook(() => useReactions("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reactions).toEqual(reactions);
    expect(listReactions).toHaveBeenCalledWith({}, "event-1");
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listReactions as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useReactions("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reactions).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useToggleReaction", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (toggleReaction as jest.Mock).mockResolvedValue({ ok: true, value: { id: "reaction-1" } });

    const { result } = await renderHook(() => useToggleReaction());

    let success = false;
    await act(async () => {
      success = await result.current.toggleReaction("event-1", "👍", null);
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(toggleReaction).toHaveBeenCalledWith({}, "event-1", "👍", null);
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (toggleReaction as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useToggleReaction());

    let success = true;
    await act(async () => {
      success = await result.current.toggleReaction("event-1", "👍", null);
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
