import type { SupabaseClient } from "@supabase/supabase-js";

import { listEventAssigneeIds, setEventAssignees } from "../service";

function makeClient(options: {
  current?: string[];
  listError?: unknown;
  deleteError?: unknown;
  insertError?: unknown;
}) {
  const listEq = jest.fn().mockResolvedValue({
    data: options.listError ? null : (options.current ?? []).map((user_id) => ({ user_id })),
    error: options.listError ?? null,
  });
  const select = jest.fn().mockReturnValue({ eq: listEq });
  const deleteIn = jest.fn().mockResolvedValue({ error: options.deleteError ?? null });
  const deleteEq = jest.fn().mockReturnValue({ in: deleteIn });
  const del = jest.fn().mockReturnValue({ eq: deleteEq });
  const insert = jest.fn().mockResolvedValue({ error: options.insertError ?? null });
  const from = jest.fn().mockReturnValue({ select, delete: del, insert });
  return { client: { from } as unknown as SupabaseClient, from, select, listEq, del, deleteEq, deleteIn, insert };
}

describe("listEventAssigneeIds", () => {
  it("returns the user ids assigned to the event", async () => {
    const { client, from, select, listEq } = makeClient({ current: ["user-1", "user-2"] });

    const result = await listEventAssigneeIds(client, "event-1");

    expect(result).toEqual({ ok: true, value: ["user-1", "user-2"] });
    expect(from).toHaveBeenCalledWith("event_assignees");
    expect(select).toHaveBeenCalledWith("user_id");
    expect(listEq).toHaveBeenCalledWith("event_id", "event-1");
  });

  it("maps a database error to Forbidden", async () => {
    const { client } = makeClient({ listError: { message: "denied", code: "42501" } });

    const result = await listEventAssigneeIds(client, "event-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("setEventAssignees", () => {
  it("inserts the newly chosen people and removes the unchosen ones, leaving the rest alone", async () => {
    const { client, del, deleteEq, deleteIn, insert } = makeClient({ current: ["user-1", "user-2"] });

    const result = await setEventAssignees(client, "event-1", ["user-2", "user-3"]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(del).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("event_id", "event-1");
    expect(deleteIn).toHaveBeenCalledWith("user_id", ["user-1"]);
    expect(insert).toHaveBeenCalledWith([{ event_id: "event-1", user_id: "user-3" }]);
  });

  it("does not touch the database when nothing changed", async () => {
    const { client, del, insert } = makeClient({ current: ["user-1"] });

    const result = await setEventAssignees(client, "event-1", ["user-1"]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(del).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("clears every assignee when given an empty list", async () => {
    const { client, deleteIn, insert } = makeClient({ current: ["user-1", "user-2"] });

    await setEventAssignees(client, "event-1", []);

    expect(deleteIn).toHaveBeenCalledWith("user_id", ["user-1", "user-2"]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("de-duplicates the given ids", async () => {
    const { client, insert } = makeClient({ current: [] });

    await setEventAssignees(client, "event-1", ["user-1", "user-1"]);

    expect(insert).toHaveBeenCalledWith([{ event_id: "event-1", user_id: "user-1" }]);
  });

  it("returns Forbidden and does not insert when removing fails", async () => {
    const { client, insert } = makeClient({ current: ["user-1"], deleteError: { code: "42501" } });

    const result = await setEventAssignees(client, "event-1", ["user-2"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns Forbidden when inserting fails", async () => {
    const { client } = makeClient({ current: [], insertError: { code: "42501" } });

    const result = await setEventAssignees(client, "event-1", ["user-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });

  it("returns Forbidden when the current assignees can't be read", async () => {
    const { client } = makeClient({ listError: { code: "42501" } });

    const result = await setEventAssignees(client, "event-1", ["user-1"]);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});
