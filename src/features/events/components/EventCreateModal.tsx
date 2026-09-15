import { useEffect, useState } from "react";
import {
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

import type { Calendar } from "../../calendars/types";
import { CalendarLabel } from "../../calendars/components/CalendarLabel";
import { useAttachPhoto } from "../../memories/hooks";
import { pickPhotoFromLibrary } from "../../memories/imagePicker";
import type { PhotoUploadInput } from "../../memories/types";
import { TagPickerRow } from "../../tags/components/TagPickerRow";
import { useAttachTagsToEvent } from "../../tags/hooks";
import type { TagTreeNode } from "../../tags/types";
import { useCreateTodo } from "../../../features/todos/hooks";
import { Icon } from "../../../shared/components/Icon";
import { PersonalOnlyBadge } from "../../../shared/components/PersonalOnlyBadge";
import { toJstDateKey, todayJstDateKey } from "../../../shared/utils/formatDateTime";
import { EventFormFields, type EventFormValue } from "./EventFormFields";
import { useCreateDefaultEventReminders, useCreateEvent } from "../hooks";
import { getEventErrorMessageJa } from "../service";

export interface EventCreateModalProps {
  visible: boolean;
  onClose: () => void;
  /** 作成成功後に呼ばれる(呼び出し側の一覧の再取得用)。 */
  onCreated: () => void;
  calendars: Calendar[];
  /** モーダルを開いた時点で選択しておくカレンダー。 */
  defaultCalendarId: string;
  tagTree: TagTreeNode[];
  /** モーダルを開いた時点で予定日欄に入れておく日付("YYYY-MM-DD")。 */
  initialDateKey: string;
}

/**
 * 予定作成モーダル - カレンダー画面・振り返りタブ(年表)の+ボタンから共通で
 * 使う(2026-09切り出し)。過去日を指定している間は、その場で思い出の画像も
 * 登録できる。
 */
export function EventCreateModal({
  visible,
  onClose,
  onCreated,
  calendars,
  defaultCalendarId,
  tagTree,
  initialDateKey,
}: EventCreateModalProps) {
  const [newEventCalendarId, setNewEventCalendarId] = useState(defaultCalendarId);
  const newEventCalendarKind = calendars.find((calendar) => calendar.id === newEventCalendarId)?.kind;
  const [newEventForm, setNewEventForm] = useState<EventFormValue>(() => ({
    title: "",
    isAllDay: true,
    start: new Date(`${initialDateKey}T09:00:00.000Z`),
    end: new Date(`${initialDateKey}T09:00:00.000Z`),
    location: "",
    url: "",
    memo: "",
  }));
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [hasTodos, setHasTodos] = useState(false);
  const [todoItems, setTodoItems] = useState<string[]>([]);
  const [newTodoItemText, setNewTodoItemText] = useState("");
  const [stagedMemoryPhoto, setStagedMemoryPhoto] = useState<PhotoUploadInput | null>(null);

  // 開くたびに前回の入力を引きずらないよう、表示状態が切り替わった瞬間に
  // 初期化する(EventDetailModal等、他のnullable-targetモーダルと同じ形)。
  useEffect(() => {
    if (!visible) return;
    const base = new Date(`${initialDateKey}T09:00:00.000Z`);
    setNewEventForm({
      title: "",
      isAllDay: true,
      start: base,
      end: base,
      location: "",
      url: "",
      memo: "",
    });
    setNewEventCalendarId(defaultCalendarId);
    setSelectedTagIds([]);
    setHasTodos(false);
    setTodoItems([]);
    setNewTodoItemText("");
    setStagedMemoryPhoto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const { attachTagsToEvent } = useAttachTagsToEvent();
  const { createEvent, isSubmitting: isCreatingEvent, error: createEventError } = useCreateEvent();
  const { createDefaultEventReminders } = useCreateDefaultEventReminders();
  const { createTodo } = useCreateTodo();
  const { attachPhoto } = useAttachPhoto();

  // 過去日で予定を作る(記録目的の後追い入力)場合、作成直後にその場で思い出の
  // 写真も登録できるようにする。終日予定は「終了時刻」ではなくJSTの暦日で
  // 今日以降かどうかを見る - 終日予定のstart/endは当日09:00Zに固定している
  // ため、素直に現在時刻と比較すると同日でも9時JST18時を過ぎた時点で「過去」
  // と誤判定してしまう。
  // todayJstDateKey()(下の分岐)も内部でDate.now()を呼んでいるが、named
  // function越しだと検出されない。フォームの入力値に対して「今より前か」を
  // 都度判定するだけの表示条件で、同じく副作用のない安全な参照。
  const isNewEventPastAllDay = toJstDateKey(newEventForm.end.toISOString()) < todayJstDateKey();
  // eslint-disable-next-line react-hooks/purity -- 上のコメント参照
  const isNewEventPastTimed = newEventForm.end.getTime() < Date.now();
  const isNewEventPast = newEventForm.isAllDay ? isNewEventPastAllDay : isNewEventPastTimed;

  const handleSelectEventCalendar = (calendarId: string) => {
    setNewEventCalendarId(calendarId);
    // The previously selected tags belong to the OLD calendar and won't
    // exist in the new one's tag tree, so clear them.
    setSelectedTagIds([]);
  };

  const handleToggleTagSelection = (tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleAddTodoItem = () => {
    if (!newTodoItemText.trim()) return;
    setTodoItems((prev) => [...prev, newTodoItemText.trim()]);
    setNewTodoItemText("");
  };

  const handleRemoveTodoItem = (index: number) => {
    setTodoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickMemoryPhoto = async () => {
    const picked = await pickPhotoFromLibrary();
    if (picked) setStagedMemoryPhoto(picked);
  };

  const handleCreateEvent = async () => {
    // 連打で同じ予定が2件作られてしまう不具合の修正 - useCreateEventの
    // isSubmittingが立っている間の再入をブロックする(下のボタン側の
    // disabledと二重で防御する)。
    if (isCreatingEvent) return;
    const createdEvent = await createEvent({
      calendarId: newEventCalendarId,
      title: newEventForm.title,
      startAt: newEventForm.start.toISOString(),
      endAt: newEventForm.end.toISOString(),
      isAllDay: newEventForm.isAllDay,
      location: newEventForm.location || undefined,
      url: newEventForm.url || undefined,
      memo: newEventForm.memo || undefined,
    });
    if (createdEvent) {
      if (hasTodos) {
        for (const title of todoItems) {
          await createTodo({ eventId: createdEvent.id, title });
        }
      }
      if (selectedTagIds.length > 0) {
        await attachTagsToEvent(createdEvent.id, selectedTagIds);
      }
      // 過去日で登録した予定(記録目的の後追い入力)にその場で選んだ思い出の
      // 写真があれば、作成直後に紐付ける。
      if (isNewEventPast && stagedMemoryPhoto) {
        await attachPhoto(createdEvent.id, stagedMemoryPhoto);
      }
      // 自分の意思でリマインドを設定しなくても最低限通知が届くよう、
      // 作成直後に既定のリマインド(終日: 当日+1日前 / 時刻指定: 10分前)を設定する。
      // ただし過去日で登録した予定には設定しない(既に終わったことへの
      // リマインドは意味がなく、登録直後に届いてしまうため)。
      if (!isNewEventPast) {
        await createDefaultEventReminders(createdEvent.id, newEventForm.isAllDay);
      }
      onClose();
      onCreated();
    }
  };

  const todoSection = hasTodos ? (
    <View style={styles.todoChecklist}>
      {todoItems.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.todoChecklistRow} testID={`event-create-todo-item-${index}`}>
          <Text style={styles.todoChecklistText}>{item}</Text>
          <TouchableOpacity
            testID={`event-create-todo-item-${index}-remove`}
            onPress={() => handleRemoveTodoItem(index)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="trash" size={16} color="#d32f2f" />
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.todoAddRow}>
        <TextInput
          testID="event-create-todo-input"
          style={styles.input}
          placeholder="ToDoを入力"
          value={newTodoItemText}
          onChangeText={setNewTodoItemText}
        />
        <TouchableOpacity testID="event-create-todo-add" onPress={handleAddTodoItem}>
          <Text>追加</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    <TouchableOpacity
      testID="event-create-has-todos-toggle"
      style={styles.addFieldButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      onPress={() => setHasTodos(true)}
    >
      <Icon name="plus" size={12} color="#2f6fed" />
      <Text style={styles.addFieldButtonText}>ToDoを追加</Text>
    </TouchableOpacity>
  );

  // 過去日を指定している間だけ出す、思い出の画像をその場で登録するための枠。
  const memoryPhotoSection = isNewEventPast ? (
    <View testID="event-create-memory-photo-section">
      {stagedMemoryPhoto ? (
        <View style={styles.stagedPhotoRow}>
          <Text style={styles.stagedPhotoText}>思い出の画像を選択しました</Text>
          <TouchableOpacity
            testID="event-create-memory-photo-remove"
            onPress={() => setStagedMemoryPhoto(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="trash" size={16} color="#d32f2f" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          testID="event-create-add-memory-photo"
          style={styles.addFieldButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={handlePickMemoryPhoto}
        >
          <Icon name="plus" size={12} color="#2f6fed" />
          <Text style={styles.addFieldButtonText}>思い出の画像を追加</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity
          testID="event-create-backdrop"
          style={styles.modalBackdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
              <Text style={styles.modalTitle}>予定を作成</Text>

              <View style={styles.eventCalendarPickerRow}>
                {calendars.map((calendar) => (
                  <TouchableOpacity
                    key={calendar.id}
                    testID={`event-create-calendar-${calendar.id}`}
                    style={[
                      styles.eventCalendarChip,
                      calendar.id === newEventCalendarId && styles.eventCalendarChipSelected,
                    ]}
                    onPress={() => handleSelectEventCalendar(calendar.id)}
                  >
                    <CalendarLabel
                      calendar={calendar}
                      textStyle={
                        calendar.id === newEventCalendarId
                          ? styles.eventCalendarChipTextSelected
                          : styles.eventCalendarChipText
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {newEventCalendarKind === "personal" ? (
                // 個人用カレンダーには共有相手がいないので、予定情報もタグ・
                // ToDo・思い出もまとめて1つのグレーの個人用枠に入れる
                // (予定詳細画面と同じ考え方)。
                <View style={styles.personalFrame} testID="event-create-personal-frame">
                  <EventFormFields
                    testIDPrefix="event-create"
                    value={newEventForm}
                    onChange={(patch) => setNewEventForm((prev) => ({ ...prev, ...patch }))}
                  />
                  <TagPickerRow
                    testIDPrefix="event-create"
                    tagTree={tagTree}
                    selectedTagIds={selectedTagIds}
                    onToggle={handleToggleTagSelection}
                  />
                  {todoSection}
                  {memoryPhotoSection}
                </View>
              ) : (
                // 共有カレンダー向けの予定作成では、メンバー全員に見える予定
                // 情報・思い出(青い共有枠)と、自分にしか効かないタグ・ToDo
                // (グレーの個人用枠)を、予定詳細画面と同じ枠・背景色で
                // 塗り分ける(思い出はEventDetailContentの共有枠と同じ扱い)。
                <>
                  <View style={styles.sharedFrame} testID="event-create-shared-frame">
                    <Text testID="event-create-shared-label" style={styles.sharedFrameLabel}>
                      メンバーと共有
                    </Text>
                    <EventFormFields
                      testIDPrefix="event-create"
                      value={newEventForm}
                      onChange={(patch) => setNewEventForm((prev) => ({ ...prev, ...patch }))}
                    />
                    {memoryPhotoSection}
                  </View>
                  <View style={styles.personalFrame} testID="event-create-personal-frame">
                    <View testID="event-create-personal-group-label">
                      <PersonalOnlyBadge />
                    </View>
                    <TagPickerRow
                      testIDPrefix="event-create"
                      tagTree={tagTree}
                      selectedTagIds={selectedTagIds}
                      onToggle={handleToggleTagSelection}
                    />
                    {todoSection}
                  </View>
                </>
              )}

              {createEventError ? (
                <Text style={styles.errorText}>{getEventErrorMessageJa(createEventError)}</Text>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  testID="event-create-cancel"
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.cancelText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="event-create-submit"
                  style={[styles.createButton, isCreatingEvent && styles.createButtonDisabled]}
                  disabled={isCreatingEvent}
                  onPress={handleCreateEvent}
                >
                  <Text style={styles.createButtonText}>{isCreatingEvent ? "作成中…" : "作成"}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdropTouchable: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  // 予定詳細画面(EventDetailContent.tsx)と同じ色分け - メンバーと共有され
  // る予定情報は薄い青、自分にしか効かないタグ・ToDoは薄いグレー。
  sharedFrame: {
    backgroundColor: "#e8f0fe",
    borderWidth: 1,
    borderColor: "#c7dcfb",
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  sharedFrameLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0c447c",
  },
  personalFrame: {
    backgroundColor: "#f2f3f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  // 「+ 場所を追加」等(RevealableTextField)と揃えた、任意項目を追加する
  // ボタンの見た目。
  addFieldButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  addFieldButtonText: {
    color: "#2f6fed",
    fontSize: 13,
    fontWeight: "600",
  },
  errorText: {
    color: "#d32f2f",
  },
  eventCalendarPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  eventCalendarChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  eventCalendarChipSelected: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  eventCalendarChipText: {
    color: "#444",
  },
  eventCalendarChipTextSelected: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  todoChecklist: {
    gap: 8,
  },
  todoChecklistRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  stagedPhotoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  stagedPhotoText: {
    fontSize: 13,
    color: "#444",
  },
  todoChecklistText: {
    flex: 1,
  },
  todoAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  createButton: {
    backgroundColor: "#2f6fed",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonDisabled: {
    backgroundColor: "#b7c6ea",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
