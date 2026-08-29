import type { SupabaseClient } from "@supabase/supabase-js";

import {
  attachTagsToEvent,
  createTag,
  deleteTag,
  detachTagFromEvent,
  listTagsForEvent,
  listTagTree,
  updateTag,
} from "../service";

describe("createTag", () => {
  it("creates a major tag and returns it on success", async () => {
    const row = {
      id: "tag-1",
      calendar_id: "cal-1",
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
      calendarId: "cal-1",
      name: "行事",
      color: "#ff0000",
      level: "major",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "tag-1",
        calendarId: "cal-1",
        parentId: null,
        level: "major",
        name: "行事",
        color: "#ff0000",
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("tags");
    expect(insert).toHaveBeenCalledWith({
      calendar_id: "cal-1",
      name: "行事",
      color: "#ff0000",
      level: "major",
      parent_id: null,
    });
  });

  it("creates a mid tag with a parent and returns it on success", async () => {
    const row = {
      id: "tag-2",
      calendar_id: "cal-1",
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
      calendarId: "cal-1",
      name: "誕生日",
      color: "#00ff00",
      level: "mid",
      parentId: "tag-1",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "tag-2",
        calendarId: "cal-1",
        parentId: "tag-1",
        level: "mid",
        name: "誕生日",
        color: "#00ff00",
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(insert).toHaveBeenCalledWith({
      calendar_id: "cal-1",
      name: "誕生日",
      color: "#00ff00",
      level: "mid",
      parent_id: "tag-1",
    });
  });

  it("returns InvalidHierarchy without calling Supabase when a major tag has a parent", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await createTag(client, {
      calendarId: "cal-1",
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
      calendarId: "cal-1",
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
      calendarId: "cal-1",
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
      calendarId: "cal-1",
      name: "行事",
      color: "#ff0000",
      level: "major",
    });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listTagTree", () => {
  it("assembles flat rows into a major/mid/minor tree", async () => {
    const rows = [
      { id: "tag-1", calendar_id: "cal-1", parent_id: null, level: "major", name: "行事", color: "#ff0000", created_at: "2026-08-18T00:00:00.000Z" },
      { id: "tag-2", calendar_id: "cal-1", parent_id: "tag-1", level: "mid", name: "誕生日", color: "#00ff00", created_at: "2026-08-18T00:01:00.000Z" },
      { id: "tag-3", calendar_id: "cal-1", parent_id: "tag-2", level: "minor", name: "家族の誕生日", color: "#0000ff", created_at: "2026-08-18T00:02:00.000Z" },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    const result = await listTagTree(client, "cal-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "tag-1",
          calendarId: "cal-1",
          parentId: null,
          level: "major",
          name: "行事",
          color: "#ff0000",
          createdAt: "2026-08-18T00:00:00.000Z",
          children: [
            {
              id: "tag-2",
              calendarId: "cal-1",
              parentId: "tag-1",
              level: "mid",
              name: "誕生日",
              color: "#00ff00",
              createdAt: "2026-08-18T00:01:00.000Z",
              children: [
                {
                  id: "tag-3",
                  calendarId: "cal-1",
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
    expect(eq).toHaveBeenCalledWith("calendar_id", "cal-1");
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    const result = await listTagTree(client, "cal-1");

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

describe("listTagsForEvent", () => {
  it("returns the tags attached to the given event", async () => {
    const rows = [
      {
        tags: {
          id: "tag-1",
          calendar_id: "cal-1",
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
          calendar_id: "cal-1",
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
          calendarId: "cal-1",
          parentId: null,
          level: "major",
          name: "行事",
          color: "#ff0000",
          createdAt: "2026-08-18T00:00:00.000Z",
        },
        {
          id: "tag-2",
          calendarId: "cal-1",
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

describe("updateTag", () => {
  it("updates a tag's name and color and returns it on success", async () => {
    const row = {
      id: "tag-1",
      calendar_id: "cal-1",
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
        calendarId: "cal-1",
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
      calendar_id: "cal-1",
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
