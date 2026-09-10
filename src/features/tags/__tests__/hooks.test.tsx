import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import {
  attachTagsToEvent,
  createTag,
  deleteTag,
  detachTagFromEvent,
  listTagsForEvent,
  listTagsForEvents,
  listTagTree,
  updateTag,
} from "../service";
import {
  useAttachTagsToEvent,
  useCreateTag,
  useDeleteTag,
  useDetachTagFromEvent,
  useEventTags,
  useEventTagsByEvents,
  useTagTree,
  useUpdateTag,
} from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  createTag: jest.fn(),
  listTagTree: jest.fn(),
  attachTagsToEvent: jest.fn(),
  detachTagFromEvent: jest.fn(),
  listTagsForEvent: jest.fn(),
  listTagsForEvents: jest.fn(),
  updateTag: jest.fn(),
  deleteTag: jest.fn(),
}));

describe("useTagTree", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the caller's tag tree on mount, independent of any calendar", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const tree = [
      {
        id: "tag-1",
        parentId: null,
        level: "major",
        name: "行事",
        color: "#ff0000",
        createdAt: "2026-08-18",
        children: [],
      },
    ];
    (listTagTree as jest.Mock).mockResolvedValue({ ok: true, value: tree });

    const { result } = await renderHook(() => useTagTree());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tagTree).toEqual(tree);
    expect(listTagTree).toHaveBeenCalledWith({});
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listTagTree as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useTagTree());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tagTree).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("subscribes to realtime changes on the tags table and refetches on change", async () => {
    const channel = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = { channel: jest.fn(() => channel) };
    (getSupabaseClient as jest.Mock).mockReturnValue(client);
    (listTagTree as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    await renderHook(() => useTagTree());

    await waitFor(() => expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^tags-mine-/)));
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "tags" },
      expect.any(Function)
    );

    const onChange = channel.on.mock.calls[0][2];
    (listTagTree as jest.Mock).mockClear();
    await act(async () => {
      await onChange();
    });

    await waitFor(() => expect(listTagTree).toHaveBeenCalled());
  });
});

describe("useCreateTag", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when creation succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createTag as jest.Mock).mockResolvedValue({ ok: true, value: { id: "tag-1" } });

    const { result } = await renderHook(() => useCreateTag());

    let success = false;
    await act(async () => {
      success = await result.current.createTag({
        name: "行事",
        color: "#ff0000",
        level: "major",
      });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(createTag).toHaveBeenCalledWith({}, {
      name: "行事",
      color: "#ff0000",
      level: "major",
    });
  });

  it("returns false and sets the error when creation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createTag as jest.Mock).mockResolvedValue({ ok: false, error: { type: "InvalidHierarchy" } });

    const { result } = await renderHook(() => useCreateTag());

    let success = true;
    await act(async () => {
      success = await result.current.createTag({
        name: "誕生日",
        color: "#00ff00",
        level: "mid",
      });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "InvalidHierarchy" });
  });
});

describe("useEventTags", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the tags attached to the given event on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const tags = [
      { id: "tag-1", parentId: null, level: "major", name: "行事", color: "#ff0000", createdAt: "2026-08-18" },
    ];
    (listTagsForEvent as jest.Mock).mockResolvedValue({ ok: true, value: tags });

    const { result } = await renderHook(() => useEventTags("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tags).toEqual(tags);
    expect(listTagsForEvent).toHaveBeenCalledWith({}, "event-1");
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listTagsForEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useEventTags("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tags).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useEventTagsByEvents", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the tags for every given event, grouped by event id, on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const tagsByEventId = {
      "event-1": [
        { id: "tag-1", parentId: null, level: "major", name: "行事", color: "#ff0000", createdAt: "2026-08-18" },
      ],
    };
    (listTagsForEvents as jest.Mock).mockResolvedValue({ ok: true, value: tagsByEventId });

    const { result } = await renderHook(() => useEventTagsByEvents(["event-1", "event-2"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tagsByEventId).toEqual(tagsByEventId);
    expect(listTagsForEvents).toHaveBeenCalledWith({}, ["event-1", "event-2"]);
  });

  it("keeps an empty map and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listTagsForEvents as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useEventTagsByEvents(["event-1"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tagsByEventId).toEqual({});
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("skips fetching (and stays not-loading, with an empty map) when given no event ids", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});

    const { result } = await renderHook(() => useEventTagsByEvents([]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tagsByEventId).toEqual({});
    expect(listTagsForEvents).not.toHaveBeenCalled();
  });
});

describe("useAttachTagsToEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (attachTagsToEvent as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useAttachTagsToEvent());

    let success = false;
    await act(async () => {
      success = await result.current.attachTagsToEvent("event-1", ["tag-1", "tag-2"]);
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(attachTagsToEvent).toHaveBeenCalledWith({}, "event-1", ["tag-1", "tag-2"]);
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (attachTagsToEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useAttachTagsToEvent());

    let success = true;
    await act(async () => {
      success = await result.current.attachTagsToEvent("event-1", ["tag-1"]);
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useDetachTagFromEvent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (detachTagFromEvent as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDetachTagFromEvent());

    let success = false;
    await act(async () => {
      success = await result.current.detachTagFromEvent("event-1", "tag-1");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(detachTagFromEvent).toHaveBeenCalledWith({}, "event-1", "tag-1");
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (detachTagFromEvent as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useDetachTagFromEvent());

    let success = true;
    await act(async () => {
      success = await result.current.detachTagFromEvent("event-1", "tag-1");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useUpdateTag", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateTag as jest.Mock).mockResolvedValue({ ok: true, value: { id: "tag-1" } });

    const { result } = await renderHook(() => useUpdateTag());

    let success = false;
    await act(async () => {
      success = await result.current.updateTag("tag-1", { name: "変更後" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(updateTag).toHaveBeenCalledWith({}, "tag-1", { name: "変更後" });
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateTag as jest.Mock).mockResolvedValue({ ok: false, error: { type: "InvalidHierarchy" } });

    const { result } = await renderHook(() => useUpdateTag());

    let success = true;
    await act(async () => {
      success = await result.current.updateTag("tag-1", { level: "mid", parentId: null });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "InvalidHierarchy" });
  });
});

describe("useDeleteTag", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when deletion succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteTag as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDeleteTag());

    let success = false;
    await act(async () => {
      success = await result.current.deleteTag("tag-1");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(deleteTag).toHaveBeenCalledWith({}, "tag-1");
  });

  it("returns false and sets the error when deletion fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteTag as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useDeleteTag());

    let success = true;
    await act(async () => {
      success = await result.current.deleteTag("tag-1");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
