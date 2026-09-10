import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ColorSwatchPicker } from "../../../shared/components/ColorSwatchPicker";
import { Icon } from "../../../shared/components/Icon";
import { COLOR_PALETTE } from "../../../shared/constants/colorPalette";
import { findColorUsage, type ColorUsageEntry } from "../../../shared/utils/colorUsage";
import { flattenTagTree } from "../../tags/tagTree";
import { useTagTree } from "../../tags/hooks";
import {
  useCalendarMembers,
  useCreateCalendar,
  useJoinByInvite,
  useLeaveOrDeleteCalendar,
  useUpdateCalendar,
} from "../hooks";
import { getCalendarErrorMessageJa } from "../service";
import type { Calendar } from "../types";
import { CalendarLabel } from "./CalendarLabel";
import { LeaveOrDeleteCalendarConfirmModal } from "./LeaveOrDeleteCalendarConfirmModal";

/** カレンダー設定まわりの各画面 - すべて中身のみ(Modal/ヘッダー/戻るボタンを
 * 持たない)。ナビゲーションは SettingsHubModal が持つ単一の画面スタックに
 * 委ねる。 */

/** パレットの各色について、他のカレンダー/タグでの使用状況をまとめる
 * (`ColorSwatchPicker`にそのまま渡せる形)。 */
function buildUsageByColor(
  calendars: Calendar[],
  tags: ReturnType<typeof flattenTagTree>,
  excludeCalendarId?: string
): Record<string, ColorUsageEntry> {
  return Object.fromEntries(
    COLOR_PALETTE.map((color) => [color.hex, findColorUsage(color.hex, calendars, tags, { excludeCalendarId })])
  );
}

export interface CalendarListScreenProps {
  calendars: Calendar[];
  onSelectCalendar: (calendar: Calendar) => void;
  onStartCreate: () => void;
  onStartJoin: () => void;
}

export function CalendarListScreen({
  calendars,
  onSelectCalendar,
  onStartCreate,
  onStartJoin,
}: CalendarListScreenProps) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.listSection}>
        {calendars.length === 0 ? (
          <Text style={styles.emptyText}>カレンダーがありません</Text>
        ) : (
          calendars.map((calendar) => (
            <TouchableOpacity
              key={calendar.id}
              testID={`calendar-settings-calendar-${calendar.id}`}
              style={styles.calendarRow}
              onPress={() => onSelectCalendar(calendar)}
            >
              <View style={styles.calendarRowLeft}>
                <View testID={`calendar-settings-color-dot-${calendar.id}`} style={[styles.colorDot, { backgroundColor: calendar.color }]} />
                <CalendarLabel calendar={calendar} textStyle={styles.calendarRowName} />
              </View>
              <Text style={styles.calendarRowKind}>{calendar.kind === "personal" ? "個人用" : "共有"}</Text>
            </TouchableOpacity>
          ))
        )}
        <View style={styles.listActions}>
          <TouchableOpacity testID="calendar-settings-new-button" style={styles.newButton} onPress={onStartCreate}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={styles.newButtonText}>共有カレンダーを作る</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="calendar-settings-join-button" style={styles.joinButton} onPress={onStartJoin}>
            <Text style={styles.joinButtonText}>招待コードで参加</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

export interface CalendarCreateScreenProps {
  calendars: Calendar[];
  onChange?: () => void;
  onCreated: (calendar: Calendar) => void;
}

export function CalendarCreateScreen({ calendars, onChange, onCreated }: CalendarCreateScreenProps) {
  const [nameDraft, setNameDraft] = useState("");
  const [colorDraft, setColorDraft] = useState(COLOR_PALETTE[0].hex);
  const { createCalendar, error: createError } = useCreateCalendar();
  const { tagTree } = useTagTree();
  const allTags = useMemo(() => flattenTagTree(tagTree), [tagTree]);
  const usageByColor = useMemo(() => buildUsageByColor(calendars, allTags), [calendars, allTags]);

  const handleCreate = async () => {
    const created = await createCalendar({ name: nameDraft, color: colorDraft });
    if (created) {
      onChange?.();
      onCreated(created);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.formSection}>
        <Text testID="calendar-settings-create-description" style={styles.createFormDescription}>
          家族や友人と予定を共有できる、新しいカレンダーを作成します。作成後に招待コードで誘えます。
        </Text>

        <Text style={styles.sectionLabel}>カレンダー名</Text>
        <TextInput
          testID="calendar-settings-name-input"
          style={styles.input}
          value={nameDraft}
          onChangeText={setNameDraft}
        />

        <Text style={styles.sectionLabel}>色（タグのない予定はこの色で表示されます）</Text>
        <ColorSwatchPicker
          testIDPrefix="calendar-settings-color"
          selected={colorDraft}
          onSelect={setColorDraft}
          usageByColor={usageByColor}
        />

        {createError ? <Text style={styles.errorText}>{getCalendarErrorMessageJa(createError)}</Text> : null}
        <TouchableOpacity testID="calendar-settings-create-submit" style={styles.saveButton} onPress={handleCreate}>
          <Text style={styles.saveButtonText}>作成</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export interface CalendarJoinScreenProps {
  onChange?: () => void;
  onJoined: () => void;
}

export function CalendarJoinScreen({ onChange, onJoined }: CalendarJoinScreenProps) {
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const { joinByInvite, error: joinError } = useJoinByInvite();

  const handleJoin = async () => {
    const joined = await joinByInvite(joinCodeDraft);
    if (joined) {
      onChange?.();
      onJoined();
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>招待コード</Text>
        <TextInput
          testID="calendar-settings-join-code-input"
          style={styles.input}
          placeholder="招待コード"
          value={joinCodeDraft}
          onChangeText={setJoinCodeDraft}
          autoCapitalize="none"
        />
        {joinError ? <Text style={styles.errorText}>{getCalendarErrorMessageJa(joinError)}</Text> : null}
        <TouchableOpacity testID="calendar-settings-join-submit" style={styles.saveButton} onPress={handleJoin}>
          <Text style={styles.saveButtonText}>参加</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export interface CalendarCreatedScreenProps {
  calendarName: string;
  onInvite: () => void;
  onLater: () => void;
}

export function CalendarCreatedScreen({ calendarName, onInvite, onLater }: CalendarCreatedScreenProps) {
  return (
    <View style={styles.createdSection} testID="calendar-settings-created">
      <Text style={styles.createdTitle}>「{calendarName}」を作成しました</Text>
      <Text style={styles.createdDescription}>
        招待コードを発行して伝えると、家族や友人がこのカレンダーに参加して予定を共有できます。
      </Text>
      <TouchableOpacity testID="calendar-settings-created-invite" style={styles.saveButton} onPress={onInvite}>
        <Text style={styles.saveButtonText}>招待する</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="calendar-settings-created-later" onPress={onLater}>
        <Text style={styles.backText}>あとで招待する</Text>
      </TouchableOpacity>
    </View>
  );
}

export interface CalendarEditScreenProps {
  calendarId: string;
  currentUserId?: string;
  calendars: Calendar[];
  onChange?: () => void;
  onManageTags: () => void;
  onInvite: () => void;
  onLeftOrDeleted: () => void;
}

export function CalendarEditScreen({
  calendarId,
  currentUserId,
  calendars,
  onChange,
  onManageTags,
  onInvite,
  onLeftOrDeleted,
}: CalendarEditScreenProps) {
  const selectedCalendar = calendars.find((calendar) => calendar.id === calendarId) ?? null;
  const [nameDraft, setNameDraft] = useState(selectedCalendar?.name ?? "");
  const [colorDraft, setColorDraft] = useState(selectedCalendar?.color ?? COLOR_PALETTE[0].hex);
  const [isLeaveConfirmVisible, setIsLeaveConfirmVisible] = useState(false);

  const { updateCalendar, error: updateError } = useUpdateCalendar();
  const { members } = useCalendarMembers(calendarId);
  const { leaveOrDeleteCalendar, error: leaveError } = useLeaveOrDeleteCalendar();
  const { tagTree } = useTagTree();
  const allTags = useMemo(() => flattenTagTree(tagTree), [tagTree]);
  const usageByColor = useMemo(
    () => buildUsageByColor(calendars, allTags, calendarId),
    [calendars, allTags, calendarId]
  );

  const handleSave = async () => {
    const success = await updateCalendar(calendarId, { name: nameDraft, color: colorDraft });
    if (success) onChange?.();
  };

  const handleConfirmLeaveOrDelete = async () => {
    const deleted = await leaveOrDeleteCalendar(calendarId);
    if (deleted !== null) {
      setIsLeaveConfirmVisible(false);
      onChange?.();
      onLeftOrDeleted();
    }
  };

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formSection}>
          {selectedCalendar?.kind === "personal" ? (
            <View testID="calendar-settings-personal-note" style={styles.personalNoteRow}>
              <Icon name="lock" size={14} color="#666" />
              <Text style={styles.personalNote}>
                個人用カレンダー(サインアップ時に自動作成されるあなた専用のカレンダーです。削除やメンバー招待はできません)
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>カレンダー名</Text>
          <TextInput
            testID="calendar-settings-name-input"
            style={styles.input}
            value={nameDraft}
            onChangeText={setNameDraft}
          />

          <Text style={styles.sectionLabel}>色（タグのない予定はこの色で表示されます）</Text>
          <ColorSwatchPicker
            testIDPrefix="calendar-settings-color"
            selected={colorDraft}
            onSelect={setColorDraft}
            usageByColor={usageByColor}
          />

          {updateError ? <Text style={styles.errorText}>{getCalendarErrorMessageJa(updateError)}</Text> : null}
          <TouchableOpacity
            testID="calendar-settings-save-button"
            style={styles.saveButton}
            onPress={handleSave}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.saveButtonText}>✓</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>所属するユーザー</Text>
          {members.map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <Text>{member.displayName ?? (member.userId === currentUserId ? "自分" : "メンバー")}</Text>
            </View>
          ))}
          {selectedCalendar?.kind !== "personal" ? (
            <TouchableOpacity testID="calendar-settings-invite-button" onPress={onInvite}>
              <Text style={styles.inviteText}>招待コードを発行</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity testID="calendar-settings-manage-tags" style={styles.tagButton} onPress={onManageTags}>
            <Text style={styles.tagButtonText}>タグ管理</Text>
          </TouchableOpacity>

          {selectedCalendar?.kind !== "personal" ? (
            <>
              {leaveError ? <Text style={styles.errorText}>{getCalendarErrorMessageJa(leaveError)}</Text> : null}
              <TouchableOpacity
                testID="calendar-settings-leave-or-delete-button"
                style={styles.leaveButton}
                onPress={() => setIsLeaveConfirmVisible(true)}
              >
                <Text style={styles.leaveButtonText}>
                  {members.length > 1 ? "カレンダーから抜ける" : "カレンダーを削除"}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </ScrollView>

      <LeaveOrDeleteCalendarConfirmModal
        visible={isLeaveConfirmVisible}
        willDeleteEntirely={members.length <= 1}
        onConfirm={handleConfirmLeaveOrDelete}
        onCancel={() => setIsLeaveConfirmVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  calendarRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calendarRowName: {
    fontSize: 15,
  },
  calendarRowKind: {
    color: "#999",
    fontSize: 12,
  },
  listActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#2f6fed",
  },
  newButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  joinButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2f6fed",
  },
  joinButtonText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  formSection: {
    gap: 10,
  },
  createFormDescription: {
    color: "#666",
    fontSize: 13,
  },
  createdSection: {
    gap: 12,
  },
  createdTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  createdDescription: {
    color: "#666",
    fontSize: 13,
  },
  backText: {
    color: "#2f6fed",
  },
  sectionLabel: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  personalNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#f2f3f5",
    borderRadius: 8,
    padding: 10,
  },
  personalNote: {
    flex: 1,
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
  inviteText: {
    color: "#2f6fed",
    fontWeight: "700",
    marginTop: 4,
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
  leaveButton: {
    alignSelf: "flex-start",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#d32f2f",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leaveButtonText: {
    color: "#d32f2f",
    fontWeight: "700",
  },
});
