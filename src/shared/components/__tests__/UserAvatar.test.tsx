import { render } from "@testing-library/react-native";

import { UserAvatar } from "../UserAvatar";

function flatten(style: unknown): Record<string, unknown> {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as Record<string, unknown>);
}

describe("UserAvatar", () => {
  it("shows the initial of the display name when there is no image", async () => {
    const { getByText, queryByTestId } = await render(
      <UserAvatar testID="avatar" userId="user-1" displayName="山田太郎" avatarUrl={null} />
    );

    expect(getByText("山")).toBeTruthy();
    expect(queryByTestId("avatar-image")).toBeNull();
  });

  it("shows the image instead of the initial when an image url is given", async () => {
    const { getByTestId, queryByText } = await render(
      <UserAvatar testID="avatar" userId="user-1" displayName="山田太郎" avatarUrl="https://example.com/a.jpg" />
    );

    expect(getByTestId("avatar-image").props.source).toEqual({ uri: "https://example.com/a.jpg" });
    expect(queryByText("山")).toBeNull();
  });

  it("is a circle of the requested size", async () => {
    const { getByTestId } = await render(
      <UserAvatar testID="avatar" userId="user-1" displayName="A" avatarUrl={null} size={40} />
    );

    const style = flatten(getByTestId("avatar").props.style);
    expect(style.width).toBe(40);
    expect(style.height).toBe(40);
    expect(style.borderRadius).toBe(20);
  });

  it("is labelled with the display name for screen readers", async () => {
    const { getByTestId } = await render(
      <UserAvatar testID="avatar" userId="user-1" displayName="山田太郎" avatarUrl={null} />
    );

    expect(getByTestId("avatar").props.accessibilityLabel).toBe("山田太郎");
  });
});
