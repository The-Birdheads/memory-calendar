import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_MEAL_NOTIFICATION_SETTINGS,
  dateToTimeString,
  getMealNotificationSettings,
  saveMealNotificationSettings,
  timeStringToDate,
} from "../notificationSettings";

function clientWithSelect(result: { data: unknown; error: unknown }) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, select, eq };
}

describe("DEFAULT_MEAL_NOTIFICATION_SETTINGS", () => {
  it("is off by default, with breakfast 8:00 / lunch 12:00 / dinner 18:00 / snack 15:00", () => {
    expect(DEFAULT_MEAL_NOTIFICATION_SETTINGS).toEqual({
      enabled: false,
      slots: {
        breakfast: { enabled: true, time: "08:00" },
        lunch: { enabled: true, time: "12:00" },
        dinner: { enabled: true, time: "18:00" },
        snack: { enabled: true, time: "15:00" },
      },
    });
  });
});

describe("getMealNotificationSettings", () => {
  it("returns the defaults when the user has never saved settings", async () => {
    const { client, from, eq } = clientWithSelect({ data: null, error: null });

    const result = await getMealNotificationSettings(client, "user-1");

    expect(result).toEqual({ ok: true, value: DEFAULT_MEAL_NOTIFICATION_SETTINGS });
    expect(from).toHaveBeenCalledWith("meal_notification_settings");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("maps the saved row, trimming Postgres' seconds off the times", async () => {
    const { client } = clientWithSelect({
      data: {
        user_id: "user-1",
        enabled: true,
        breakfast_enabled: true,
        breakfast_time: "07:30:00",
        lunch_enabled: false,
        lunch_time: "12:00:00",
        dinner_enabled: true,
        dinner_time: "19:15:00",
        snack_enabled: false,
        snack_time: "15:00:00",
      },
      error: null,
    });

    const result = await getMealNotificationSettings(client, "user-1");

    expect(result).toEqual({
      ok: true,
      value: {
        enabled: true,
        slots: {
          breakfast: { enabled: true, time: "07:30" },
          lunch: { enabled: false, time: "12:00" },
          dinner: { enabled: true, time: "19:15" },
          snack: { enabled: false, time: "15:00" },
        },
      },
    });
  });

  it("returns an error when loading fails", async () => {
    const { client } = clientWithSelect({ data: null, error: { message: "boom" } });

    const result = await getMealNotificationSettings(client, "user-1");

    expect(result).toEqual({ ok: false, error: { type: "LoadFailed" } });
  });
});

describe("saveMealNotificationSettings", () => {
  const SETTINGS = {
    enabled: true,
    slots: {
      breakfast: { enabled: true, time: "07:30" },
      lunch: { enabled: false, time: "12:00" },
      dinner: { enabled: true, time: "19:00" },
      snack: { enabled: true, time: "15:00" },
    },
  };

  it("upserts the user's single settings row with the flat columns", async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        user_id: "user-1",
        enabled: true,
        breakfast_enabled: true,
        breakfast_time: "07:30:00",
        lunch_enabled: false,
        lunch_time: "12:00:00",
        dinner_enabled: true,
        dinner_time: "19:00:00",
        snack_enabled: true,
        snack_time: "15:00:00",
      },
      error: null,
    });
    const select = jest.fn().mockReturnValue({ single });
    const upsert = jest.fn().mockReturnValue({ select });
    const client = { from: jest.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient;

    const result = await saveMealNotificationSettings(client, "user-1", SETTINGS);

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        enabled: true,
        breakfast_enabled: true,
        breakfast_time: "07:30",
        lunch_enabled: false,
        lunch_time: "12:00",
        dinner_enabled: true,
        dinner_time: "19:00",
        snack_enabled: true,
        snack_time: "15:00",
      },
      { onConflict: "user_id" }
    );
    expect(result).toEqual({ ok: true, value: SETTINGS });
  });

  it("returns an error when saving fails", async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const upsert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) });
    const client = { from: jest.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient;

    const result = await saveMealNotificationSettings(client, "user-1", SETTINGS);

    expect(result).toEqual({ ok: false, error: { type: "SaveFailed" } });
  });
});

describe("time conversion for the picker", () => {
  it("round-trips an HH:MM string through a Date (wall-clock hours/minutes)", () => {
    const date = timeStringToDate("07:05");
    expect(date.getHours()).toBe(7);
    expect(date.getMinutes()).toBe(5);
    expect(dateToTimeString(date)).toBe("07:05");
  });

  it("zero-pads hours and minutes", () => {
    const date = new Date(2026, 0, 1, 9, 3);
    expect(dateToTimeString(date)).toBe("09:03");
  });
});
