import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MEAL_SLOT_COLORS, MealRow } from "../MealRow";
import type { MealRecord, MealSlot } from "../../types";

function recordFor(slot: MealSlot): MealRecord {
  return {
    id: `meal-${slot}`,
    calendarId: "cal-1",
    mealDate: "2026-08-10",
    slot,
    title: "テスト",
    rating: null,
    url: null,
    memo: null,
    createdBy: "user-1",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

describe("MealRow の時間帯ピル", () => {
  it("朝・昼・夕・間食で、ピルの色がすべて違う", () => {
    const backgrounds = Object.values(MEAL_SLOT_COLORS).map((color) => color.background);
    const foregrounds = Object.values(MEAL_SLOT_COLORS).map((color) => color.foreground);
    expect(new Set(backgrounds).size).toBe(4);
    expect(new Set(foregrounds).size).toBe(4);
  });

  it.each(["breakfast", "lunch", "dinner", "snack"] as MealSlot[])("%s のピルに、その時間帯の色が付く", async (slot) => {
    const { getByTestId } = await render(<MealRow record={recordFor(slot)} onPress={() => {}} />);

    const chipStyle = StyleSheet.flatten(getByTestId(`meal-item-slot-chip-meal-${slot}`).props.style);
    expect(chipStyle.backgroundColor).toBe(MEAL_SLOT_COLORS[slot].background);
  });
});
