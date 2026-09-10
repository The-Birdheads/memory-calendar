import { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useEventsInRange } from "../../events/hooks";
import { formatDateTimeRange, jstNow } from "../../../shared/utils/formatDateTime";
import { useReattachTodoToExistingEvent, useReattachTodoToNewPersonalEvent } from "../hooks";
import type { Todo } from "../types";

export interface ReattachTodoModalProps {
  todo: Todo;
  calendars: { id: string; name: string }[];
  onClose: () => void;
  onReattached: () => void;
}

type Mode = "existing" | "new";

function isoDaysFromNow(days: number): string {
  return new Date(jstNow().getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function ReattachTodoModal({ todo, calendars, onClose, onReattached }: ReattachTodoModalProps) {
  const [mode, setMode] = useState<Mode>("existing");
  const [selectedCalendarId, setSelectedCalendarId] = useState(calendars[0]?.id ?? "");
  // A wide, fixed window (30 days back to 180 days ahead) so the picker
  // covers "閲覧可能な予定" without needing its own calendar-grid navigation.
  const range = useMemo(() => ({ start: isoDaysFromNow(-30), end: isoDaysFromNow(180) }), []);
  const { events } = useEventsInRange(selectedCalendarId, range);
  const { reattachTodoToExistingEvent, isSubmitting: isReattaching } = useReattachTodoToExistingEvent();
  const { reattachTodoToNewPersonalEvent, isSubmitting: isCreating } = useReattachTodoToNewPersonalEvent();

  const [newTitle, setNewTitle] = useState(todo.title);
  const [newDate, setNewDate] = useState("");

  const handleSelectEvent = async (eventId: string) => {
    const success = await reattachTodoToExistingEvent(todo.id, eventId);
    if (success) onReattached();
  };

  const handleCreateNew = async () => {
    if (!newDate.trim()) return;
    const success = await reattachTodoToNewPersonalEvent(todo.id, { title: newTitle, date: newDate });
    if (success) onReattached();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableOpacity testID="reattach-todo-backdrop" style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              「{todo.title}」を予定に紐付ける
            </Text>
            <TouchableOpacity testID="reattach-todo-close" onPress={onClose}>
              <Text style={styles.closeText}>閉じる</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modeRow}>
            <TouchableOpacity
              testID="reattach-todo-mode-existing"
              style={[styles.modeButton, mode === "existing" && styles.modeButtonActive]}
              onPress={() => setMode("existing")}
            >
              <Text>既存の予定を選ぶ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="reattach-todo-mode-new"
              style={[styles.modeButton, mode === "new" && styles.modeButtonActive]}
              onPress={() => setMode("new")}
            >
              <Text>新規予定を作成</Text>
            </TouchableOpacity>
          </View>

          {mode === "existing" ? (
            <>
              <View style={styles.calendarSwitcher}>
                {calendars.map((calendar) => (
                  <TouchableOpacity
                    key={calendar.id}
                    testID={`reattach-todo-calendar-${calendar.id}`}
                    style={[styles.calendarChip, calendar.id === selectedCalendarId && styles.calendarChipActive]}
                    onPress={() => setSelectedCalendarId(calendar.id)}
                  >
                    <Text>{calendar.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FlatList
                testID="reattach-todo-event-list"
                data={events}
                keyExtractor={(event) => event.id}
                renderItem={({ item: event }) => (
                  <TouchableOpacity
                    testID={`reattach-todo-event-${event.id}`}
                    style={styles.eventRow}
                    onPress={() => handleSelectEvent(event.id)}
                    disabled={isReattaching}
                  >
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDate}>
                      {formatDateTimeRange(event.startAt, event.endAt, event.isAllDay)}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>このカレンダーには予定がありません</Text>}
              />
            </>
          ) : (
            // 「新規予定を作成」フォームだけ、キーボードで下の入力欄/ボタンが
            // 隠れないようScrollViewで包む(既存予定を選ぶ方はFlatList自体が
            // スクロールするので不要 - 2026-09追加)。
            <ScrollView style={styles.newFormScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.newForm}>
                <Text style={styles.sectionLabel}>予定のタイトル</Text>
                <TextInput
                  testID="reattach-todo-new-title-input"
                  style={styles.input}
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
                <Text style={styles.sectionLabel}>日付</Text>
                <TextInput
                  testID="reattach-todo-new-date-input"
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={newDate}
                  onChangeText={setNewDate}
                />
                <Text style={styles.hint}>あなたの個人用カレンダーに新規予定が作成されます</Text>
                <TouchableOpacity
                  testID="reattach-todo-new-submit"
                  style={styles.submitButton}
                  onPress={handleCreateNew}
                  disabled={isCreating}
                >
                  <Text style={styles.submitButtonText}>作成して紐付ける</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
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
    width: "90%",
    maxHeight: "80%",
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  closeText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  calendarSwitcher: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  calendarChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  calendarChipActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  eventRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  eventDate: {
    color: "#999",
    fontSize: 12,
  },
  emptyText: {
    color: "#999",
    paddingVertical: 12,
  },
  newFormScroll: {
    flexGrow: 0,
  },
  newForm: {
    gap: 8,
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
  hint: {
    color: "#999",
    fontSize: 12,
  },
  submitButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2f6fed",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
