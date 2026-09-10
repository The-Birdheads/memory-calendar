import { fireEvent, render } from "@testing-library/react-native";

import { ColorSwatchPicker } from "../ColorSwatchPicker";
import type { ColorUsageEntry } from "../../utils/colorUsage";
import type { Calendar } from "../../../features/calendars/types";

function calendar(id: string, name: string, color: string): Calendar {
  return { id, name, kind: "group", color, createdBy: "user-1", createdAt: "2026-08-01T00:00:00.000Z" };
}

const NO_USAGE: Record<string, ColorUsageEntry> = {};

describe("ColorSwatchPicker", () => {
  it("shows a swatch for every palette color", async () => {
    const { getByTestId } = await render(
      <ColorSwatchPicker testIDPrefix="color" selected="#2f6fed" onSelect={jest.fn()} usageByColor={NO_USAGE} />
    );

    expect(getByTestId("color-blue")).toBeTruthy();
    expect(getByTestId("color-red")).toBeTruthy();
    expect(getByTestId("color-pink")).toBeTruthy();
  });

  it("calls onSelect with the tapped swatch's hex", async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <ColorSwatchPicker testIDPrefix="color" selected="#2f6fed" onSelect={onSelect} usageByColor={NO_USAGE} />
    );

    await fireEvent.press(getByTestId("color-red"));

    expect(onSelect).toHaveBeenCalledWith("#e53935");
  });

  it("shows no 'used' mark and no message when nothing uses any color", async () => {
    const { queryByTestId } = await render(
      <ColorSwatchPicker testIDPrefix="color" selected="#2f6fed" onSelect={jest.fn()} usageByColor={NO_USAGE} />
    );

    expect(queryByTestId("color-blue-used-mark")).toBeNull();
    expect(queryByTestId("color-usage-message")).toBeNull();
  });

  it("marks a swatch that's already in use, even when it isn't the selected one", async () => {
    const usageByColor: Record<string, ColorUsageEntry> = {
      "#e53935": { calendars: [calendar("cal-1", "我が家", "#e53935")], tags: [] },
    };
    const { getByTestId, queryByTestId } = await render(
      <ColorSwatchPicker testIDPrefix="color" selected="#2f6fed" onSelect={jest.fn()} usageByColor={usageByColor} />
    );

    expect(getByTestId("color-red-used-mark")).toBeTruthy();
    expect(queryByTestId("color-blue-used-mark")).toBeNull();
    // No message yet, since the used color isn't the selected one.
    expect(queryByTestId("color-usage-message")).toBeNull();
  });

  it("shows the usage message once the used color becomes the selected one", async () => {
    const usageByColor: Record<string, ColorUsageEntry> = {
      "#e53935": { calendars: [calendar("cal-1", "我が家", "#e53935")], tags: [] },
    };
    const { getByTestId } = await render(
      <ColorSwatchPicker testIDPrefix="color" selected="#e53935" onSelect={jest.fn()} usageByColor={usageByColor} />
    );

    expect(getByTestId("color-usage-message").props.children).toBe("この色は共有カレンダー「我が家」で使用中です");
  });
});
