import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { useMealNotificationSettings } from "../notificationHooks";
import {
  DEFAULT_MEAL_NOTIFICATION_SETTINGS,
  getMealNotificationSettings,
  saveMealNotificationSettings,
  type MealNotificationSettings,
} from "../notificationSettings";

jest.mock("../../../shared/api/supabaseClient", () => ({ getSupabaseClient: jest.fn() }));
jest.mock("../notificationSettings", () => ({
  ...jest.requireActual("../notificationSettings"),
  getMealNotificationSettings: jest.fn(),
  saveMealNotificationSettings: jest.fn(),
}));

const SAVED: MealNotificationSettings = {
  ...DEFAULT_MEAL_NOTIFICATION_SETTINGS,
  enabled: true,
};

describe("useMealNotificationSettings", () => {
  beforeEach(() => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the user's settings on mount", async () => {
    (getMealNotificationSettings as jest.Mock).mockResolvedValue({ ok: true, value: SAVED });

    const { result } = await renderHook(() => useMealNotificationSettings("user-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toEqual(SAVED);
    expect(getMealNotificationSettings).toHaveBeenCalledWith({}, "user-1");
  });

  it("starts from the (off) defaults and does not query when there is no signed-in user yet", async () => {
    const { result } = await renderHook(() => useMealNotificationSettings(undefined));

    expect(result.current.settings).toEqual(DEFAULT_MEAL_NOTIFICATION_SETTINGS);
    expect(result.current.isLoading).toBe(false);
    expect(getMealNotificationSettings).not.toHaveBeenCalled();
  });

  it("keeps the defaults and exposes the error when loading fails", async () => {
    (getMealNotificationSettings as jest.Mock).mockResolvedValue({ ok: false, error: { type: "LoadFailed" } });

    const { result } = await renderHook(() => useMealNotificationSettings("user-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toEqual(DEFAULT_MEAL_NOTIFICATION_SETTINGS);
    expect(result.current.error).toEqual({ type: "LoadFailed" });
  });

  it("applies a change immediately (optimistically) and saves it", async () => {
    (getMealNotificationSettings as jest.Mock).mockResolvedValue({ ok: true, value: DEFAULT_MEAL_NOTIFICATION_SETTINGS });
    let resolveSave: (value: unknown) => void = () => {};
    (saveMealNotificationSettings as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; })
    );

    const { result } = await renderHook(() => useMealNotificationSettings("user-1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let promise: Promise<boolean> | undefined;
    await act(async () => {
      promise = result.current.update(SAVED);
    });

    // The UI shows the new value before the server answers.
    expect(result.current.settings.enabled).toBe(true);
    expect(saveMealNotificationSettings).toHaveBeenCalledWith({}, "user-1", SAVED);

    await act(async () => {
      resolveSave({ ok: true, value: SAVED });
      await promise;
    });
    expect(await promise).toBe(true);
    expect(result.current.settings).toEqual(SAVED);
    expect(result.current.error).toBeNull();
  });

  it("rolls back to the previous settings and reports the error when saving fails", async () => {
    (getMealNotificationSettings as jest.Mock).mockResolvedValue({ ok: true, value: DEFAULT_MEAL_NOTIFICATION_SETTINGS });
    (saveMealNotificationSettings as jest.Mock).mockResolvedValue({ ok: false, error: { type: "SaveFailed" } });

    const { result } = await renderHook(() => useMealNotificationSettings("user-1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success = true;
    await act(async () => {
      success = await result.current.update(SAVED);
    });

    expect(success).toBe(false);
    expect(result.current.settings).toEqual(DEFAULT_MEAL_NOTIFICATION_SETTINGS);
    expect(result.current.error).toEqual({ type: "SaveFailed" });
  });
});
