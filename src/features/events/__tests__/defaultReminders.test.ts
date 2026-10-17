import { defaultReminderKinds } from "../defaultReminders";

describe("defaultReminderKinds", () => {
  it("defaults an all-day event to 当日 and 1日前", () => {
    expect(defaultReminderKinds(true)).toEqual(["on_day", "day_before_1"]);
  });

  it("defaults a timed event to 前日9時 (10分前 is too late to prepare)", () => {
    expect(defaultReminderKinds(false)).toEqual(["day_before_1"]);
  });
});
