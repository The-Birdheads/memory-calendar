import type { SupabaseClient } from "@supabase/supabase-js";

import {
  attachTagsToEvent,
  attachTagsToEvents,
  createTag,
  deleteTag,
  detachTagFromEvent,
  listTagsForEvent,
  listTagsForEvents,
  listTagTree,
  removeAllTagsFromEvents,
  updateTag,
} from "../service";

describe("createTag", () => {
  it("creates a major tag and returns it on success", async () => {
    const row = {
      id: "tag-1",
      parent_id: null,
      level: "major",
      name: "行事",
      color: "#ff0000",
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createTag(client, {
      name: "行事",
      color: "#ff0000",
      level: "major",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "tag-1",
        parentId: null,
        level: "major",
        name: "行事",
        color: "#ff0000",
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("tags");
    expect(insert).toHaveBeenCalledWith({
      name: "行事",
      color: "#ff0000",
      level: "major",
      parent_id: null,
    });
  });

  it("creates a mid tag with a parent and returns it on success", async () => {
    const row = {
      id: "tag-2",
      parent_id: "tag-1",
      level: "mid",
      name: "誕生日",
      color: "#00ff00",
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createTag(client, {
      name: "誕生日",
      color: "#00ff00",
      level: "mid",
      parentId: "tag-1",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "tag-2",
        parentId: "tag-1",
        level: "mid",
        name: "誕生日",
        color: "#00ff00",
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(insert).toHaveBeenCalledWith({
      name: "誕生日",
      color: "#00ff00",
      level: "mid",
      parent_id: "tag-1",
    });
  });

  it("returns InvalidHierarchy without calling Supabase when a major tag has a parent", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await createTag(client, {
      name: "行事",
      color: "#ff0000",
      level: "major",
      parentId: "tag-1",
    });

    expect(result).toEqual({ ok: false, error: { type: "InvalidHierarchy" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns InvalidHierarchy without calling Supabase when a mid tag has no parent", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await createTag(client, {
      name: "誕生日",
      color: "#00ff00",
      level: "mid",
    });

    expect(result).toEqual({ ok: false, error: { type: "InvalidHierarchy" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a check constraint violation to InvalidHierarchy", async () => {
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "check constraint violated", code: "23514" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createTag(client, {
      name: "誕生日",
      color: "#00ff00",
      level: "mid",
      parentId: "tag-1",
    });

    expect(result).toEqual({ ok: false, error: { type: "InvalidHierarchy" } });
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createTag(client, {
      name: "行事",
      color: "#ff0000",
      level: "major",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listTagTree", () => {
  it("assembles flat rows into a major/mid/minor tree, independent of any calendar", async () => {
    const rows = [
      { id: "tag-1", parent_id: null, level: "major", name: "行事", color: "#ff0000", created_at: "2026-08-18T00:00:00.000Z" },
      { id: "tag-2", parent_id: "tag-1", level: "mid", name: "誕生日", color: "#00ff00", created_at: "2026-08-18T00:01:00.000Z" },
      { id: "tag-3", parent_id: "tag-2", level: "minor", name: "家族の誕生日", color: "#0000ff", created_at: "2026-08-18T00:02:00.000Z" },
    ];
    const select = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, order }),
    } as unknown as SupabaseClient;

    const result = await listTagTree(client);

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "tag-1",
          parentId: null,
          level: "major",
          name: "行事",
          color: "#ff0000",
          createdAt: "2026-08-18T00:00:00.000Z",
          children: [
            {
              id: "tag-2",
              parentId: "tag-1",
              level: "mid",
              name: "誕生日",
              color: "#00ff00",
              createdAt: "2026-08-18T00:01:00.000Z",
              children: [
                {
                  id: "tag-3",
                  parentId: "tag-2",
                  level: "minor",
                  name: "家族の誕生日",
                  color: "#0000ff",
                  createdAt: "2026-08-18T00:02:00.000Z",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("tags");
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, order }),
    } as unknown as SupabaseClient;

    const result = await listTagTree(client);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("attachTagsToEvent", () => {
  it("inserts an event_tags row for each given tag id", async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert }),
    } as unknown as SupabaseClient;

    const result = await attachTagsToEvent(client, "event-1", ["tag-1", "tag-2"]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("event_tags");
    expect(insert).toHaveBeenCalledWith([
      { event_id: "event-1", tag_id: "tag-1" },
      { event_id: "event-1", tag_id: "tag-2" },
    ]);
  });

  it("does nothing without calling Supabase when the tag id list is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await attachTagsToEvent(client, "event-1", []);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const insert = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert }),
    } as unknown as SupabaseClient;

    const result = await attachTagsToEvent(client, "event-1", ["tag-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("detachTagFromEvent", () => {
  it("deletes the matching event_tags row", async () => {
    const eq2 = jest.fn().mockResolvedValue({ error: null });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const del = jest.fn().mockReturnValue({ eq: eq1 });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await detachTagFromEvent(client, "event-1", "tag-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("event_tags");
    expect(eq1).toHaveBeenCalledWith("event_id", "event-1");
    expect(eq2).toHaveBeenCalledWith("tag_id", "tag-1");
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const eq2 = jest.fn().mockResolvedValue({ error: { message: "permission denied", code: "42501" } });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const del = jest.fn().mockReturnValue({ eq: eq1 });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await detachTagFromEvent(client, "event-1", "tag-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("attachTagsToEvents", () => {
  it("upserts an event_tags row for every (event, tag) combination, ignoring duplicates", async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const client = {
      from: jest.fn().mockReturnValue({ upsert }),
    } as unknown as SupabaseClient;

    const result = await attachTagsToEvents(client, ["tag-1", "tag-2"], ["event-1", "event-2"]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("event_tags");
    expect(upsert).toHaveBeenCalledWith(
      [
        { event_id: "event-1", tag_id: "tag-1" },
        { event_id: "event-1", tag_id: "tag-2" },
        { event_id: "event-2", tag_id: "tag-1" },
        { event_id: "event-2", tag_id: "tag-2" },
      ],
      { onConflict: "event_id,tag_id", ignoreDuplicates: true }
    );
  });

  it("does nothing without calling Supabase when there are no tags or no events", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    expect(await attachTagsToEvents(client, [], ["event-1"])).toEqual({ ok: true, value: undefined });
    expect(await attachTagsToEvents(client, ["tag-1"], [])).toEqual({ ok: true, value: undefined });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const upsert = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ upsert }),
    } as unknown as SupabaseClient;

    const result = await attachTagsToEvents(client, ["tag-1"], ["event-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("removeAllTagsFromEvents", () => {
  it("deletes every event_tags row for the given events", async () => {
    const inFn = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ in: inFn });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await removeAllTagsFromEvents(client, ["event-1", "event-2"]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("event_tags");
    expect(inFn).toHaveBeenCalledWith("event_id", ["event-1", "event-2"]);
  });

  it("does nothing without calling Supabase when the event id list is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await removeAllTagsFromEvents(client, []);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const inFn = jest.fn().mockResolvedValue({ error: { message: "permission denied", code: "42501" } });
    const del = jest.fn().mockReturnValue({ in: inFn });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await removeAllTagsFromEvents(client, ["event-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listTagsForEvent", () => {
  it("returns the tags attached to the given event", async () => {
    const rows = [
      {
        tags: {
          id: "tag-1",
          parent_id: null,
          level: "major",
          name: "行事",
          color: "#ff0000",
          created_at: "2026-08-18T00:00:00.000Z",
        },
      },
      {
        tags: {
          id: "tag-2",
          parent_id: "tag-1",
          level: "mid",
          name: "誕生日",
          color: "#00ff00",
          created_at: "2026-08-18T00:01:00.000Z",
        },
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq }),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvent(client, "event-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "tag-1",
          parentId: null,
          level: "major",
          name: "行事",
          color: "#ff0000",
          createdAt: "2026-08-18T00:00:00.000Z",
        },
        {
          id: "tag-2",
          parentId: "tag-1",
          level: "mid",
          name: "誕生日",
          color: "#00ff00",
          createdAt: "2026-08-18T00:01:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("event_tags");
    expect(select).toHaveBeenCalledWith("tags(*)");
    expect(eq).toHaveBeenCalledWith("event_id", "event-1");
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq }),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvent(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listTagsForEvents", () => {
  it("queries in chunks of at most 100 event ids and merges the results, so a long timeline doesn't blow the URL length limit (regression: tags vanished once events piled up)", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `event-${i}`);
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockImplementation(async (_column: string, chunkIds: string[]) => ({
      data: chunkIds.map((eid) => ({
        event_id: eid,
        tags: { id: `tag-${eid}`, parent_id: null, level: "major", name: `タグ${eid}`, color: "#ff0000", created_at: "2026-08-18T00:00:00.000Z" },
      })),
      error: null,
    }));
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn }),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvents(client, ids);

    expect(inFn).toHaveBeenCalledTimes(3);
    for (const call of inFn.mock.calls) {
      expect(call[1].length).toBeLessThanOrEqual(100);
    }
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toHaveLength(250);
      expect(result.value["event-249"][0].name).toBe("タグevent-249");
    }
  });

  it("fails the whole lookup when any chunk fails, rather than silently showing a partial set", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `event-${i}`);
    const select = jest.fn().mockReturnThis();
    const inFn = jest
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn }),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvents(client, ids);

    expect(result.ok).toBe(false);
  });

  it("skips an event_tags row whose tag can't be read (null), instead of throwing and dropping every other event's tags", async () => {
    const rows = [
      { event_id: "event-1", tags: null },
      {
        event_id: "event-2",
        tags: { id: "tag-3", parent_id: null, level: "major", name: "旅行", color: "#0000ff", created_at: "2026-08-18T00:02:00.000Z" },
      },
    ];
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn }),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvents(client, ["event-1", "event-2"]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["event-1"]).toBeUndefined();
      expect(result.value["event-2"]).toHaveLength(1);
    }
  });

  it("groups the tags attached to each of the given events by event id", async () => {
    const rows = [
      {
        event_id: "event-1",
        tags: {
          id: "tag-1",
          parent_id: null,
          level: "major",
          name: "行事",
          color: "#ff0000",
          created_at: "2026-08-18T00:00:00.000Z",
        },
      },
      {
        event_id: "event-1",
        tags: {
          id: "tag-2",
          parent_id: "tag-1",
          level: "mid",
          name: "誕生日",
          color: "#00ff00",
          created_at: "2026-08-18T00:01:00.000Z",
        },
      },
      {
        event_id: "event-2",
        tags: {
          id: "tag-3",
          parent_id: null,
          level: "major",
          name: "旅行",
          color: "#0000ff",
          created_at: "2026-08-18T00:02:00.000Z",
        },
      },
    ];
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn }),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvents(client, ["event-1", "event-2"]);

    expect(result).toEqual({
      ok: true,
      value: {
        "event-1": [
          {
            id: "tag-1",
            parentId: null,
            level: "major",
            name: "行事",
            color: "#ff0000",
            createdAt: "2026-08-18T00:00:00.000Z",
          },
          {
            id: "tag-2",
            parentId: "tag-1",
            level: "mid",
            name: "誕生日",
            color: "#00ff00",
            createdAt: "2026-08-18T00:01:00.000Z",
          },
        ],
        "event-2": [
          {
            id: "tag-3",
            parentId: null,
            level: "major",
            name: "旅行",
            color: "#0000ff",
            createdAt: "2026-08-18T00:02:00.000Z",
          },
        ],
      },
    });
    expect(client.from).toHaveBeenCalledWith("event_tags");
    expect(select).toHaveBeenCalledWith("event_id, tags(*)");
    expect(inFn).toHaveBeenCalledWith("event_id", ["event-1", "event-2"]);
  });

  it("returns an empty map without querying when given no event ids", async () => {
    const client = {
      from: jest.fn(),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvents(client, []);

    expect(result).toEqual({ ok: true, value: {} });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const inFn = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, in: inFn }),
    } as unknown as SupabaseClient;

    const result = await listTagsForEvents(client, ["event-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("updateTag", () => {
  it("updates a tag's name and color and returns it on success", async () => {
    const row = {
      id: "tag-1",
      parent_id: null,
      level: "major",
      name: "行事(変更後)",
      color: "#123456",
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateTag(client, "tag-1", { name: "行事(変更後)", color: "#123456" });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "tag-1",
        parentId: null,
        level: "major",
        name: "行事(変更後)",
        color: "#123456",
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("tags");
    expect(update).toHaveBeenCalledWith({ name: "行事(変更後)", color: "#123456" });
    expect(eq).toHaveBeenCalledWith("id", "tag-1");
  });

  it("updates the level and parent together", async () => {
    const row = {
      id: "tag-2",
      parent_id: "tag-1",
      level: "mid",
      name: "誕生日",
      color: "#00ff00",
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    await updateTag(client, "tag-2", { level: "mid", parentId: "tag-1" });

    expect(update).toHaveBeenCalledWith({ level: "mid", parent_id: "tag-1" });
  });

  it("returns InvalidHierarchy without calling Supabase when a major level update keeps a parent", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await updateTag(client, "tag-1", { level: "major", parentId: "tag-0" });

    expect(result).toEqual({ ok: false, error: { type: "InvalidHierarchy" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns InvalidHierarchy without calling Supabase when a mid level update clears the parent", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await updateTag(client, "tag-2", { level: "mid", parentId: null });

    expect(result).toEqual({ ok: false, error: { type: "InvalidHierarchy" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a check constraint violation to InvalidHierarchy", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "check constraint violated", code: "23514" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateTag(client, "tag-1", { color: "not-a-color" });

    expect(result).toEqual({ ok: false, error: { type: "InvalidHierarchy" } });
  });

  it("maps an RLS/permission error to Forbidden", async () => {
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateTag(client, "tag-1", { name: "変更" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("deleteTag", () => {
  it("deletes the given tag", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteTag(client, "tag-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("tags");
    expect(eq).toHaveBeenCalledWith("id", "tag-1");
  });

  it("maps a permission error to Forbidden", async () => {
    const eq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteTag(client, "tag-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
