import type { SupabaseClient } from "@supabase/supabase-js";

import { addReaction, deleteComment, listComments, listReactions, postComment } from "../service";

describe("postComment", () => {
  it("posts a comment and returns it with the author and posted time on success", async () => {
    const row = {
      id: "comment-1",
      event_id: "event-1",
      user_id: "user-1",
      body: "楽しみですね!",
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await postComment(client, "event-1", "楽しみですね!");

    expect(result).toEqual({
      ok: true,
      value: {
        id: "comment-1",
        eventId: "event-1",
        userId: "user-1",
        body: "楽しみですね!",
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("event_comments");
    expect(insert).toHaveBeenCalledWith({ event_id: "event-1", body: "楽しみですね!" });
  });

  it("returns a ValidationError without calling Supabase when the body is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await postComment(client, "event-1", "   ");

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "body" } });
    expect(client.from).not.toHaveBeenCalled();
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

    const result = await postComment(client, "event-1", "コメント");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listComments", () => {
  it("returns the comments for the given event ordered by posted time", async () => {
    const rows = [
      {
        id: "comment-1",
        event_id: "event-1",
        user_id: "user-1",
        body: "楽しみですね!",
        created_at: "2026-08-18T00:00:00.000Z",
      },
      {
        id: "comment-2",
        event_id: "event-1",
        user_id: "user-2",
        body: "了解です",
        created_at: "2026-08-18T01:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    const result = await listComments(client, "event-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "comment-1",
          eventId: "event-1",
          userId: "user-1",
          body: "楽しみですね!",
          createdAt: "2026-08-18T00:00:00.000Z",
        },
        {
          id: "comment-2",
          eventId: "event-1",
          userId: "user-2",
          body: "了解です",
          createdAt: "2026-08-18T01:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("event_comments");
    expect(eq).toHaveBeenCalledWith("event_id", "event-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
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

    const result = await listComments(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("deleteComment", () => {
  it("deletes the given comment", async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteComment(client, "comment-1");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("event_comments");
    expect(eq).toHaveBeenCalledWith("id", "comment-1");
  });

  it("maps a permission error to Forbidden when the caller is not the author", async () => {
    const eq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const del = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await deleteComment(client, "comment-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("addReaction", () => {
  it("adds a reaction and returns it with the author and posted time on success", async () => {
    const row = {
      id: "reaction-1",
      event_id: "event-1",
      user_id: "user-1",
      stamp_type: "👍",
      created_at: "2026-08-18T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await addReaction(client, "event-1", "👍");

    expect(result).toEqual({
      ok: true,
      value: {
        id: "reaction-1",
        eventId: "event-1",
        userId: "user-1",
        stampType: "👍",
        createdAt: "2026-08-18T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("event_reactions");
    expect(insert).toHaveBeenCalledWith({ event_id: "event-1", stamp_type: "👍" });
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

    const result = await addReaction(client, "event-1", "👍");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listReactions", () => {
  it("returns the reactions for the given event", async () => {
    const rows = [
      {
        id: "reaction-1",
        event_id: "event-1",
        user_id: "user-1",
        stamp_type: "👍",
        created_at: "2026-08-18T00:00:00.000Z",
      },
    ];
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select, eq, order }),
    } as unknown as SupabaseClient;

    const result = await listReactions(client, "event-1");

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "reaction-1",
          eventId: "event-1",
          userId: "user-1",
          stampType: "👍",
          createdAt: "2026-08-18T00:00:00.000Z",
        },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("event_reactions");
    expect(eq).toHaveBeenCalledWith("event_id", "event-1");
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

    const result = await listReactions(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
