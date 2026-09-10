import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { TagLevelIcon } from "../TagLevelIcon";

function flatStyle(style: unknown) {
  return StyleSheet.flatten(style as Parameters<typeof StyleSheet.flatten>[0]) as Record<string, unknown>;
}

describe("TagLevelIcon", () => {
  it("renders a fully round shape for 大分類 (major)", async () => {
    const { getByTestId } = await render(<TagLevelIcon testID="icon" level="major" color="#ff0000" size={10} />);

    const style = flatStyle(getByTestId("icon").props.style);
    expect(style.borderRadius).toBe(5);
    expect(style.transform).toBeUndefined();
    expect(style.backgroundColor).toBe("#ff0000");
  });

  it("renders a square shape for 中分類 (mid)", async () => {
    const { getByTestId } = await render(<TagLevelIcon testID="icon" level="mid" color="#00ff00" size={10} />);

    const style = flatStyle(getByTestId("icon").props.style);
    expect(style.borderRadius).toBe(2);
    expect(style.transform).toBeUndefined();
  });

  it("renders a rotated (diamond) shape for 小分類 (minor)", async () => {
    const { getByTestId } = await render(<TagLevelIcon testID="icon" level="minor" color="#0000ff" size={10} />);

    const style = flatStyle(getByTestId("icon").props.style);
    expect(style.transform).toEqual([{ rotate: "45deg" }]);
  });

  it("gives major, mid, and minor visually distinct shapes from each other", async () => {
    const { getByTestId: getMajor } = await render(<TagLevelIcon testID="icon" level="major" color="#ff0000" />);
    const { getByTestId: getMid } = await render(<TagLevelIcon testID="icon" level="mid" color="#ff0000" />);
    const { getByTestId: getMinor } = await render(<TagLevelIcon testID="icon" level="minor" color="#ff0000" />);

    const majorStyle = flatStyle(getMajor("icon").props.style);
    const midStyle = flatStyle(getMid("icon").props.style);
    const minorStyle = flatStyle(getMinor("icon").props.style);

    expect(majorStyle.borderRadius).not.toBe(midStyle.borderRadius);
    expect(minorStyle.transform).not.toEqual(majorStyle.transform);
    expect(minorStyle.transform).not.toEqual(midStyle.transform);
  });
});
