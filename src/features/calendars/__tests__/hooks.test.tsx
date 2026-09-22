import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import {
  createCalendar,
  createInvite,
  getPersonalCalendar,
  joinByInvite,
  leaveOrDeleteCalendar,
  listMembers,
  listMembersForCalendars,
  listMyCalendars,
  removeMember,
  updateCalendar,
} from "../service";
import {
  useCalendarMembers,
  useCalendarMembersByCalendars,
  useCreateCalendar,
  useCreateInvite,
  useJoinByInvite,
  useLeaveOrDeleteCalendar,
  useMyCalendars,
  usePersonalCalendar,
  useRemoveMember,
  useUpdateCalendar,
} from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  listMyCalendars: jest.fn(),
  listMembers: jest.fn(),
  listMembersForCalendars: jest.fn(),
  removeMember: jest.fn(),
  createCalendar: jest.fn(),
  updateCalendar: jest.fn(),
  createInvite: jest.fn(),
  joinByInvite: jest.fn(),
  getPersonalCalendar: jest.fn(),
  leaveOrDeleteCalendar: jest.fn(),
}));

describe("useCreateCalendar", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the created calendar and clears the error when creation succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createCalendar as jest.Mock).mockResolvedValue({ ok: true, value: { id: "cal-1" } });

    const { result } = await renderHook(() => useCreateCalendar());

    let created: { id: string } | null = null;
    await act(async () => {
      created = await result.current.createCalendar({ name: "我が家" });
    });

    expect(created).toEqual({ id: "cal-1" });
    expect(result.current.error).toBeNull();
    expect(createCalendar).toHaveBeenCalledWith({}, { name: "我が家" });
  });

  it("returns null and sets the error when creation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createCalendar as jest.Mock).mockResolvedValue({ ok: false, error: { type: "ValidationError", field: "name" } });

    const { result } = await renderHook(() => useCreateCalendar());

    let created: { id: string } | null = { id: "should-be-cleared" };
    await act(async () => {
      created = await result.current.createCalendar({ name: "" });
    });

    expect(created).toBeNull();
    expect(result.current.error).toEqual({ type: "ValidationError", field: "name" });
  });
});

describe("useUpdateCalendar", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when the update succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateCalendar as jest.Mock).mockResolvedValue({ ok: true, value: { id: "cal-1" } });

    const { result } = await renderHook(() => useUpdateCalendar());

    let success = false;
    await act(async () => {
      success = await result.current.updateCalendar("cal-1", { name: "改名後" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(updateCalendar).toHaveBeenCalledWith({}, "cal-1", { name: "改名後" });
  });

  it("returns false and sets the error when the update fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateCalendar as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useUpdateCalendar());

    let success = true;
    await act(async () => {
      success = await result.current.updateCalendar("cal-1", { name: "改名後" });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useCreateInvite", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the invite code when creation succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createInvite as jest.Mock).mockResolvedValue({
      ok: true,
      value: { id: "invite-1", calendarId: "cal-1", code: "ABC123", expiresAt: "2026-09-01T00:00:00.000Z", createdBy: "u1", createdAt: "2026-08-22T00:00:00.000Z" },
    });

    const { result } = await renderHook(() => useCreateInvite());

    let invite;
    await act(async () => {
      invite = await result.current.createInvite("cal-1");
    });

    expect(invite).toEqual({ id: "invite-1", calendarId: "cal-1", code: "ABC123", expiresAt: "2026-09-01T00:00:00.000Z", createdBy: "u1", createdAt: "2026-08-22T00:00:00.000Z" });
    expect(result.current.error).toBeNull();
    expect(createInvite).toHaveBeenCalledWith({}, "cal-1");
  });

  it("returns null and sets the error when creation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createInvite as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useCreateInvite());

    let invite;
    await act(async () => {
      invite = await result.current.createInvite("cal-1");
    });

    expect(invite).toBeNull();
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useJoinByInvite", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when joining succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (joinByInvite as jest.Mock).mockResolvedValue({ ok: true, value: { calendarId: "cal-1", userId: "u2", role: "viewer", joinedAt: "2026-08-22T00:00:00.000Z" } });

    const { result } = await renderHook(() => useJoinByInvite());

    let success = false;
    await act(async () => {
      success = await result.current.joinByInvite("ABC123");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(joinByInvite).toHaveBeenCalledWith({}, "ABC123");
  });

  it("returns false and sets the error when the invite is expired", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (joinByInvite as jest.Mock).mockResolvedValue({ ok: false, error: { type: "InviteExpired" } });

    const { result } = await renderHook(() => useJoinByInvite());

    let success = true;
    await act(async () => {
      success = await result.current.joinByInvite("EXPIRED");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "InviteExpired" });
  });
});

describe("useMyCalendars", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the caller's calendars on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const calendars = [{ id: "cal-1", name: "我が家", createdBy: "u1", createdAt: "2026-08-17" }];
    (listMyCalendars as jest.Mock).mockResolvedValue({ ok: true, value: calendars });

    const { result } = await renderHook(() => useMyCalendars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendars).toEqual(calendars);
  });

  it("keeps an empty list when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMyCalendars as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useMyCalendars());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendars).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("usePersonalCalendar", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the caller's personal calendar on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const calendar = { id: "cal-personal", name: "Myカレンダー", kind: "personal", createdBy: "u1", createdAt: "2026-08-17" };
    (getPersonalCalendar as jest.Mock).mockResolvedValue({ ok: true, value: calendar });

    const { result } = await renderHook(() => usePersonalCalendar());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toEqual(calendar);
    expect(result.current.error).toBeNull();
  });

  it("keeps the calendar null and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (getPersonalCalendar as jest.Mock).mockResolvedValue({ ok: false, error: { type: "NotFound" } });

    const { result } = await renderHook(() => usePersonalCalendar());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toBeNull();
    expect(result.current.error).toEqual({ type: "NotFound" });
  });
});

describe("useCalendarMembers", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads members for the given calendar", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const members = [
      { calendarId: "cal-1", userId: "u1", role: "owner", joinedAt: "2026-08-17" },
      { calendarId: "cal-1", userId: "u2", role: "viewer", joinedAt: "2026-08-17" },
    ];
    (listMembers as jest.Mock).mockResolvedValue({ ok: true, value: members });

    const { result } = await renderHook(() => useCalendarMembers("cal-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toEqual(members);
    expect(listMembers).toHaveBeenCalledWith({}, "cal-1");
  });

  it("removes a member from the local list immediately after a successful refetch", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const members = [
      { calendarId: "cal-1", userId: "u1", role: "owner", joinedAt: "2026-08-17" },
      { calendarId: "cal-1", userId: "u2", role: "viewer", joinedAt: "2026-08-17" },
    ];
    (listMembers as jest.Mock)
      .mockResolvedValueOnce({ ok: true, value: members })
      .mockResolvedValueOnce({ ok: true, value: [members[0]] });

    const { result } = await renderHook(() => useCalendarMembers("cal-1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toHaveLength(2);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.members).toEqual([members[0]]);
  });

  it("refetches when a member is added/removed for this calendar, and when any profile's display name changes (regression: renaming your account didn't update '◯◯さんが追加' until the screen was freshly remounted)", async () => {
    const channel = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = { channel: jest.fn(() => channel) };
    (getSupabaseClient as jest.Mock).mockReturnValue(client);
    (listMembers as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    await renderHook(() => useCalendarMembers("cal-1"));

    await waitFor(() => expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^calendar-members-cal-1-/)));
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "calendar_members", filter: "calendar_id=eq.cal-1" },
      expect.any(Function)
    );
    expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^calendar-members-profiles-/));
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      expect.any(Function)
    );

    const profilesOnChange = channel.on.mock.calls.find(
      (call) => call[1].table === "profiles"
    )?.[2];
    (listMembers as jest.Mock).mockClear();
    await act(async () => {
      await profilesOnChange();
    });

    expect(listMembers).toHaveBeenCalledWith(client, "cal-1");
  });
});

describe("useCalendarMembersByCalendars", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads members across the given calendars", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const members = [
      { calendarId: "cal-1", userId: "u1", role: "owner", joinedAt: "2026-08-17", displayName: "たろう" },
      { calendarId: "cal-2", userId: "u2", role: "owner", joinedAt: "2026-08-17", displayName: "はなこ" },
    ];
    (listMembersForCalendars as jest.Mock).mockResolvedValue({ ok: true, value: members });

    const { result } = await renderHook(() => useCalendarMembersByCalendars(["cal-1", "cal-2"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toEqual(members);
    expect(listMembersForCalendars).toHaveBeenCalledWith({}, ["cal-1", "cal-2"]);
  });

  it("returns an empty list when given no calendar ids", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMembersForCalendars as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result } = await renderHook(() => useCalendarMembersByCalendars([]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.members).toEqual([]);
  });

  it("reloads when the set of calendar ids changes", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMembersForCalendars as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { rerender } = await renderHook(
      ({ ids }: { ids: string[] }) => useCalendarMembersByCalendars(ids),
      { initialProps: { ids: ["cal-1"] } }
    );
    await waitFor(() => expect(listMembersForCalendars).toHaveBeenCalledWith({}, ["cal-1"]));

    await rerender({ ids: ["cal-1", "cal-2"] });

    await waitFor(() => expect(listMembersForCalendars).toHaveBeenLastCalledWith({}, ["cal-1", "cal-2"]));
  });

  it("refetches when any profile's display name changes (regression: same as useCalendarMembers)", async () => {
    const channel = { on: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = { channel: jest.fn(() => channel) };
    (getSupabaseClient as jest.Mock).mockReturnValue(client);
    (listMembersForCalendars as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    await renderHook(() => useCalendarMembersByCalendars(["cal-1", "cal-2"]));

    await waitFor(() =>
      expect(channel.on).toHaveBeenCalledWith(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        expect.any(Function)
      )
    );
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "calendar_members", filter: "calendar_id=eq.cal-1" },
      expect.any(Function)
    );
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "calendar_members", filter: "calendar_id=eq.cal-2" },
      expect.any(Function)
    );

    const profilesOnChange = channel.on.mock.calls.find((call) => call[1].table === "profiles")?.[2];
    (listMembersForCalendars as jest.Mock).mockClear();
    await act(async () => {
      await profilesOnChange();
    });

    expect(listMembersForCalendars).toHaveBeenCalledWith(client, ["cal-1", "cal-2"]);
  });
});

describe("useRemoveMember", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when removal succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (removeMember as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useRemoveMember());

    let success = false;
    await act(async () => {
      success = await result.current.removeMember("cal-1", "u2");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(removeMember).toHaveBeenCalledWith({}, "cal-1", "u2");
  });

  it("returns false and sets the error when removal fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (removeMember as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useRemoveMember());

    let success = true;
    await act(async () => {
      success = await result.current.removeMember("cal-1", "u2");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useLeaveOrDeleteCalendar", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the result and clears the error on success", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (leaveOrDeleteCalendar as jest.Mock).mockResolvedValue({ ok: true, value: false });

    const { result } = await renderHook(() => useLeaveOrDeleteCalendar());

    let deleted: boolean | null = null;
    await act(async () => {
      deleted = await result.current.leaveOrDeleteCalendar("cal-1");
    });

    expect(deleted).toBe(false);
    expect(result.current.error).toBeNull();
    expect(leaveOrDeleteCalendar).toHaveBeenCalledWith({}, "cal-1");
  });

  it("returns null and sets the error on failure", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (leaveOrDeleteCalendar as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useLeaveOrDeleteCalendar());

    let deleted: boolean | null = false;
    await act(async () => {
      deleted = await result.current.leaveOrDeleteCalendar("cal-1");
    });

    expect(deleted).toBeNull();
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
