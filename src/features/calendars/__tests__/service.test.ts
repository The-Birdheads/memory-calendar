import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createCalendar,
  createInvite,
  getCalendarErrorMessageJa,
  getPersonalCalendar,
  joinByInvite,
  leaveOrDeleteCalendar,
  listMembers,
  listMyCalendars,
  removeMember,
  updateCalendar,
} from "../service";

function createMockClient(fromOverrides: Record<string, jest.Mock> = {}): SupabaseClient {
  return {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
      ...fromOverrides,
    }),
  } as unknown as SupabaseClient;
}

describe("createCalendar", () => {
  it("always creates a group calendar, ignoring any other kind, and returns it on success", async () => {
    const row = {
      id: "cal-1",
      name: "我が家",
      kind: "group",
      color: "#2f6fed",
      created_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createCalendar(client, { name: "我が家" });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "cal-1",
        name: "我が家",
        kind: "group",
        color: "#2f6fed",
        createdBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("calendars");
    expect(insert).toHaveBeenCalledWith({ name: "我が家", kind: "group" });
  });

  it("passes the given color through to the insert when provided", async () => {
    const row = {
      id: "cal-1",
      name: "我が家",
      kind: "group",
      color: "#e53935",
      created_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createCalendar(client, { name: "我が家", color: "#e53935" });

    expect(result.ok && result.value.color).toBe("#e53935");
    expect(insert).toHaveBeenCalledWith({ name: "我が家", kind: "group", color: "#e53935" });
  });

  it("returns a ValidationError without calling Supabase when the name is empty", async () => {
    const client = createMockClient();

    const result = await createCalendar(client, { name: "   " });

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "name" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a check constraint violation to a ValidationError", async () => {
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "check constraint violated", code: "23514" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createCalendar(client, { name: "我が家" });

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "name" } });
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

    const result = await createCalendar(client, { name: "我が家" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("getPersonalCalendar", () => {
  it("returns the caller's personal calendar on success", async () => {
    const row = {
      id: "cal-personal",
      name: "Myカレンダー",
      kind: "personal",
      color: "#2f6fed",
      created_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
    };
    const eq = jest.fn().mockReturnThis();
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ eq, maybeSingle });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await getPersonalCalendar(client);

    expect(result).toEqual({
      ok: true,
      value: {
        id: "cal-personal",
        name: "Myカレンダー",
        kind: "personal",
        color: "#2f6fed",
        createdBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("calendars");
    expect(eq).toHaveBeenCalledWith("kind", "personal");
  });

  it("returns NotFound when the caller has no personal calendar", async () => {
    const eq = jest.fn().mockReturnThis();
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ eq, maybeSingle });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await getPersonalCalendar(client);

    expect(result).toEqual({ ok: false, error: { type: "NotFound" } });
  });

  it("maps a Supabase error to Forbidden", async () => {
    const eq = jest.fn().mockReturnThis();
    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "network down", code: "500" },
    });
    const select = jest.fn().mockReturnValue({ eq, maybeSingle });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await getPersonalCalendar(client);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("createInvite", () => {
  it("creates an invite for the given calendar and returns it on success", async () => {
    const row = {
      id: "invite-1",
      calendar_id: "cal-1",
      code: "abc-123",
      expires_at: "2026-08-24T00:00:00.000Z",
      created_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
    };
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createInvite(client, "cal-1");

    expect(result).toEqual({
      ok: true,
      value: {
        id: "invite-1",
        calendarId: "cal-1",
        code: "abc-123",
        expiresAt: "2026-08-24T00:00:00.000Z",
        createdBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("calendar_invites");
    expect(insert).toHaveBeenCalledWith({ calendar_id: "cal-1" });
  });

  it("maps an RLS/permission error to Forbidden when the caller is not owner/editor", async () => {
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ insert, select, single }),
    } as unknown as SupabaseClient;

    const result = await createInvite(client, "cal-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("joinByInvite", () => {
  it("joins the calendar and returns the new membership on success", async () => {
    const row = {
      calendar_id: "cal-1",
      user_id: "user-2",
      role: "viewer",
      joined_at: "2026-08-17T00:00:00.000Z",
    };
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      rpc: jest.fn().mockReturnValue({ single }),
    } as unknown as SupabaseClient;

    const result = await joinByInvite(client, "abc-123");

    expect(result).toEqual({
      ok: true,
      value: { calendarId: "cal-1", userId: "user-2", role: "viewer", joinedAt: "2026-08-17T00:00:00.000Z", displayName: null },
    });
    expect(client.rpc).toHaveBeenCalledWith("join_by_invite", { p_code: "abc-123" });
  });

  it("maps an unknown invite code to NotFound", async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "invite_not_found", code: "A0001" },
    });
    const client = {
      rpc: jest.fn().mockReturnValue({ single }),
    } as unknown as SupabaseClient;

    const result = await joinByInvite(client, "does-not-exist");

    expect(result).toEqual({ ok: false, error: { type: "NotFound" } });
  });

  it("maps an expired invite to InviteExpired", async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "invite_expired", code: "A0002" },
    });
    const client = {
      rpc: jest.fn().mockReturnValue({ single }),
    } as unknown as SupabaseClient;

    const result = await joinByInvite(client, "expired-code");

    expect(result).toEqual({ ok: false, error: { type: "InviteExpired" } });
  });
});

describe("leaveOrDeleteCalendar", () => {
  it("returns false when the caller just left the calendar", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as SupabaseClient;

    const result = await leaveOrDeleteCalendar(client, "cal-1");

    expect(result).toEqual({ ok: true, value: false });
    expect(client.rpc).toHaveBeenCalledWith("leave_or_delete_calendar", { p_calendar_id: "cal-1" });
  });

  it("returns true when the calendar itself was deleted", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    } as unknown as SupabaseClient;

    const result = await leaveOrDeleteCalendar(client, "cal-1");

    expect(result).toEqual({ ok: true, value: true });
  });

  it("maps an unknown calendar to NotFound", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "calendar_not_found", code: "A0001" } }),
    } as unknown as SupabaseClient;

    const result = await leaveOrDeleteCalendar(client, "does-not-exist");

    expect(result).toEqual({ ok: false, error: { type: "NotFound" } });
  });

  it("maps a permission error to Forbidden", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "not_a_member", code: "P0001" } }),
    } as unknown as SupabaseClient;

    const result = await leaveOrDeleteCalendar(client, "cal-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listMyCalendars", () => {
  it("returns the calendars the caller belongs to", async () => {
    const rows = [
      { id: "cal-1", name: "我が家", kind: "group", color: "#2f6fed", created_by: "user-1", created_at: "2026-08-17T00:00:00.000Z" },
      { id: "cal-2", name: "自分用", kind: "personal", color: "#e53935", created_by: "user-2", created_at: "2026-08-17T01:00:00.000Z" },
    ];
    const select = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await listMyCalendars(client);

    // The personal calendar is sorted first regardless of row order, so it
    // reads as "always there first" wherever the list is rendered.
    expect(result).toEqual({
      ok: true,
      value: [
        { id: "cal-2", name: "自分用", kind: "personal", color: "#e53935", createdBy: "user-2", createdAt: "2026-08-17T01:00:00.000Z" },
        { id: "cal-1", name: "我が家", kind: "group", color: "#2f6fed", createdBy: "user-1", createdAt: "2026-08-17T00:00:00.000Z" },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("calendars");
  });

  it("sorts the personal calendar first even when it isn't the first row returned", async () => {
    const rows = [
      { id: "cal-1", name: "我が家", kind: "group", color: "#2f6fed", created_by: "user-1", created_at: "2026-08-17T00:00:00.000Z" },
      { id: "cal-2", name: "友人グループ", kind: "group", color: "#43a047", created_by: "user-1", created_at: "2026-08-17T01:00:00.000Z" },
      { id: "cal-3", name: "自分用", kind: "personal", color: "#e53935", created_by: "user-1", created_at: "2026-08-17T02:00:00.000Z" },
    ];
    const select = jest.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await listMyCalendars(client);

    expect(result.ok && result.value.map((calendar) => calendar.id)).toEqual(["cal-3", "cal-1", "cal-2"]);
  });

  it("maps a Supabase error to Forbidden", async () => {
    const select = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "network down", code: "500" },
    });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await listMyCalendars(client);

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("listMembers", () => {
  it("returns the members of the given calendar, including each member's display name", async () => {
    const rows = [
      {
        calendar_id: "cal-1",
        user_id: "user-1",
        role: "owner",
        joined_at: "2026-08-17T00:00:00.000Z",
        profiles: { display_name: "たろう" },
      },
      {
        calendar_id: "cal-1",
        user_id: "user-2",
        role: "viewer",
        joined_at: "2026-08-17T01:00:00.000Z",
        profiles: { display_name: null },
      },
    ];
    const eq = jest.fn().mockResolvedValue({ data: rows, error: null });
    const select = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await listMembers(client, "cal-1");

    expect(result).toEqual({
      ok: true,
      value: [
        { calendarId: "cal-1", userId: "user-1", role: "owner", joinedAt: "2026-08-17T00:00:00.000Z", displayName: "たろう" },
        { calendarId: "cal-1", userId: "user-2", role: "viewer", joinedAt: "2026-08-17T01:00:00.000Z", displayName: null },
      ],
    });
    expect(client.from).toHaveBeenCalledWith("calendar_members");
    expect(select).toHaveBeenCalledWith("*, profiles(display_name)");
    expect(eq).toHaveBeenCalledWith("calendar_id", "cal-1");
  });

  it("maps a Supabase error to Forbidden", async () => {
    const eq = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "network down", code: "500" },
    });
    const select = jest.fn().mockReturnValue({ eq });
    const client = {
      from: jest.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient;

    const result = await listMembers(client, "cal-1");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("removeMember", () => {
  it("removes the given member from the calendar", async () => {
    const secondEq = jest.fn().mockResolvedValue({ error: null });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const del = jest.fn().mockReturnValue({ eq: firstEq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await removeMember(client, "cal-1", "user-2");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(client.from).toHaveBeenCalledWith("calendar_members");
    expect(firstEq).toHaveBeenCalledWith("calendar_id", "cal-1");
    expect(secondEq).toHaveBeenCalledWith("user_id", "user-2");
  });

  it("maps a permission error to Forbidden when the caller is not the owner", async () => {
    const secondEq = jest.fn().mockResolvedValue({
      error: { message: "permission denied", code: "42501" },
    });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const del = jest.fn().mockReturnValue({ eq: firstEq });
    const client = {
      from: jest.fn().mockReturnValue({ delete: del }),
    } as unknown as SupabaseClient;

    const result = await removeMember(client, "cal-1", "user-2");

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("updateCalendar", () => {
  it("updates the calendar name and returns it on success", async () => {
    const row = {
      id: "cal-1",
      name: "改名後",
      kind: "group",
      color: "#2f6fed",
      created_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
    };
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateCalendar(client, "cal-1", { name: "改名後" });

    expect(result).toEqual({
      ok: true,
      value: {
        id: "cal-1",
        name: "改名後",
        kind: "group",
        color: "#2f6fed",
        createdBy: "user-1",
        createdAt: "2026-08-17T00:00:00.000Z",
      },
    });
    expect(client.from).toHaveBeenCalledWith("calendars");
    expect(update).toHaveBeenCalledWith({ name: "改名後" });
    expect(eq).toHaveBeenCalledWith("id", "cal-1");
  });

  it("updates the calendar's color and returns it on success", async () => {
    const row = {
      id: "cal-1",
      name: "我が家",
      kind: "group",
      color: "#43a047",
      created_by: "user-1",
      created_at: "2026-08-17T00:00:00.000Z",
    };
    const update = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const client = {
      from: jest.fn().mockReturnValue({ update, eq, select, single }),
    } as unknown as SupabaseClient;

    const result = await updateCalendar(client, "cal-1", { color: "#43a047" });

    expect(result.ok && result.value.color).toBe("#43a047");
    expect(update).toHaveBeenCalledWith({ color: "#43a047" });
  });

  it("returns a ValidationError without calling Supabase when the new name is empty", async () => {
    const client = { from: jest.fn() } as unknown as SupabaseClient;

    const result = await updateCalendar(client, "cal-1", { name: "   " });

    expect(result).toEqual({ ok: false, error: { type: "ValidationError", field: "name" } });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps a permission error to Forbidden when the caller is not the owner", async () => {
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

    const result = await updateCalendar(client, "cal-1", { name: "改名後" });

    expect(result).toEqual({ ok: false, error: { type: "Forbidden" } });
  });
});

describe("getCalendarErrorMessageJa", () => {
  it("returns a Japanese message for each known error type", () => {
    expect(getCalendarErrorMessageJa({ type: "NotFound" })).toContain("見つかりません");
    expect(getCalendarErrorMessageJa({ type: "Forbidden" })).toContain("権限がありません");
    expect(getCalendarErrorMessageJa({ type: "InviteExpired" })).toContain("有効期限");
    expect(getCalendarErrorMessageJa({ type: "ValidationError", field: "name" })).toContain(
      "カレンダー名"
    );
  });
});
