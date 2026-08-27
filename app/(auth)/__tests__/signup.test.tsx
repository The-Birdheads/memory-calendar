import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import SignupScreen from "../signup";
import { useAuthActions } from "../../../src/features/auth/hooks";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("../../../src/features/auth/hooks", () => ({
  useAuthActions: jest.fn(),
}));

describe("SignupScreen", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("submits the entered credentials and navigates to the calendar on success", async () => {
    const signUp = jest.fn().mockResolvedValue(true);
    (useAuthActions as jest.Mock).mockReturnValue({
      signUp,
      isSubmitting: false,
      error: null,
    });

    const { getByTestId } = await render(<SignupScreen />);

    await fireEvent.changeText(getByTestId("signup-email-input"), "new@example.com");
    await fireEvent.changeText(getByTestId("signup-password-input"), "password123");
    await fireEvent.press(getByTestId("signup-submit-button"));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "password123" })
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)/calendar"));
  });

  it("shows a Japanese error message when sign-up fails", async () => {
    (useAuthActions as jest.Mock).mockReturnValue({
      signUp: jest.fn().mockResolvedValue(false),
      isSubmitting: false,
      error: { type: "EmailAlreadyInUse" },
    });

    const { getByText } = await render(<SignupScreen />);

    expect(getByText("このメールアドレスは既に登録されています")).toBeTruthy();
  });

  it("navigates to the login screen when the login link is pressed", async () => {
    (useAuthActions as jest.Mock).mockReturnValue({ signUp: jest.fn(), isSubmitting: false, error: null });

    const { getByTestId } = await render(<SignupScreen />);

    await fireEvent.press(getByTestId("signup-login-link"));

    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
  });

  it("includes the entered display name when submitting", async () => {
    const signUp = jest.fn().mockResolvedValue(true);
    (useAuthActions as jest.Mock).mockReturnValue({ signUp, isSubmitting: false, error: null });

    const { getByTestId } = await render(<SignupScreen />);

    await fireEvent.changeText(getByTestId("signup-display-name-input"), "たろう");
    await fireEvent.changeText(getByTestId("signup-email-input"), "new@example.com");
    await fireEvent.changeText(getByTestId("signup-password-input"), "password123");
    await fireEvent.press(getByTestId("signup-submit-button"));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "password123",
        displayName: "たろう",
      })
    );
  });
});
