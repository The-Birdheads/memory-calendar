import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";
import { PersonalSettingsPanel } from "../../profile/components/PersonalSettingsPanel";
import { TagFormScreen, TagListScreen } from "../../tags/components/TagManagementScreens";
import type { Tag } from "../../tags/types";
import {
  CalendarCreatedScreen,
  CalendarCreateScreen,
  CalendarEditScreen,
  CalendarJoinScreen,
  CalendarListScreen,
} from "./CalendarSettingsScreens";
import { InviteScreen } from "./InviteScreen";
import type { Calendar } from "../types";

/** 設定まわりの全画面を1つのスタックとして表現する。どの画面も
 * 「1画面進む→スタックに push」「1画面戻る→スタックから pop」の
 * 単純な操作だけで遷移し、「設定に戻る」「一覧に戻る」のような
 * 画面ごとに異なる戻り先ラベルは持たない(常に1つ前の画面に戻る)。 */
type Screen =
  | { name: "hub" }
  | { name: "personal" }
  | { name: "calendar-list" }
  | { name: "calendar-create" }
  | { name: "calendar-join" }
  | { name: "calendar-created"; calendarId: string; calendarName: string }
  | { name: "calendar-edit"; calendarId: string }
  | { name: "tag-list" }
  | { name: "tag-create" }
  | { name: "tag-edit"; tagId: string }
  | { name: "invite"; calendarId: string };

export interface SettingsHubModalProps {
  calendars: Calendar[];
  currentUserId?: string;
  onClose: () => void;
  /** Called after a calendar is created or renamed, so the caller can refetch its calendar list. */
  onChange?: () => void;
  /**
   * Opens straight into a specific section (and, for "calendar", straight
   * into its create form) instead of the hub list - for entry points that
   * already know what the user wants (e.g. the Calendar タブ's
   * 「共有カレンダーを作る」バナー jumps directly to section="calendar" +
   * calendarMode="create", skipping "設定を開く→カレンダー設定を選ぶ" hop).
   */
  initialSection?: "hub" | "personal" | "calendar";
  initialCalendarMode?: "list" | "create";
}

function titleFor(screen: Screen, calendars: Calendar[]): string {
  switch (screen.name) {
    case "hub":
      return "設定";
    case "personal":
      return "個人設定";
    case "calendar-list":
      return "カレンダー設定";
    case "calendar-create":
      return "共有カレンダーを作る";
    case "calendar-join":
      return "招待コードで参加";
    case "calendar-created":
      return "作成しました";
    case "calendar-edit":
      return calendars.find((calendar) => calendar.id === screen.calendarId)?.name ?? "カレンダー設定";
    case "tag-list":
      return "タグ管理";
    case "tag-create":
      return "タグを追加";
    case "tag-edit":
      return "タグを編集";
    case "invite":
      return "メンバーを招待";
  }
}

function initialStack(
  initialSection: "hub" | "personal" | "calendar",
  initialCalendarMode?: "list" | "create",
): Screen[] {
  if (initialSection === "personal") return [{ name: "hub" }, { name: "personal" }];
  if (initialSection === "calendar") {
    const stack: Screen[] = [{ name: "hub" }, { name: "calendar-list" }];
    if (initialCalendarMode === "create") stack.push({ name: "calendar-create" });
    return stack;
  }
  return [{ name: "hub" }];
}

export function SettingsHubModal({
  calendars,
  currentUserId,
  onClose,
  onChange,
  initialSection = "hub",
  initialCalendarMode,
}: SettingsHubModalProps) {
  const [stack, setStack] = useState<Screen[]>(() => initialStack(initialSection, initialCalendarMode));
  const current = stack[stack.length - 1];

  const push = (screen: Screen) => setStack((prev) => [...prev, screen]);
  const pop = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const replace = (screen: Screen) => setStack((prev) => [...prev.slice(0, -1), screen]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableOpacity testID="settings-hub-backdrop" style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <View style={styles.header}>
            {stack.length > 1 ? (
              <TouchableOpacity testID="settings-hub-back" style={styles.headerSideButton} onPress={pop}>
                <Text style={styles.backIcon}>←</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSideButton} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {titleFor(current, calendars)}
            </Text>
            <TouchableOpacity testID="settings-hub-close" style={styles.headerSideButton} onPress={onClose}>
              <Icon name="close" size={16} color="#666" />
            </TouchableOpacity>
          </View>

          {current.name === "hub" ? (
            <View style={styles.list}>
              <TouchableOpacity
                testID="settings-hub-open-personal"
                style={styles.row}
                onPress={() => push({ name: "personal" })}
              >
                <Text style={styles.rowText}>個人設定</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="settings-hub-open-calendar"
                style={styles.row}
                onPress={() => push({ name: "calendar-list" })}
              >
                <Text style={styles.rowText}>カレンダー設定</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="settings-hub-open-tags"
                style={styles.row}
                onPress={() => push({ name: "tag-list" })}
              >
                <Text style={styles.rowText}>タグ設定</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {current.name === "personal" && currentUserId ? <PersonalSettingsPanel userId={currentUserId} /> : null}

          {current.name === "calendar-list" ? (
            <CalendarListScreen
              calendars={calendars}
              onSelectCalendar={(calendar) => push({ name: "calendar-edit", calendarId: calendar.id })}
              onStartCreate={() => push({ name: "calendar-create" })}
              onStartJoin={() => push({ name: "calendar-join" })}
            />
          ) : null}

          {current.name === "calendar-create" ? (
            <CalendarCreateScreen
              calendars={calendars}
              onChange={onChange}
              onCreated={(calendar) =>
                replace({ name: "calendar-created", calendarId: calendar.id, calendarName: calendar.name })
              }
            />
          ) : null}

          {current.name === "calendar-join" ? (
            <CalendarJoinScreen onChange={onChange} onJoined={() => replace({ name: "calendar-list" })} />
          ) : null}

          {current.name === "calendar-created" ? (
            <CalendarCreatedScreen
              calendarName={current.calendarName}
              onInvite={() =>
                setStack((prev) => [
                  ...prev.slice(0, -1),
                  { name: "calendar-edit", calendarId: current.calendarId },
                  { name: "invite", calendarId: current.calendarId },
                ])
              }
              onLater={() => replace({ name: "calendar-edit", calendarId: current.calendarId })}
            />
          ) : null}

          {current.name === "calendar-edit" ? (
            <CalendarEditScreen
              calendarId={current.calendarId}
              currentUserId={currentUserId}
              calendars={calendars}
              onChange={onChange}
              onManageTags={() => push({ name: "tag-list" })}
              onInvite={() => push({ name: "invite", calendarId: current.calendarId })}
              onLeftOrDeleted={() => replace({ name: "calendar-list" })}
            />
          ) : null}

          {current.name === "tag-list" ? (
            <TagListScreen
              onSelectTag={(tag: Tag) => push({ name: "tag-edit", tagId: tag.id })}
              onStartCreate={() => push({ name: "tag-create" })}
            />
          ) : null}

          {current.name === "tag-create" ? (
            <TagFormScreen tagId={null} onChange={onChange} onSaved={pop} />
          ) : null}

          {current.name === "tag-edit" ? (
            <TagFormScreen tagId={current.tagId} onChange={onChange} onSaved={pop} />
          ) : null}

          {current.name === "invite" ? (
            <InviteScreen calendarId={current.calendarId} currentUserId={currentUserId} />
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
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
    gap: 8,
  },
  headerSideButton: {
    width: 28,
    alignItems: "center",
  },
  backIcon: {
    fontSize: 20,
    color: "#2f6fed",
    fontWeight: "700",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  list: {
    gap: 8,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowText: {
    fontSize: 16,
  },
});
