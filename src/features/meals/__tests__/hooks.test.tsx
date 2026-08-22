import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import {
  createMealRecord,
  createMealTag,
  deleteMealRecord,
  listMealRecords,
  updateMealRecord,
} from "../service";
import {
  useCreateMealRecord,
  useCreateMealTag,
  useDeleteMealRecord,
  useMealRecords,
  useUpdateMealRecord,
} from "../hooks";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  createMealRecord: jest.fn(),
  createMealTag: jest.fn(),
  listMealRecords: jest.fn(),
  updateMealRecord: jest.fn(),
  deleteMealRecord: jest.fn(),
}));

describe("useCreateMealRecord", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when creation succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createMealRecord as jest.Mock).mockResolvedValue({ ok: true, value: { id: "meal-1" } });

    const { result } = await renderHook(() => useCreateMealRecord());

    let success = false;
    await act(async () => {
      success = await result.current.createMealRecord({
        calendarId: "cal-1",
        mealDate: "2026-08-20",
        slot: "breakfast",
        title: "トースト",
      });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(createMealRecord).toHaveBeenCalledWith({}, {
      calendarId: "cal-1",
      mealDate: "2026-08-20",
      slot: "breakfast",
      title: "トースト",
    });
  });

  it("returns false and sets the error when creation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createMealRecord as jest.Mock).mockResolvedValue({
      ok: false,
      error: { type: "ValidationError", field: "title" },
    });

    const { result } = await renderHook(() => useCreateMealRecord());

    let success = true;
    await act(async () => {
      success = await result.current.createMealRecord({
        calendarId: "cal-1",
        mealDate: "2026-08-20",
        slot: "breakfast",
        title: "",
      });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "ValidationError", field: "title" });
  });
});

describe("useCreateMealTag", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when creation succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createMealTag as jest.Mock).mockResolvedValue({ ok: true, value: { id: "mealtag-1" } });

    const { result } = await renderHook(() => useCreateMealTag());

    let success = false;
    await act(async () => {
      success = await result.current.createMealTag({ calendarId: "cal-1", name: "和食" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(createMealTag).toHaveBeenCalledWith({}, { calendarId: "cal-1", name: "和食" });
  });

  it("returns false and sets the error when creation fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (createMealTag as jest.Mock).mockResolvedValue({
      ok: false,
      error: { type: "ValidationError", field: "name" },
    });

    const { result } = await renderHook(() => useCreateMealTag());

    let success = true;
    await act(async () => {
      success = await result.current.createMealTag({ calendarId: "cal-1", name: "" });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "ValidationError", field: "name" });
  });
});

describe("useMealRecords", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads meal records for the given calendar on mount", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    const records = [{ id: "meal-1", calendarId: "cal-1", title: "トースト" }];
    (listMealRecords as jest.Mock).mockResolvedValue({ ok: true, value: records });

    const { result } = await renderHook(() => useMealRecords("cal-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mealRecords).toEqual(records);
    expect(listMealRecords).toHaveBeenCalledWith({}, "cal-1", undefined);
  });

  it("keeps an empty list and sets the error when loading fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (listMealRecords as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useMealRecords("cal-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mealRecords).toEqual([]);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});

describe("useUpdateMealRecord", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when it succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateMealRecord as jest.Mock).mockResolvedValue({ ok: true, value: { id: "meal-1" } });

    const { result } = await renderHook(() => useUpdateMealRecord());

    let success = false;
    await act(async () => {
      success = await result.current.updateMealRecord("meal-1", { title: "変更後" });
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(updateMealRecord).toHaveBeenCalledWith({}, "meal-1", { title: "変更後" });
  });

  it("returns false and sets the error when it fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (updateMealRecord as jest.Mock).mockResolvedValue({
      ok: false,
      error: { type: "ValidationError", field: "title" },
    });

    const { result } = await renderHook(() => useUpdateMealRecord());

    let success = true;
    await act(async () => {
      success = await result.current.updateMealRecord("meal-1", { title: "" });
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "ValidationError", field: "title" });
  });
});

describe("useDeleteMealRecord", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns true and clears the error when deletion succeeds", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteMealRecord as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    const { result } = await renderHook(() => useDeleteMealRecord());

    let success = false;
    await act(async () => {
      success = await result.current.deleteMealRecord("meal-1");
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(deleteMealRecord).toHaveBeenCalledWith({}, "meal-1");
  });

  it("returns false and sets the error when deletion fails", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (deleteMealRecord as jest.Mock).mockResolvedValue({ ok: false, error: { type: "Forbidden" } });

    const { result } = await renderHook(() => useDeleteMealRecord());

    let success = true;
    await act(async () => {
      success = await result.current.deleteMealRecord("meal-1");
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual({ type: "Forbidden" });
  });
});
