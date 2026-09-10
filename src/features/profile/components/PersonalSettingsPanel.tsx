import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { useAuthActions } from "../../auth/hooks";
import { useMyProfile, useUpdateDisplayName } from "../hooks";
import { getProfileErrorMessageJa } from "../service";

export interface PersonalSettingsPanelProps {
  userId: string;
}

export function PersonalSettingsPanel({ userId }: PersonalSettingsPanelProps) {
  const { profile, isLoading } = useMyProfile(userId);
  const { updateDisplayName, error: updateError } = useUpdateDisplayName();
  const { signOut, isSubmitting: isSigningOut } = useAuthActions();
  const [nameDraft, setNameDraft] = useState("");
  const [isSaved, setIsSaved] = useState(false);

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

  const handleSignOut = async () => {
    const success = await signOut();
    if (success) {
      router.replace("/(auth)/login");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionLabel}>ユーザー名</Text>
      <TextInput
        testID="personal-settings-name-input"
        style={styles.input}
        value={nameDraft}
        onChangeText={handleChangeName}
        editable={!isLoading}
      />
      {updateError ? <Text style={styles.errorText}>{getProfileErrorMessageJa(updateError)}</Text> : null}
      {isSaved ? (
        <Text testID="personal-settings-saved" style={styles.savedText}>
          保存しました
        </Text>
      ) : null}
      <TouchableOpacity
        testID="personal-settings-save"
        style={styles.saveButton}
        onPress={handleSave}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.saveButtonText}>✓</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="personal-settings-logout"
        style={styles.logoutButton}
        onPress={handleSignOut}
        disabled={isSigningOut}
      >
        <Text style={styles.logoutButtonText}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
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
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: "#d32f2f",
  },
  savedText: {
    color: "#2f6fed",
  },
  saveButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2f6fed",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "#fff",
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
});
