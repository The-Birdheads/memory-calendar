import { createFakeSupabaseClient } from "../fakeSupabaseClient";

describe("createFakeSupabaseClient", () => {
  it("inserts a row and returns it via single()", async () => {
    const client = createFakeSupabaseClient();

    const { data, error } = await (client.from("events") as any)
      .insert({ calendar_id: "cal-1", title: "誕生日会" })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ calendar_id: "cal-1", title: "誕生日会" });
    expect(data.id).toBeTruthy();
  });

  it("filters rows with eq/lte/gte and orders the result", async () => {
    const client = createFakeSupabaseClient({
      events: [
        { id: "e1", calendar_id: "cal-1", start_at: "2026-09-05", end_at: "2026-09-05" },
        { id: "e2", calendar_id: "cal-1", start_at: "2026-09-01", end_at: "2026-09-01" },
        { id: "e3", calendar_id: "cal-2", start_at: "2026-09-02", end_at: "2026-09-02" },
      ],
    });

    const { data } = await (client.from("events") as any)
      .select()
      .eq("calendar_id", "cal-1")
      .lte("start_at", "2026-09-10")
      .gte("end_at", "2026-09-01")
      .order("start_at", { ascending: true });

    expect(data.map((row: any) => row.id)).toEqual(["e2", "e1"]);
  });

  it("filters rows with is(column, null) for orphaned-style lookups", async () => {
    const client = createFakeSupabaseClient({
      todos: [
        { id: "t1", event_id: "e1" },
        { id: "t2", event_id: null },
      ],
    });

    const { data } = await (client.from("todos") as any).select().is("event_id", null);

    expect(data.map((row: any) => row.id)).toEqual(["t2"]);
  });

  it("updates matching rows", async () => {
    const client = createFakeSupabaseClient({ todos: [{ id: "t1", is_done: false }] });

    const { data } = await (client.from("todos") as any)
      .update({ is_done: true })
      .eq("id", "t1")
      .select()
      .single();

    expect(data.is_done).toBe(true);
  });

  it("deletes matching rows and cascades to dependent tables", async () => {
    const client = createFakeSupabaseClient({
      events: [{ id: "e1", calendar_id: "cal-1" }],
      event_comments: [{ id: "c1", event_id: "e1" }],
    });

    await (client.from("events") as any).delete().eq("id", "e1");

    expect(client.getTable("events")).toEqual([]);
    expect(client.getTable("event_comments")).toEqual([]);
  });

  it("sets the foreign key to null on dependent todos instead of deleting them", async () => {
    const client = createFakeSupabaseClient({
      events: [{ id: "e1", calendar_id: "cal-1" }],
      todos: [{ id: "t1", event_id: "e1" }],
    });

    await (client.from("events") as any).delete().eq("id", "e1");

    expect(client.getTable("todos")).toEqual([{ id: "t1", event_id: null }]);
  });

  it("allows rpc and storage to be mocked per test", async () => {
    const client = createFakeSupabaseClient();
    client.rpc.mockResolvedValue({ data: [{ id: "e1" }], error: null });

    const { data } = await client.rpc("create_recurring_series", {});

    expect(data).toEqual([{ id: "e1" }]);
    expect(client.storage.from("event-photos")).toBeTruthy();
  });
});
