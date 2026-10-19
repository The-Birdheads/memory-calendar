import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MealDetailFields } from "../MealDetailFields";

const INITIAL_VALUES = {
  title: "カレー",
  url: "",
  memo: "",
  mealDate: "2026-08-10",
  slot: "dinner" as const,
  rating: null,
  calendarId: "cal-1",
};

describe("MealDetailFields の鉛筆の位置", () => {
  it("鉛筆は内容のすぐ右に並び、行の右端には寄せない", async () => {
    const { getByTestId } = await render(
      <MealDetailFields initialValues={INITIAL_VALUES} calendars={[]} onUpdateField={jest.fn()} />
    );

    const pencil = getByTestId("meal-detail-title-edit");
    const row = pencil.parent?.parent;
    const rowStyle = StyleSheet.flatten(row?.props.style);

    // 右端揃え(space-between)にしない + 内容側が横に伸びて鉛筆を右端へ押しやらない(flex: 1 でない)
    expect(rowStyle.justifyContent).not.toBe("space-between");
    const valueStyle = StyleSheet.flatten(pencil.parent?.props.children?.[0]?.props?.style);
    expect(valueStyle?.flex).toBeUndefined();
    expect(valueStyle?.flexGrow ?? 0).toBe(0);
  });
});
