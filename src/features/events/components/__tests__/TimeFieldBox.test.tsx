import { fireEvent, render } from "@testing-library/react-native";

import { TimeFieldBox } from "../TimeFieldBox";

function flatten(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...(style as object[]).filter(Boolean)) : (style as Record<string, unknown>);
}

function setup(overrides: Partial<React.ComponentProps<typeof TimeFieldBox>> = {}) {
  const onSelectField = jest.fn();
  const utils = render(
    <TimeFieldBox testIDPrefix="time" hour={9} minute={5} activeField={null} onSelectField={onSelectField} {...overrides} />
  );
  return { utils, onSelectField };
}

describe("TimeFieldBox", () => {
  it("shows the hour and minute zero-padded with a colon between them", async () => {
    const { utils } = setup();
    const { getByTestId, getByText } = await utils;

    expect(getByTestId("time-hour").props.children).toBeTruthy();
    expect(getByText("09")).toBeTruthy();
    expect(getByText("05")).toBeTruthy();
    expect(getByText(":")).toBeTruthy();
  });

  it("selects the hour field when the hour is pressed, and the minute field when the minute is pressed", async () => {
    const { utils, onSelectField } = setup();
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("time-minute"));
    await fireEvent.press(getByTestId("time-hour"));

    expect(onSelectField).toHaveBeenNthCalledWith(1, "minute");
    expect(onSelectField).toHaveBeenNthCalledWith(2, "hour");
  });

  it("selects the hour field when the box itself is pressed", async () => {
    const { utils, onSelectField } = setup();
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("time-button"));

    expect(onSelectField).toHaveBeenCalledWith("hour");
  });

  it("uses the normal border while no field is active", async () => {
    const { utils } = setup({ activeField: null });
    const { getByTestId } = await utils;

    expect(flatten(getByTestId("time-button").props.style).borderColor).toBe("#ccc");
  });

  it("highlights the box (blue border) while a field is active", async () => {
    const { utils } = setup({ activeField: "minute" });
    const { getByTestId } = await utils;

    expect(flatten(getByTestId("time-button").props.style).borderColor).toBe("#2f6fed");
  });

  it("emphasises the active field's digits (dark, blue underline) over the other field's", async () => {
    const { utils } = setup({ activeField: "minute" });
    const { getByTestId } = await utils;

    const hourStyle = flatten(getByTestId("time-hour-text").props.style);
    const minuteStyle = flatten(getByTestId("time-minute-text").props.style);
    expect(minuteStyle.color).toBe("#111");
    expect(minuteStyle.borderBottomColor).toBe("#2f6fed");
    expect(hourStyle.color).toBe("#999");
  });
});
