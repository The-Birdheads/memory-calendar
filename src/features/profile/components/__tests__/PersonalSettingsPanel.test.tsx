import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { PersonalSettingsPanel } from "../PersonalSettingsPanel";
import { useAuthActions } from "../../../auth/hooks";
import { useDeleteAccount, useMyProfile, useUpdateDisplayName, useUpdateWeekStartsOn } from "../../hooks";
import { useAvatarUrls, useRemoveMyAvatar, useUploadMyAvatar } from "../../avatarHooks";
import { pickAvatarFromLibrary } from "../../avatarPicker";

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

jest.mock("../../avatarHooks", () => ({
  useAvatarUrls: jest.fn(),
  useUploadMyAvatar: jest.fn(),
  useRemoveMyAvatar: jest.fn(),
}));

jest.mock("../../avatarPicker", () => ({
  pickAvatarFromLibrary: jest.fn(),
}));

function mockHooks(overrides: {
  avatarPath?: string | null;
  avatarUrls?: Record<string, string>;
  uploadAvatar?: jest.Mock;
  removeAvatar?: jest.Mock;
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
  checkHabitasInUse?: jest.Mock;
} = {}) {
  (useMyProfile as jest.Mock).mockReturnValue({
    profile: {
      id: "user-1",
      displayName: overrides.displayName ?? "たろう",
      avatarPath: overrides.avatarPath ?? null,
      weekStartsOn: overrides.weekStartsOn ?? 0,
    },
    isLoading: false,
    error: null,
    refetch: overrides.refetchProfile ?? jest.fn(),
  });
  (useAvatarUrls as jest.Mock).mockReturnValue(overrides.avatarUrls ?? {});
  (useUploadMyAvatar as jest.Mock).mockReturnValue({
    uploadAvatar: overrides.uploadAvatar ?? jest.fn().mockResolvedValue({ id: "user-1" }),
    isSubmitting: false,
    error: null,
  });
  (useRemoveMyAvatar as jest.Mock).mockReturnValue({
    removeAvatar: overrides.removeAvatar ?? jest.fn().mockResolvedValue({ id: "user-1" }),
    isSubmitting: false,
    error: null,
  });
  (useUpdateDisplayName as jest.Mock).mockReturnValue({
    updateDisplayName: overrides.updateDisplayName ?? jest.fn().mockResolvedValue({ id: "user-1", displayName: "新しい名前", avatarPath: null }),
    isSubmitting: false,
    error: overrides.updateError ?? null,
  });
  (useUpdateWeekStartsOn as jest.Mock).mockReturnValue({
    updateWeekStartsOn:
      overrides.updateWeekStartsOn ?? jest.fn().mockResolvedValue({ id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn: 1 }),
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
    checkHabitasInUse: overrides.checkHabitasInUse ?? jest.fn().mockResolvedValue(false),
    isSubmitting: false,
    error: overrides.deleteError ?? null,
  });
}

describe("PersonalSettingsPanel", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows the display name as plain text with an edit (pencil) icon, not an input, by default", async () => {
    mockHooks({ displayName: "たろう" });

    const { getByTestId, queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    expect(getByTestId("personal-settings-name-display").props.children).toBe("たろう");
    expect(getByTestId("personal-settings-name-edit")).toBeTruthy();
    expect(queryByTestId("personal-settings-name-input")).toBeNull();
  });

  it("reveals a text input (pre-filled) with confirm/cancel buttons when the edit icon is pressed", async () => {
    mockHooks({ displayName: "たろう" });

    const { getByTestId, queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);
    await fireEvent.press(getByTestId("personal-settings-name-edit"));

    expect(getByTestId("personal-settings-name-input").props.value).toBe("たろう");
    expect(getByTestId("personal-settings-name-confirm")).toBeTruthy();
    expect(getByTestId("personal-settings-name-cancel")).toBeTruthy();
    expect(queryByTestId("personal-settings-name-display")).toBeNull();
  });

  it("saves the edited display name and returns to plain-text display on confirm", async () => {
    const updateDisplayNameMock = jest.fn().mockResolvedValue({
      id: "user-1",
      displayName: "新しい名前",
      avatarPath: null,
    });
    mockHooks({ updateDisplayName: updateDisplayNameMock });
    const onChange = jest.fn();

    const { getByTestId, queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" onChange={onChange} />);
    await fireEvent.press(getByTestId("personal-settings-name-edit"));
    await fireEvent.changeText(getByTestId("personal-settings-name-input"), "新しい名前");
    await fireEvent.press(getByTestId("personal-settings-name-confirm"));

    await waitFor(() => expect(updateDisplayNameMock).toHaveBeenCalledWith("user-1", "新しい名前"));
    expect(queryByTestId("personal-settings-name-input")).toBeNull();
    expect(getByTestId("personal-settings-name-edit")).toBeTruthy();
    expect(onChange).toHaveBeenCalled();
  });

  it("reverts to the original name and closes the input without saving when cancel is pressed", async () => {
    const updateDisplayNameMock = jest.fn();
    mockHooks({ displayName: "たろう", updateDisplayName: updateDisplayNameMock });

    const { getByTestId, queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);
    await fireEvent.press(getByTestId("personal-settings-name-edit"));
    await fireEvent.changeText(getByTestId("personal-settings-name-input"), "書きかけの名前");
    await fireEvent.press(getByTestId("personal-settings-name-cancel"));

    expect(updateDisplayNameMock).not.toHaveBeenCalled();
    expect(queryByTestId("personal-settings-name-input")).toBeNull();
    expect(getByTestId("personal-settings-name-display").props.children).toBe("たろう");
  });

  it("stays in edit mode and shows an error message when saving fails", async () => {
    mockHooks({
      updateDisplayName: jest.fn().mockResolvedValue(null),
      updateError: { type: "ValidationError", field: "displayName" },
    });

    const { getByTestId, getByText } = await render(<PersonalSettingsPanel userId="user-1" />);
    await fireEvent.press(getByTestId("personal-settings-name-edit"));
    await fireEvent.press(getByTestId("personal-settings-name-confirm"));

    await waitFor(() => expect(getByText("ユーザー名を入力してください")).toBeTruthy());
    expect(getByTestId("personal-settings-name-input")).toBeTruthy();
  });

  it("shows both week-start options", async () => {
    mockHooks({ weekStartsOn: 0 });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    expect(getByTestId("personal-settings-week-starts-on-sunday")).toBeTruthy();
    expect(getByTestId("personal-settings-week-starts-on-monday")).toBeTruthy();
  });

  it("switches to 月曜始まり when tapped, refetches the profile, and notifies the caller via onChange (regression: other screens' own useMyProfile instances - e.g. the calendar screen's - didn't pick up the change until closing and reopening)", async () => {
    const updateWeekStartsOnMock = jest
      .fn()
      .mockResolvedValue({ id: "user-1", displayName: "たろう", avatarPath: null, weekStartsOn: 1 });
    const refetchProfileMock = jest.fn();
    const onChange = jest.fn();
    mockHooks({ weekStartsOn: 0, updateWeekStartsOn: updateWeekStartsOnMock, refetchProfile: refetchProfileMock });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" onChange={onChange} />);

    await fireEvent.press(getByTestId("personal-settings-week-starts-on-monday"));

    await waitFor(() => expect(updateWeekStartsOnMock).toHaveBeenCalledWith("user-1", 1));
    await waitFor(() => expect(refetchProfileMock).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalled());
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

  it("tells the user the account stays when Habitas is also used", async () => {
    mockHooks({ checkHabitasInUse: jest.fn().mockResolvedValue(true) });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-delete-account"));

    await waitFor(() =>
      expect(getByTestId("delete-account-warning").props.children).toContain(
        "アカウント自体とHabitasのデータは削除されません"
      )
    );
  });

  it("tells the user the account is deleted too when only Memory Calendar is used", async () => {
    mockHooks({ checkHabitasInUse: jest.fn().mockResolvedValue(false) });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-delete-account"));

    await waitFor(() =>
      expect(getByTestId("delete-account-warning").props.children).toContain("アカウント自体も削除されます")
    );
  });

  it("still shows the confirmation (with a neutral warning) when the Habitas usage cannot be fetched", async () => {
    mockHooks({ checkHabitasInUse: jest.fn().mockResolvedValue(null) });

    const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

    await fireEvent.press(getByTestId("personal-settings-delete-account"));

    await waitFor(() => expect(getByTestId("delete-account-confirm-button")).toBeTruthy());
    expect(getByTestId("delete-account-warning").props.children).toContain("Habitasでもこのアカウントを使っている場合");
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

  describe("アイコン", () => {
    it("shows the initial of the user name as the default icon, with no remove button", async () => {
      mockHooks({ displayName: "たろう" });

      const { getByText, queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

      expect(getByText("た")).toBeTruthy();
      expect(queryByTestId("personal-settings-avatar-remove")).toBeNull();
    });

    it("follows the user name: a different name gives a different initial", async () => {
      mockHooks({ displayName: "Hanako" });

      const { getByText } = await render(<PersonalSettingsPanel userId="user-1" />);

      expect(getByText("H")).toBeTruthy();
    });

    it("shows the registered image instead of the initial", async () => {
      mockHooks({ avatarPath: "user-1/1.jpg", avatarUrls: { "user-1/1.jpg": "https://signed/me" } });

      const { getByTestId, queryByText } = await render(<PersonalSettingsPanel userId="user-1" />);

      expect(getByTestId("personal-settings-avatar-image").props.source).toEqual({ uri: "https://signed/me" });
      expect(queryByText("た")).toBeNull();
    });

    it("uploads the picked image, replacing the previous one, then refreshes", async () => {
      const photo = { fileName: "avatar.jpg", contentType: "image/jpeg", data: "x" };
      (pickAvatarFromLibrary as jest.Mock).mockResolvedValue(photo);
      const uploadAvatar = jest.fn().mockResolvedValue({ id: "user-1", avatarPath: "user-1/2.jpg" });
      const refetchProfile = jest.fn();
      const onChange = jest.fn();
      mockHooks({ avatarPath: "user-1/1.jpg", uploadAvatar, refetchProfile });

      const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" onChange={onChange} />);
      await fireEvent.press(getByTestId("personal-settings-avatar-pick"));

      await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith("user-1", photo, "user-1/1.jpg"));
      await waitFor(() => expect(refetchProfile).toHaveBeenCalled());
      expect(onChange).toHaveBeenCalled();
    });

    it("does nothing when the image picker is cancelled", async () => {
      (pickAvatarFromLibrary as jest.Mock).mockResolvedValue(null);
      const uploadAvatar = jest.fn();
      mockHooks({ uploadAvatar });

      const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);
      await fireEvent.press(getByTestId("personal-settings-avatar-pick"));

      await waitFor(() => expect(pickAvatarFromLibrary).toHaveBeenCalled());
      expect(uploadAvatar).not.toHaveBeenCalled();
    });

    it("goes back to the initial icon when the remove button is pressed", async () => {
      const removeAvatar = jest.fn().mockResolvedValue({ id: "user-1", avatarPath: null });
      const refetchProfile = jest.fn();
      const onChange = jest.fn();
      mockHooks({ avatarPath: "user-1/1.jpg", removeAvatar, refetchProfile });

      const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" onChange={onChange} />);
      await fireEvent.press(getByTestId("personal-settings-avatar-remove"));

      await waitFor(() => expect(removeAvatar).toHaveBeenCalledWith("user-1", "user-1/1.jpg"));
      await waitFor(() => expect(refetchProfile).toHaveBeenCalled());
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("使い方", () => {
    it("has a 使い方を見る button that replays the tutorial", async () => {
      mockHooks();
      const onShowTutorial = jest.fn();

      const { getByTestId } = await render(<PersonalSettingsPanel userId="user-1" onShowTutorial={onShowTutorial} />);
      await fireEvent.press(getByTestId("personal-settings-tutorial"));

      expect(onShowTutorial).toHaveBeenCalled();
    });

    it("has a 更新内容を見る button that shows the release notes", async () => {
      mockHooks();
      const onShowReleaseNotes = jest.fn();

      const { getByTestId } = await render(
        <PersonalSettingsPanel userId="user-1" onShowReleaseNotes={onShowReleaseNotes} />
      );
      await fireEvent.press(getByTestId("personal-settings-release-notes"));

      expect(onShowReleaseNotes).toHaveBeenCalled();
    });

    it("hides the 更新内容を見る button when there is no way to show the release notes", async () => {
      mockHooks();

      const { queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

      expect(queryByTestId("personal-settings-release-notes")).toBeNull();
    });

    it("hides the 使い方を見る button when there is no way to show the tutorial", async () => {
      mockHooks();

      const { queryByTestId } = await render(<PersonalSettingsPanel userId="user-1" />);

      expect(queryByTestId("personal-settings-tutorial")).toBeNull();
    });
  });
});
