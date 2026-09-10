import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { PersonalSettingsPanel } from "../PersonalSettingsPanel";
import { useAuthActions } from "../../../auth/hooks";
import { useMyProfile, useUpdateDisplayName } from "../../hooks";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("../../../auth/hooks", () => ({
  useAuthActions: jest.fn(),
}));

jest.mock("../../hooks", () => ({
  useMyProfile: jest.fn(),
  useUpdateDisplayName: jest.fn(),
}));

function mockHooks(overrides: {
  displayName?: string | null;
  updateDisplayName?: jest.Mock;
  updateError?: unknown;
  signOut?: jest.Mock;
} = {}) {
  (useMyProfile as jest.Mock).mockReturnValue({
    profile: { id: "user-1", displayName: overrides.displayName ?? "たろう", avatarUrl: null },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  (useUpdateDisplayName as jest.Mock).mockReturnValue({
    updateDisplayName: overrides.updateDisplayName ?? jest.fn().mockResolvedValue({ id: "user-1", displayName: "新しい名前", avatarUrl: null }),
    isSubmitting: false,
    error: overrides.updateError ?? null,
  });
  (useAuthActions as jest.Mock).mockReturnValue({
    signOut: overrides.signOut ?? jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
}

describe("PersonalSettingsPanel", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("pre-fills the name field with the caller's current display name", async () => {
    mockHooks({ displayName: "たろう" });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    expect(getByTestId("personal-settings-name-input").props.value).toBe("たろう");
  });

  it("uses a ✓ icon instead of the 保存 text label for the save button", async () => {
    mockHooks({ displayName: "たろう" });

    const { queryByText, getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    expect(queryByText("保存")).toBeNull();
    expect(getByTestId("personal-settings-save")).toBeTruthy();
  });

  it("saves the edited display name", async () => {
    const updateDisplayNameMock = jest.fn().mockResolvedValue({
      id: "user-1",
      displayName: "新しい名前",
      avatarUrl: null,
    });
    mockHooks({ updateDisplayName: updateDisplayNameMock });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.changeText(getByTestId("personal-settings-name-input"), "新しい名前");
    await fireEvent.press(getByTestId("personal-settings-save"));

    await waitFor(() => expect(updateDisplayNameMock).toHaveBeenCalledWith("user-1", "新しい名前"));
    expect(getByTestId("personal-settings-saved")).toBeTruthy();
  });

  it("shows an error message when saving fails", async () => {
    mockHooks({
      updateDisplayName: jest.fn().mockResolvedValue(null),
      updateError: { type: "ValidationError", field: "displayName" },
    });

    const { getByTestId, getByText } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-save"));

    await waitFor(() => expect(getByText("ユーザー名を入力してください")).toBeTruthy());
  });

  it("signs out and navigates to the login screen", async () => {
    const signOutMock = jest.fn().mockResolvedValue(true);
    mockHooks({ signOut: signOutMock });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-logout"));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(auth)/login"));
  });

  it("does not navigate away when sign out fails", async () => {
    const signOutMock = jest.fn().mockResolvedValue(false);
    mockHooks({ signOut: signOutMock });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-logout"));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
  });
});
