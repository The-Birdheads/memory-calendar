import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { useAuthActions } from "../../auth/hooks";
import { DeleteAccountConfirmModal } from "./DeleteAccountConfirmModal";
import { useDeleteAccount, useMyProfile, useUpdateDisplayName, useUpdateWeekStartsOn } from "../hooks";
import { getProfileErrorMessageJa } from "../service";

export interface PersonalSettingsPanelProps {
  userId: string;
}

export function PersonalSettingsPanel({ userId }: PersonalSettingsPanelProps) {
  const { profile, isLoading, refetch: refetchProfile } = useMyProfile(userId);
  const { updateDisplayName, error: updateError } = useUpdateDisplayName();
  const { updateWeekStartsOn, error: weekStartsOnError } = useUpdateWeekStartsOn();
  const { signOut, isSubmitting: isSigningOut } = useAuthActions();
  const { deleteAccount, isSubmitting: isDeletingAccount, error: deleteError } = useDeleteAccount();
  const [nameDraft, setNameDraft] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  useEffect(() => {
    if (profile) {
      setNameDraft(profile.displayName ?? "");
    }
  }, [profile]);

  const handleChangeName = (text: string) => {
    setNameDraft(text);
    setIsSaved(false);
  };

  const handleSave = async () => {
    const updated = await updateDisplayName(userId, nameDraft);
    if (updated) {
      setIsSaved(true);
    }
  };

  const handleSelectWeekStartsOn = async (weekStartsOn: 0 | 1) => {
    if (weekStartsOn === profile?.weekStartsOn) return;
    const updated = await updateWeekStartsOn(userId, weekStartsOn);
    if (updated) {
      refetchProfile();
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
        <Text style={styles.sectionLabel}>ユーザー名</Text>
        <View style={styles.nameRow}>
          <TextInput
            testID="personal-settings-name-input"
            style={[styles.input, styles.nameInput]}
            value={nameDraft}
            onChangeText={handleChangeName}
            editable={!isLoading}
          />
          <TouchableOpacity
            testID="personal-settings-save"
            style={styles.saveButton}
            onPress={handleSave}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.saveButtonText}>✓</Text>
          </TouchableOpacity>
        </View>
        {updateError ? <Text style={styles.errorText}>{getProfileErrorMessageJa(updateError)}</Text> : null}
        {isSaved ? (
          <Text testID="personal-settings-saved" style={styles.savedText}>
            保存しました
          </Text>
        ) : null}

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
  errorText: {
    color: "#d32f2f",
  },
  savedText: {
    color: "#2f6fed",
  },
  saveButton: {
    backgroundColor: "#2f6fed",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
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
