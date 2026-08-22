import { render } from "@testing-library/react-native";

import Index from "../index";
import { useAuthSession } from "../../src/features/auth/hooks";

jest.mock("../../src/features/auth/hooks", () => ({
  useAuthSession: jest.fn(),
}));

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
  };
});

describe("Index", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not redirect while the session is loading", async () => {
    (useAuthSession as jest.Mock).mockReturnValue({ session: null, isLoading: true });

    const { queryByTestId } = await render(<Index />);

    expect(queryByTestId("redirect")).toBeNull();
  });

  it("redirects to the calendar tab when a session exists", async () => {
    (useAuthSession as jest.Mock).mockReturnValue({
      session: { user: { id: "u1" } },
      isLoading: false,
    });

    const { getByTestId } = await render(<Index />);

    expect(getByTestId("redirect").props.children).toBe("/(tabs)/calendar");
  });

  it("redirects to the login screen when no session exists", async () => {
    (useAuthSession as jest.Mock).mockReturnValue({ session: null, isLoading: false });

    const { getByTestId } = await render(<Index />);

    expect(getByTestId("redirect").props.children).toBe("/(auth)/login");
  });
});
