import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import LoginScreen from "../login";
import { useAuthActions } from "../../../src/features/auth/hooks";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthActions: jest.fn(),
}));

jest.mock("expo-apple-authentication", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
    AppleAuthenticationButton: ({ onPress, testID }: any) => React.createElement(Pressable, { testID, onPress }),
  };
});

describe("LoginScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("submits the entered credentials and navigates to the calendar on success", async () => {
    const signIn = jest.fn().mockResolvedValue(true);
    (useAuthActions as jest.Mock).mockReturnValue({
      signIn,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.changeText(getByTestId("login-email-input"), "user@example.com");
    await fireEvent.changeText(getByTestId("login-password-input"), "password123");
    await fireEvent.press(getByTestId("login-submit-button"));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({ email: "user@example.com", password: "password123" })
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)/calendar"));
  });

  it("shows a Japanese error message when sign-in fails", async () => {
    (useAuthActions as jest.Mock).mockReturnValue({
      signIn: jest.fn().mockResolvedValue(false),
      isSubmitting: false,
      error: { type: "InvalidCredentials" },
    });

    const { getByText } = await render(<LoginScreen />);

    expect(getByText("メールアドレスまたはパスワードが正しくありません")).toBeTruthy();
  });

  it("does not navigate when sign-in fails", async () => {
    const signIn = jest.fn().mockResolvedValue(false);
    (useAuthActions as jest.Mock).mockReturnValue({
      signIn,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.press(getByTestId("login-submit-button"));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("navigates to the signup screen when the signup link is pressed", async () => {
    (useAuthActions as jest.Mock).mockReturnValue({ signIn: jest.fn(), isSubmitting: false, error: null });

    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.press(getByTestId("login-signup-link"));

    expect(router.push).toHaveBeenCalledWith("/(auth)/signup");
  });

  it("signs in with Google and navigates to the calendar on success", async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue(true);
    (useAuthActions as jest.Mock).mockReturnValue({
      signIn: jest.fn(),
      signInWithGoogle,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.press(getByTestId("login-google-button"));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)/calendar"));
  });

  it("does not navigate when Google sign-in fails", async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue(false);
    (useAuthActions as jest.Mock).mockReturnValue({
      signIn: jest.fn(),
      signInWithGoogle,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.press(getByTestId("login-google-button"));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("offers Sign in with Apple alongside Google (App Store guideline 4.8), and signs in with it", async () => {
    const signInWithApple = jest.fn().mockResolvedValue(true);
    (useAuthActions as jest.Mock).mockReturnValue({
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithApple,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<LoginScreen />);

    await waitFor(() => expect(getByTestId("login-apple-button")).toBeTruthy());
    expect(getByTestId("login-google-button")).toBeTruthy();

    await fireEvent.press(getByTestId("login-apple-button"));

    await waitFor(() => expect(signInWithApple).toHaveBeenCalled());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)/calendar"));
  });

  it("does not navigate when Apple sign-in fails or is cancelled", async () => {
    const signInWithApple = jest.fn().mockResolvedValue(false);
    (useAuthActions as jest.Mock).mockReturnValue({
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithApple,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<LoginScreen />);

    await waitFor(() => expect(getByTestId("login-apple-button")).toBeTruthy());
    await fireEvent.press(getByTestId("login-apple-button"));

    await waitFor(() => expect(signInWithApple).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
