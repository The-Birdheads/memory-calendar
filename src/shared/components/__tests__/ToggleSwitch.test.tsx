import { fireEvent, render } from "@testing-library/react-native";

import { ToggleSwitch } from "../ToggleSwitch";

const flatten = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);

describe("ToggleSwitch", () => {
  it("calls onValueChange with the opposite value when tapped", async () => {
    const onValueChange = jest.fn();
    const { getByTestId, rerender } = await render(<ToggleSwitch testID="sw" value={false} onValueChange={onValueChange} />);

    await fireEvent.press(getByTestId("sw"));
    expect(onValueChange).toHaveBeenLastCalledWith(true);

    await rerender(<ToggleSwitch testID="sw" value onValueChange={onValueChange} />);
    await fireEvent.press(getByTestId("sw"));
    expect(onValueChange).toHaveBeenLastCalledWith(false);
  });

  it("is exposed as an accessibility switch with its checked state", async () => {
    const { getByTestId } = await render(<ToggleSwitch testID="sw" value onValueChange={jest.fn()} accessibilityLabel="通知" />);

    const sw = getByTestId("sw");
    expect(sw.props.accessibilityRole).toBe("switch");
    expect(sw.props.accessibilityState).toMatchObject({ checked: true });
    expect(sw.props.accessibilityLabel).toBe("通知");
  });

  it("uses the app's accent blue when on and a neutral gray when off", async () => {
    const on = await render(<ToggleSwitch testID="on" value onValueChange={jest.fn()} />);
    expect(flatten(on.getByTestId("on-track").props.style).backgroundColor).toBe("#2f6fed");
    const off = await render(<ToggleSwitch testID="off" value={false} onValueChange={jest.fn()} />);
    expect(flatten(off.getByTestId("off-track").props.style).backgroundColor).toBe("#d8d8dc");
  });

  it("does not respond when disabled", async () => {
    const onValueChange = jest.fn();
    const { getByTestId } = await render(<ToggleSwitch testID="sw" value={false} onValueChange={onValueChange} disabled />);

    await fireEvent.press(getByTestId("sw"));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
