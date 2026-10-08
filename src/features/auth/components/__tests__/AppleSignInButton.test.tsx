import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { AppleSignInButton } from "../AppleSignInButton";

jest.mock("expo-apple-authentication", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    isAvailableAsync: jest.fn(),
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
    AppleAuthenticationButton: ({ onPress, testID, buttonType, buttonStyle }: any) =>
      React.createElement(Pressable, { testID, onPress, accessibilityLabel: `type:${buttonType},style:${buttonStyle}` }),
  };
});

describe("AppleSignInButton", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows Apple's official button when Sign in with Apple is available, and calls onPress when tapped", async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    const onPress = jest.fn();

    const { getByTestId } = await render(<AppleSignInButton testID="login-apple-button" onPress={onPress} />);

    await waitFor(() => expect(getByTestId("login-apple-button")).toBeTruthy());
    await fireEvent.press(getByTestId("login-apple-button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses the 'Continue with Apple' wording and the black style", async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);

    const { getByTestId } = await render(<AppleSignInButton testID="login-apple-button" onPress={jest.fn()} />);

    await waitFor(() => expect(getByTestId("login-apple-button")).toBeTruthy());
    expect(getByTestId("login-apple-button").props.accessibilityLabel).toBe("type:1,style:2");
  });

  it("renders nothing when Sign in with Apple isn't available on the device", async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    const { queryByTestId } = await render(<AppleSignInButton testID="login-apple-button" onPress={jest.fn()} />);

    await waitFor(() => expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled());
    expect(queryByTestId("login-apple-button")).toBeNull();
  });

  it("renders nothing when the availability check itself fails", async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockRejectedValue(new Error("unsupported"));

    const { queryByTestId } = await render(<AppleSignInButton testID="login-apple-button" onPress={jest.fn()} />);

    await waitFor(() => expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled());
    expect(queryByTestId("login-apple-button")).toBeNull();
  });
});
