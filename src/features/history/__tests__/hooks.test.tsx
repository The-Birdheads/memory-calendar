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

  it("loads past events across all of the caller's calendars on mount, with no filters", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const events = [{ id: "event-1", calendarId: "cal-1", title: "先週の集まり" }];
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: events });

    const { result } = await renderHook(() => usePastEventsByTag());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual(events);
    expect(listPastEventsByTag).toHaveBeenCalledWith({}, undefined, undefined);
  });

  it("passes the tag id filter through to the service", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result } = await renderHook(() => usePastEventsByTag("tag-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listPastEventsByTag).toHaveBeenCalledWith({}, "tag-1", undefined);
  });

  it("passes an additional calendar filter through to the service when given", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result } = await renderHook(() => usePastEventsByTag("tag-1", ["cal-1", "cal-2"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listPastEventsByTag).toHaveBeenCalledWith({}, "tag-1", ["cal-1", "cal-2"]);
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => usePastEventsByTag());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });

  it("reloads when the selected tag id changes", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result, rerender } = await renderHook(
      ({ tagId }: { tagId?: string }) => usePastEventsByTag(tagId),
      { initialProps: { tagId: undefined } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await rerender({ tagId: "tag-2" });

    await waitFor(() =>
      expect(listPastEventsByTag).toHaveBeenLastCalledWith({}, "tag-2", undefined)
    );
  });

  it("reloads when the selected calendar filter changes", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listPastEventsByTag as jest.Mock).mockResolvedValue({ ok: true, value: [] });

    const { result, rerender } = await renderHook(
      ({ calendarIds }: { calendarIds?: string[] }) => usePastEventsByTag("tag-1", calendarIds),
      { initialProps: { calendarIds: undefined } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await rerender({ calendarIds: ["cal-2"] });

    await waitFor(() =>
      expect(listPastEventsByTag).toHaveBeenLastCalledWith({}, "tag-1", ["cal-2"])
    );
  });
});
