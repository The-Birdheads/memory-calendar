import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { Icon } from "../../../shared/components/Icon";
import { UserAvatar } from "../../../shared/components/UserAvatar";
import { useAuthActions } from "../../auth/hooks";
import { DeleteAccountConfirmModal } from "./DeleteAccountConfirmModal";
import { useAvatarUrls, useRemoveMyAvatar, useUploadMyAvatar } from "../avatarHooks";
import { pickAvatarFromLibrary } from "../avatarPicker";
import { useDeleteAccount, useMyProfile, useUpdateDisplayName, useUpdateWeekStartsOn } from "../hooks";
import { getProfileErrorMessageJa } from "../service";

export interface PersonalSettingsPanelProps {
  userId: string;
  /** 表示名/週の開始曜日を保存した後に呼ばれる - 他画面(カレンダー画面の
   * useMyProfileなど)が持つ別インスタンスの状態を確実に最新化するため。 */
  onChange?: () => void;
  /** 「使い方を見る」を押したとき(初回の案内をもう一度見せる)。渡さなければボタンは出さない。 */
  onShowTutorial?: () => void;
  /** 「更新内容を見る」を押したとき(リリースノートを見せる)。渡さなければボタンは出さない。 */
  onShowReleaseNotes?: () => void;
}

export function PersonalSettingsPanel({ userId, onChange, onShowTutorial, onShowReleaseNotes }: PersonalSettingsPanelProps) {
  const { profile, isLoading, refetch: refetchProfile } = useMyProfile(userId);
  const { updateDisplayName, error: updateError } = useUpdateDisplayName();
  const { updateWeekStartsOn, error: weekStartsOnError } = useUpdateWeekStartsOn();
  const { uploadAvatar, isSubmitting: isUploadingAvatar, error: avatarUploadError } = useUploadMyAvatar();
  const { removeAvatar, isSubmitting: isRemovingAvatar, error: avatarRemoveError } = useRemoveMyAvatar();
  const avatarPath = profile?.avatarPath ?? null;
  const avatarUrls = useAvatarUrls(avatarPath ? [avatarPath] : []);
  const { signOut, isSubmitting: isSigningOut } = useAuthActions();
  const { deleteAccount, isSubmitting: isDeletingAccount, error: deleteError } = useDeleteAccount();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  const handleStartEditName = () => {
    setNameDraft(profile?.displayName ?? "");
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
  };

  const handleConfirmEditName = async () => {
    const updated = await updateDisplayName(userId, nameDraft);
    if (updated) {
      setIsEditingName(false);
      onChange?.();
    }
  };

  const handlePickAvatar = async () => {
    const photo = await pickAvatarFromLibrary();
    if (!photo) return;
    const updated = await uploadAvatar(userId, photo, avatarPath);
    if (updated) {
      refetchProfile();
      onChange?.();
    }
  };

  const handleRemoveAvatar = async () => {
    const updated = await removeAvatar(userId, avatarPath);
    if (updated) {
      refetchProfile();
      onChange?.();
    }
  };

  const handleSelectWeekStartsOn = async (weekStartsOn: 0 | 1) => {
    if (weekStartsOn === profile?.weekStartsOn) return;
    const updated = await updateWeekStartsOn(userId, weekStartsOn);
    if (updated) {
      refetchProfile();
      onChange?.();
    }
  };

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) {
      router.replace("/(auth)/login");
    }
  };

  const handleConfirmDeleteAccount = async () => {
    const success = await deleteAccount();
    if (!success) {
      return;
    }
    setIsDeleteConfirmVisible(false);
    // アカウントは既に削除済みのため、signOut自体が失敗しても(サーバー側のセッションが
    // 見つからない等)ローカルの状態は必ずクリアしてログイン画面へ戻す
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>アイコン</Text>
        <View style={styles.avatarRow}>
          <UserAvatar
            testID="personal-settings-avatar"
            userId={userId}
            displayName={profile?.displayName ?? null}
            avatarUrl={avatarPath ? (avatarUrls[avatarPath] ?? null) : null}
            size={56}
          />
          <View style={styles.avatarActions}>
            <TouchableOpacity
              testID="personal-settings-avatar-pick"
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar || isRemovingAvatar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.avatarActionText}>画像を選ぶ</Text>
            </TouchableOpacity>
            {avatarPath ? (
              <TouchableOpacity
                testID="personal-settings-avatar-remove"
                onPress={handleRemoveAvatar}
                disabled={isUploadingAvatar || isRemovingAvatar}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.avatarRemoveText}>頭文字に戻す</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {avatarUploadError || avatarRemoveError ? (
          <Text style={styles.errorText}>
            {getProfileErrorMessageJa((avatarUploadError ?? avatarRemoveError) as NonNullable<typeof avatarUploadError>)}
          </Text>
        ) : null}

        <Text style={[styles.sectionLabel, styles.avatarFollowingLabel]}>ユーザー名</Text>
        {isEditingName ? (
          <View style={styles.nameRow}>
            <TextInput
              testID="personal-settings-name-input"
              style={[styles.input, styles.nameInput]}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
            />
            <TouchableOpacity
              testID="personal-settings-name-confirm"
              onPress={handleConfirmEditName}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.confirmCheck}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="personal-settings-name-cancel"
              onPress={handleCancelEditName}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text testID="personal-settings-name-display" style={styles.nameDisplay}>
              {profile?.displayName ?? ""}
            </Text>
            <TouchableOpacity
              testID="personal-settings-name-edit"
              onPress={handleStartEditName}
              disabled={isLoading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="edit" size={16} color="#2f6fed" />
            </TouchableOpacity>
          </View>
        )}
        {updateError ? <Text style={styles.errorText}>{getProfileErrorMessageJa(updateError)}</Text> : null}

        <Text style={[styles.sectionLabel, styles.weekStartsOnLabel]}>週の開始曜日</Text>
        <View style={styles.weekStartsOnRow}>
          <TouchableOpacity
            testID="personal-settings-week-starts-on-sunday"
            style={[styles.weekStartsOnChip, (profile?.weekStartsOn ?? 0) === 0 && styles.weekStartsOnChipActive]}
            onPress={() => handleSelectWeekStartsOn(0)}
          >
            <Text
              style={(profile?.weekStartsOn ?? 0) === 0 ? styles.weekStartsOnTextActive : styles.weekStartsOnText}
            >
              日曜始まり
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="personal-settings-week-starts-on-monday"
            style={[styles.weekStartsOnChip, profile?.weekStartsOn === 1 && styles.weekStartsOnChipActive]}
            onPress={() => handleSelectWeekStartsOn(1)}
          >
            <Text style={profile?.weekStartsOn === 1 ? styles.weekStartsOnTextActive : styles.weekStartsOnText}>
              月曜始まり
            </Text>
          </TouchableOpacity>
        </View>
        {weekStartsOnError ? <Text style={styles.errorText}>{getProfileErrorMessageJa(weekStartsOnError)}</Text> : null}

        {onShowTutorial ? (
          <TouchableOpacity testID="personal-settings-tutorial" style={styles.tutorialButton} onPress={onShowTutorial}>
            <Text style={styles.tutorialButtonText}>使い方を見る</Text>
          </TouchableOpacity>
        ) : null}

        {onShowReleaseNotes ? (
          <TouchableOpacity
            testID="personal-settings-release-notes"
            style={styles.tutorialButton}
            onPress={onShowReleaseNotes}
          >
            <Text style={styles.tutorialButtonText}>更新内容を見る</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          testID="personal-settings-logout"
          style={styles.logoutButton}
          onPress={handleSignOut}
          disabled={isSigningOut}
        >
          <Text style={styles.logoutButtonText}>ログアウト</Text>
        </TouchableOpacity>

        {deleteError ? <Text style={styles.errorText}>{getProfileErrorMessageJa(deleteError)}</Text> : null}
        <TouchableOpacity
          testID="personal-settings-delete-account"
          style={styles.deleteAccountButton}
          onPress={() => setIsDeleteConfirmVisible(true)}
          disabled={isDeletingAccount}
        >
          <Text style={styles.deleteAccountButtonText}>アカウントを削除</Text>
        </TouchableOpacity>
      </ScrollView>

      <DeleteAccountConfirmModal
        visible={isDeleteConfirmVisible}
        onConfirm={handleConfirmDeleteAccount}
        onCancel={() => setIsDeleteConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  tutorialButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  tutorialButtonText: {
    color: "#2f6fed",
    fontSize: 15,
    fontWeight: "600",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarActions: {
    gap: 10,
  },
  avatarActionText: {
    color: "#2f6fed",
    fontWeight: "600",
  },
  avatarRemoveText: {
    color: "#666",
  },
  avatarFollowingLabel: {
    marginTop: 8,
  },
  sectionLabel: {
    color: "#666",
    fontSize: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nameInput: {
    flex: 1,
  },
  nameDisplay: {
    flex: 1,
    fontSize: 15,
  },
  confirmCheck: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f6fed",
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    color: "#d32f2f",
  },
  weekStartsOnLabel: {
    marginTop: 16,
  },
  weekStartsOnRow: {
    flexDirection: "row",
    gap: 8,
  },
  weekStartsOnChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  weekStartsOnChipActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  weekStartsOnText: {
    fontSize: 15,
    color: "#444",
  },
  weekStartsOnTextActive: {
    fontSize: 15,
    color: "#0c447c",
    fontWeight: "700",
  },
  logoutButton: {
    alignSelf: "flex-start",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#d32f2f",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: "#d32f2f",
    fontWeight: "700",
  },
  deleteAccountButton: {
    alignSelf: "flex-start",
    marginTop: 24,
  },
  deleteAccountButtonText: {
    color: "#999",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
