import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import LoginScreen from "../login";
import { useAuthActions } from "../../../src/features/auth/hooks";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthActions: jest.fn(),
}));

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
});
