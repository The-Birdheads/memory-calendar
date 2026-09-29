import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { PersonalSettingsPanel } from "../PersonalSettingsPanel";
import { useAuthActions } from "../../../auth/hooks";
import { useDeleteAccount, useMyProfile, useUpdateDisplayName, useUpdateWeekStartsOn } from "../../hooks";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("../../../auth/hooks", () => ({
  useAuthActions: jest.fn(),
}));

jest.mock("../../hooks", () => ({
  useMyProfile: jest.fn(),
  useUpdateDisplayName: jest.fn(),
  useUpdateWeekStartsOn: jest.fn(),
  useDeleteAccount: jest.fn(),
}));

function mockHooks(overrides: {
  displayName?: string | null;
  weekStartsOn?: 0 | 1;
  refetchProfile?: jest.Mock;
  updateDisplayName?: jest.Mock;
  updateError?: unknown;
  updateWeekStartsOn?: jest.Mock;
  weekStartsOnError?: unknown;
  signOut?: jest.Mock;
  deleteAccount?: jest.Mock;
  deleteError?: unknown;
} = {}) {
  (useMyProfile as jest.Mock).mockReturnValue({
    profile: {
      id: "user-1",
      displayName: overrides.displayName ?? "たろう",
      avatarUrl: null,
      weekStartsOn: overrides.weekStartsOn ?? 0,
    },
    isLoading: false,
    error: null,
    refetch: overrides.refetchProfile ?? jest.fn(),
  });
  (useUpdateDisplayName as jest.Mock).mockReturnValue({
    updateDisplayName: overrides.updateDisplayName ?? jest.fn().mockResolvedValue({ id: "user-1", displayName: "新しい名前", avatarUrl: null }),
    isSubmitting: false,
    error: overrides.updateError ?? null,
  });
  (useUpdateWeekStartsOn as jest.Mock).mockReturnValue({
    updateWeekStartsOn:
      overrides.updateWeekStartsOn ?? jest.fn().mockResolvedValue({ id: "user-1", displayName: "たろう", avatarUrl: null, weekStartsOn: 1 }),
    isSubmitting: false,
    error: overrides.weekStartsOnError ?? null,
  });
  (useAuthActions as jest.Mock).mockReturnValue({
    signOut: overrides.signOut ?? jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: null,
  });
  (useDeleteAccount as jest.Mock).mockReturnValue({
    deleteAccount: overrides.deleteAccount ?? jest.fn().mockResolvedValue(true),
    isSubmitting: false,
    error: overrides.deleteError ?? null,
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

  it("shows both week-start options", async () => {
    mockHooks({ weekStartsOn: 0 });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    expect(getByTestId("personal-settings-week-starts-on-sunday")).toBeTruthy();
    expect(getByTestId("personal-settings-week-starts-on-monday")).toBeTruthy();
  });

  it("switches to 月曜始まり when tapped, and refetches the profile", async () => {
    const updateWeekStartsOnMock = jest
      .fn()
      .mockResolvedValue({ id: "user-1", displayName: "たろう", avatarUrl: null, weekStartsOn: 1 });
    const refetchProfileMock = jest.fn();
    mockHooks({ weekStartsOn: 0, updateWeekStartsOn: updateWeekStartsOnMock, refetchProfile: refetchProfileMock });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-week-starts-on-monday"));

    await waitFor(() => expect(updateWeekStartsOnMock).toHaveBeenCalledWith("user-1", 1));
    await waitFor(() => expect(refetchProfileMock).toHaveBeenCalled());
  });

  it("does not call updateWeekStartsOn again when the already-selected option is tapped", async () => {
    const updateWeekStartsOnMock = jest.fn();
    mockHooks({ weekStartsOn: 0, updateWeekStartsOn: updateWeekStartsOnMock });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-week-starts-on-sunday"));

    expect(updateWeekStartsOnMock).not.toHaveBeenCalled();
  });

  it("shows an error message when saving the week-start day fails", async () => {
    mockHooks({
      weekStartsOn: 0,
      updateWeekStartsOn: jest.fn().mockResolvedValue(null),
      weekStartsOnError: { type: "Forbidden" },
    });

    const { getByTestId, getByText } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-week-starts-on-monday"));

    await waitFor(() => expect(getByText("この操作を行う権限がありません")).toBeTruthy());
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

  it("opens a confirmation modal before deleting the account", async () => {
    mockHooks();

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-delete-account"));

    expect(getByTestId("delete-account-confirm-button")).toBeTruthy();
  });

  it("deletes the account, signs out, and navigates to login on confirm", async () => {
    const deleteAccountMock = jest.fn().mockResolvedValue(true);
    const signOutMock = jest.fn().mockResolvedValue(true);
    mockHooks({ deleteAccount: deleteAccountMock, signOut: signOutMock });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-delete-account"));
    await fireEvent.press(getByTestId("delete-account-confirm-button"));

    await waitFor(() => expect(deleteAccountMock).toHaveBeenCalled());
    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(auth)/login"));
  });

  it("cancels deletion without calling deleteAccount when the confirmation is dismissed", async () => {
    const deleteAccountMock = jest.fn();
    mockHooks({ deleteAccount: deleteAccountMock });

    const { getByTestId, queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-delete-account"));
    await fireEvent.press(getByTestId("delete-account-cancel-button"));

    expect(deleteAccountMock).not.toHaveBeenCalled();
    expect(queryByTestId("delete-account-confirm-button")).toBeNull();
  });

  it("does not sign out or navigate away when account deletion fails", async () => {
    const deleteAccountMock = jest.fn().mockResolvedValue(false);
    const signOutMock = jest.fn();
    mockHooks({
      deleteAccount: deleteAccountMock,
      signOut: signOutMock,
      deleteError: { type: "DeleteFailed" },
    });

    const { getByTestId, getByText } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-delete-account"));
    await fireEvent.press(getByTestId("delete-account-confirm-button"));

    await waitFor(() => expect(deleteAccountMock).toHaveBeenCalled());
    expect(signOutMock).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(getByText("アカウントの削除に失敗しました。時間をおいて再度お試しください")).toBeTruthy();
  });
});
