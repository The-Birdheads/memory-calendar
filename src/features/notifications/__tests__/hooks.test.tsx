import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { getSupabaseClient } from "../../../shared/api/supabaseClient";
import { useRegisterPushToken, useRequestNotificationPermissions } from "../hooks";
import { getExpoPushTokenAsync, registerPushToken, requestNotificationPermissionsAsync } from "../service";

jest.mock("../../../shared/api/supabaseClient", () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock("../service", () => ({
  requestNotificationPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  registerPushToken: jest.fn(),
}));

function TestComponent() {
  useRequestNotificationPermissions();
  return <Text>ok</Text>;
}

describe("useRequestNotificationPermissions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("requests notification permissions once on mount", async () => {
    (requestNotificationPermissionsAsync as jest.Mock).mockResolvedValue("granted");

    render(<TestComponent />);

    await waitFor(() => expect(requestNotificationPermissionsAsync).toHaveBeenCalledTimes(1));
  });

  it("does not throw when the permission request rejects", () => {
    (requestNotificationPermissionsAsync as jest.Mock).mockRejectedValue(new Error("failed"));

    expect(() => render(<TestComponent />)).not.toThrow();
  });
});

function RegisterTestComponent() {
  useRegisterPushToken();
  return <Text>ok</Text>;
}

describe("useRegisterPushToken", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("registers the push token once permission is granted", async () => {
    (getSupabaseClient as jest.Mock).mockReturnValue({});
    (requestNotificationPermissionsAsync as jest.Mock).mockResolvedValue("granted");
    (getExpoPushTokenAsync as jest.Mock).mockResolvedValue("ExponentPushToken[abc]");
    (registerPushToken as jest.Mock).mockResolvedValue({ ok: true, value: undefined });

    render(<RegisterTestComponent />);

    await waitFor(() =>
      expect(registerPushToken).toHaveBeenCalledWith({}, "ExponentPushToken[abc]")
    );
  });

  it("does not register a token when permission is not granted", async () => {
    (requestNotificationPermissionsAsync as jest.Mock).mockResolvedValue("denied");

    render(<RegisterTestComponent />);

    await waitFor(() => expect(requestNotificationPermissionsAsync).toHaveBeenCalledTimes(1));
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it("does not throw when fetching the token fails", async () => {
    (requestNotificationPermissionsAsync as jest.Mock).mockResolvedValue("granted");
    (getExpoPushTokenAsync as jest.Mock).mockResolvedValue(null);

    expect(() => render(<RegisterTestComponent />)).not.toThrow();

    await waitFor(() => expect(getExpoPushTokenAsync).toHaveBeenCalledTimes(1));
    expect(registerPushToken).not.toHaveBeenCalled();
  });
});
