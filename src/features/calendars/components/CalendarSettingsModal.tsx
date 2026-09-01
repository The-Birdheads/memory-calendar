import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { TagManagementModal } from "../../tags/components/TagManagementModal";
import { Icon } from "../../../shared/components/Icon";
import { useCalendarMembers, useCreateCalendar, useCreateInvite, useRemoveMember, useUpdateCalendar } from "../hooks";
import { getCalendarErrorMessageJa } from "../service";
import type { Calendar, CalendarKind } from "../types";

type Mode = "list" | "create" | "edit";

export interface CalendarSettingsModalProps {
  calendars: Calendar[];
  currentUserId?: string;
  onClose: () => void;
  /** Called after a calendar is created or renamed, so the caller can refetch its calendar list. */
  onChange?: () => void;
}

export function CalendarSettingsModal({ calendars, currentUserId, onClose, onChange }: CalendarSettingsModalProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [newCalendarKind, setNewCalendarKind] = useState<CalendarKind>("group");
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);

  const { createCalendar, error: createError } = useCreateCalendar();
  const { updateCalendar, error: updateError } = useUpdateCalendar();
  const { members, refetch: refetchMembers } = useCalendarMembers(selectedCalendarId ?? "");
  const { removeMember } = useRemoveMember();
  const { createInvite } = useCreateInvite();

  const selectedCalendar = calendars.find((calendar) => calendar.id === selectedCalendarId) ?? null;
  const isOwner = members.some((member) => member.userId === currentUserId && member.role === "owner");

  const backToList = () => {
    setMode("list");
    setSelectedCalendarId(null);
    setGeneratedInviteCode(null);
  };

  const handleSelectCalendar = (calendar: Calendar) => {
    setSelectedCalendarId(calendar.id);
    setNameDraft(calendar.name);
    setGeneratedInviteCode(null);
    setMode("edit");
  };

  const handleStartCreate = () => {
    setNameDraft("");
    setNewCalendarKind("group");
    setMode("create");
  };

  const handleCreate = async () => {
    const created = await createCalendar({ name: nameDraft, kind: newCalendarKind });
    if (created) {
      onChange?.();
      setSelectedCalendarId(created.id);
      setNameDraft(created.name);
      setMode("edit");
    }
  };

  const handleSaveName = async () => {
    if (!selectedCalendarId) return;
    const success = await updateCalendar(selectedCalendarId, { name: nameDraft });
    if (success) {
      onChange?.();
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedCalendarId) return;
    const success = await removeMember(selectedCalendarId, userId);
    if (success) await refetchMembers();
  };

  const handleGenerateInvite = async () => {
    if (!selectedCalendarId) return;
    const invite = await createInvite(selectedCalendarId);
    if (invite) setGeneratedInviteCode(invite.code);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        testID="calendar-settings-backdrop"
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.title}>カレンダー設定</Text>
              <TouchableOpacity testID="calendar-settings-close" onPress={onClose}>
                <Text style={styles.closeText}>閉じる</Text>
              </TouchableOpacity>
            </View>

            {mode === "list" ? (
              <View style={styles.listSection}>
                {calendars.length === 0 ? (
                  <Text style={styles.emptyText}>カレンダーがありません</Text>
                ) : (
                  calendars.map((calendar) => (
                    <TouchableOpacity
                      key={calendar.id}
                      testID={`calendar-settings-calendar-${calendar.id}`}
                      style={styles.calendarRow}
                      onPress={() => handleSelectCalendar(calendar)}
                    >
                      <Text style={styles.calendarRowName}>{calendar.name}</Text>
                      <Text style={styles.calendarRowKind}>
                        {calendar.kind === "personal" ? "個人用" : "グループ"}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  testID="calendar-settings-new-button"
                  style={styles.newButton}
                  onPress={handleStartCreate}
                >
                  <Icon name="plus" size={14} color="#fff" />
                  <Text style={styles.newButtonText}>新規追加</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formSection}>
                <TouchableOpacity testID="calendar-settings-back-to-list" onPress={backToList}>
                  <Text style={styles.backText}>← 一覧に戻る</Text>
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>カレンダー名</Text>
                <TextInput
                  testID="calendar-settings-name-input"
                  style={styles.input}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                />

                {mode === "create" ? (
                  <>
                    <Text style={styles.sectionLabel}>種類</Text>
                    <View style={styles.kindRow}>
                      <TouchableOpacity
                        testID="calendar-settings-kind-personal"
                        style={[styles.kindButton, newCalendarKind === "personal" && styles.kindButtonSelected]}
                        onPress={() => setNewCalendarKind("personal")}
                      >
                        <Text
                          style={
                            newCalendarKind === "personal" ? styles.kindButtonTextSelected : styles.kindButtonText
                          }
                        >
                          個人用
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID="calendar-settings-kind-group"
                        style={[styles.kindButton, newCalendarKind === "group" && styles.kindButtonSelected]}
                        onPress={() => setNewCalendarKind("group")}
                      >
                        <Text
                          style={newCalendarKind === "group" ? styles.kindButtonTextSelected : styles.kindButtonText}
                        >
                          グループ
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {createError ? (
                      <Text style={styles.errorText}>{getCalendarErrorMessageJa(createError)}</Text>
                    ) : null}
                    <TouchableOpacity
                      testID="calendar-settings-create-submit"
                      style={styles.saveButton}
                      onPress={handleCreate}
                    >
                      <Text style={styles.saveButtonText}>作成</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {updateError ? (
                      <Text style={styles.errorText}>{getCalendarErrorMessageJa(updateError)}</Text>
                    ) : null}
                    <TouchableOpacity
                      testID="calendar-settings-save-name"
                      style={styles.saveButton}
                      onPress={handleSaveName}
                    >
                      <Text style={styles.saveButtonText}>名前を保存</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionLabel}>所属するユーザー</Text>
                    {members.map((member) => (
                      <View key={member.userId} style={styles.memberRow}>
                        <Text>
                          {member.displayName ?? (member.userId === currentUserId ? "自分" : "メンバー")}
                        </Text>
                        {isOwner && member.role !== "owner" ? (
                          <TouchableOpacity
                            testID={`calendar-settings-remove-member-${member.userId}`}
                            onPress={() => handleRemoveMember(member.userId)}
                          >
                            <Text style={styles.removeText}>削除</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))}
                    <TouchableOpacity testID="calendar-settings-invite-button" onPress={handleGenerateInvite}>
                      <Text style={styles.inviteText}>招待コードを発行</Text>
                    </TouchableOpacity>
                    {generatedInviteCode ? (
                      <Text testID="calendar-settings-invite-code" style={styles.inviteCode}>
                        {generatedInviteCode}
                      </Text>
                    ) : null}

                    <TouchableOpacity
                      testID="calendar-settings-manage-tags"
                      style={styles.tagButton}
                      onPress={() => setIsTagModalVisible(true)}
                    >
                      <Text style={styles.tagButtonText}>タグ管理</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>

      {isTagModalVisible && selectedCalendar ? (
        <TagManagementModal
          calendars={[selectedCalendar]}
          initialCalendarId={selectedCalendar.id}
          onClose={() => setIsTagModalVisible(false)}
          onChange={onChange}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    width: "88%",
    maxHeight: "80%",
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  listSection: {
    gap: 8,
  },
  emptyText: {
    color: "#999",
    paddingVertical: 8,
  },
  calendarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  calendarRowName: {
    fontSize: 15,
  },
  calendarRowKind: {
    color: "#999",
    fontSize: 12,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#2f6fed",
  },
  newButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  formSection: {
    gap: 10,
  },
  backText: {
    color: "#2f6fed",
  },
  sectionLabel: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  kindRow: {
    flexDirection: "row",
    gap: 8,
  },
  kindButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  kindButtonSelected: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  kindButtonText: {
    color: "#444",
  },
  kindButtonTextSelected: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  errorText: {
    color: "#d32f2f",
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
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  removeText: {
    color: "#d32f2f",
  },
  inviteText: {
    color: "#2f6fed",
    fontWeight: "700",
    marginTop: 4,
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
  tagButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#2f6fed",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagButtonText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
});
