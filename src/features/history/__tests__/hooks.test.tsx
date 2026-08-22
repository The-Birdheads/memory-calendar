import { renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { listPastEventsByTag } from "../service";
import { usePastEventsByTag } from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  listPastEventsByTag: jest.fn(),
}));

describe("usePastEventsByTag", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads past events for the given calendar on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const events = [{ id: "event-1", calendarId: "cal-1", title: "先週の集まり" }];
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: events });

    const { result } = await renderHook(() => usePastEventsByTag("cal-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual(events);
    expect(listPastEventsByTag).toHaveBeenCalledWith({}, "cal-1", undefined);
  });

  it("passes the tag id filter through to the service", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result } = await renderHook(() => usePastEventsByTag("cal-1", "tag-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listPastEventsByTag).toHaveBeenCalledWith({}, "cal-1", "tag-1");
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => usePastEventsByTag("cal-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("reloads when the selected tag id changes", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result, rerender } = await renderHook(
      ({ tagId }: { tagId?: string }) => usePastEventsByTag("cal-1", tagId),
      { initialProps: { tagId: undefined } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await rerender({ tagId: "tag-2" });

    await waitFor(() =>
      expect(listPastEventsByTag).toHaveBeenLastCalledWith({}, "cal-1", "tag-2")
    );
  });
});
