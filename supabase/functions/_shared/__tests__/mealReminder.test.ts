/**
 * @jest-environment node
 */
import {
  buildMealReminderMessage,
  DELIVERY_WINDOW_MINUTES,
  dueMealSlots,
  jstClock,
  timeToMinutes,
  type MealNotificationSettingsRow,
} from "../mealReminder";

const BASE: MealNotificationSettingsRow = {
  user_id: "user-1",
  enabled: true,
  breakfast_enabled: true,
  breakfast_time: "08:00:00",
  lunch_enabled: true,
  lunch_time: "12:00:00",
  dinner_enabled: true,
  dinner_time: "18:00:00",
  snack_enabled: true,
  snack_time: "15:00:00",
};

describe("jstClock", () => {
  it("reads the JST calendar day and minutes since midnight, even across the UTC date boundary", () => {
    // 2026-10-08 23:30 UTC = 2026-10-09 08:30 JST
    expect(jstClock(new Date("2026-10-08T23:30:00.000Z"))).toEqual({ dateKey: "2026-10-09", minutes: 8 * 60 + 30 });
    // 2026-10-09 14:59 UTC = 2026-10-09 23:59 JST
    expect(jstClock(new Date("2026-10-09T14:59:00.000Z"))).toEqual({ dateKey: "2026-10-09", minutes: 23 * 60 + 59 });
  });
});

describe("timeToMinutes", () => {
  it("parses Postgres time strings with or without seconds", () => {
    expect(timeToMinutes("08:00:00")).toBe(480);
    expect(timeToMinutes("18:05")).toBe(1085);
    expect(timeToMinutes("00:00:00")).toBe(0);
  });
});

describe("dueMealSlots", () => {
  it("is due exactly at the configured time", () => {
    expect(dueMealSlots(BASE, 8 * 60)).toEqual(["breakfast"]);
    expect(dueMealSlots(BASE, 12 * 60)).toEqual(["lunch"]);
    expect(dueMealSlots(BASE, 15 * 60)).toEqual(["snack"]);
    expect(dueMealSlots(BASE, 18 * 60)).toEqual(["dinner"]);
  });

  it("stays due for a few minutes after, so a delayed cron run still delivers", () => {
    expect(dueMealSlots(BASE, 8 * 60 + DELIVERY_WINDOW_MINUTES - 1)).toEqual(["breakfast"]);
  });

  it("is not due before the time, nor once the delivery window has passed (no stale 'breakfast' at noon)", () => {
    expect(dueMealSlots(BASE, 8 * 60 - 1)).toEqual([]);
    expect(dueMealSlots(BASE, 8 * 60 + DELIVERY_WINDOW_MINUTES)).toEqual([]);
    expect(dueMealSlots(BASE, 11 * 60)).toEqual([]);
  });

  it("returns nothing when the master switch is off, whatever the slot switches say", () => {
    expect(dueMealSlots({ ...BASE, enabled: false }, 8 * 60)).toEqual([]);
  });

  it("skips slots whose own switch is off", () => {
    expect(dueMealSlots({ ...BASE, breakfast_enabled: false }, 8 * 60)).toEqual([]);
    expect(dueMealSlots({ ...BASE, lunch_enabled: false }, 12 * 60)).toEqual([]);
  });

  it("uses each slot's own custom time", () => {
    const custom = { ...BASE, breakfast_time: "07:30:00", dinner_time: "19:15:00" };
    expect(dueMealSlots(custom, 7 * 60 + 30)).toEqual(["breakfast"]);
    expect(dueMealSlots(custom, 8 * 60)).toEqual([]);
    expect(dueMealSlots(custom, 19 * 60 + 15)).toEqual(["dinner"]);
  });

  it("can return several slots when their times coincide", () => {
    const same = { ...BASE, snack_time: "12:00:00" };
    expect(dueMealSlots(same, 12 * 60)).toEqual(["lunch", "snack"]);
  });
});

describe("buildMealReminderMessage", () => {
  it("builds the notification sentence with the day's meals for that slot", () => {
    expect(buildMealReminderMessage("breakfast", ["コーンフレーク", "牛乳"])).toBe(
      "朝食の時間です！献立はコーンフレーク、牛乳の予定です"
    );
  });

  it("uses the right label for every slot", () => {
    expect(buildMealReminderMessage("lunch", ["カレー"])).toBe("昼食の時間です！献立はカレーの予定です");
    expect(buildMealReminderMessage("dinner", ["焼き魚"])).toBe("夕食の時間です！献立は焼き魚の予定です");
    expect(buildMealReminderMessage("snack", ["クッキー"])).toBe("間食の時間です！献立はクッキーの予定です");
  });
});
