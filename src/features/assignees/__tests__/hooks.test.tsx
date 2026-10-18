import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { listEventAssigneeIds, setEventAssignees } from "../service";
import { useEventAssignees, useSetEventAssignees } from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  listEventAssigneeIds: jest.fn(),
  setEventAssignees: jest.fn(),
}));

beforeEach(() => {
  (getSupabaseClient as jest.Mock).mockReturnValue({});
});
afterEach(() => jest.clearAllMocks());

describe("useEventAssignees", () => {
  it("loads the assignee ids of the event", async () => {
    (listEventAssigneeIds as jest.Mock).mockResolvedValue({ ok: true, value: ["user-1"] });

    const { result } = await renderHook(() => useEventAssignees("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.assigneeIds).toEqual(["user-1"]);
    expect(listEventAssigneeIds).toHaveBeenCalledWith({}, "event-1");
  });

  it("is empty with an error when loading fails", async () => {
    (listEventAssigneeIds as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useEventAssignees("event-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.assigneeIds).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useSetEventAssignees", () => {
  it("returns true when saving succeeds", async () => {
    (setEventAssignees as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useSetEventAssignees());

    let success = false;
    await act(async () => {
      success = await result.current.setEventAssignees("event-1", ["user-1"]);
    });

    expect(success).toBe(true);
    expect(setEventAssignees).toHaveBeenCalledWith({}, "event-1", ["user-1"]);
  });

  it("returns false and sets the error when saving fails", async () => {
    (setEventAssignees as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useSetEventAssignees());

    let success = true;
    await act(async () => {
      success = await result.current.setEventAssignees("event-1", ["user-1"]);
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
