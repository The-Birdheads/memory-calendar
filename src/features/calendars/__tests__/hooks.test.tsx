import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { listMembers, listMyCalendars, removeMember } from "../service";
import { useCalendarMembers, useMyCalendars, useRemoveMember } from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  listMyCalendars: jest.fn(),
  listMembers: jest.fn(),
  removeMember: jest.fn(),
}));

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
