import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";
import { TodoReminderPicker } from "../../todos/components/TodoReminderPicker";
import type { Todo } from "../../todos/types";

export interface EventTodoRowProps {
  todo: Todo;
  /** 紐づく予定が終日かどうか - リマインドの選択肢の出し分け基準(予定のリマインドと同じ)。 */
  isAllDay: boolean;
  /** 紐づく予定の開始時刻 - 選択肢から実際の通知時刻を計算する基準。 */
  eventStartAt: string;
  onToggle: (todo: Todo) => void;
  onDelete: (todoId: string) => void;
  onSetReminder: (todoId: string, reminderAt: string | null) => void;
}

/**
 * 予定詳細画面のToDo1行。ToDoタブの `TodoItemRow` と同じく、リマインドが
 * 設定されていればベルアイコンを青で表示し、タップすると `TodoReminderPicker`
 * を開いて設定・変更できる。予定詳細側は削除に確認ダイアログを挟まない
 * (元の挙動を維持)点だけToDoタブと異なる。
 */
export function EventTodoRow({ todo, isAllDay, eventStartAt, onToggle, onDelete, onSetReminder }: EventTodoRowProps) {
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const hasReminder = todo.reminderAt !== null;

  return (
    <View style={styles.row} testID={`event-todo-${todo.id}`}>
      <TouchableOpacity testID={`event-todo-checkbox-${todo.id}`} onPress={() => onToggle(todo)}>
        <Text>{todo.isDone ? "☑" : "☐"}</Text>
      </TouchableOpacity>
      <Text style={[styles.title, todo.isDone && styles.doneText]}>{todo.title}</Text>
      <TouchableOpacity
        testID={`event-todo-reminder-icon-${todo.id}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => setIsReminderModalVisible(true)}
      >
        <Icon
          testID={`event-todo-reminder-bell-${todo.id}`}
          name={hasReminder ? "bell" : "bell-off"}
          size={16}
          color={hasReminder ? "#2f6fed" : "#999"}
        />
      </TouchableOpacity>
      <TouchableOpacity
        testID={`event-todo-delete-${todo.id}`}
        onPress={() => onDelete(todo.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="trash" size={16} color="#d32f2f" />
      </TouchableOpacity>

      <Modal
        visible={isReminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReminderModalVisible(false)}
      >
        <TouchableOpacity
          testID={`event-todo-reminder-backdrop-${todo.id}`}
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsReminderModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>リマインドを設定</Text>
              <TouchableOpacity
                testID={`event-todo-reminder-close-${todo.id}`}
                onPress={() => setIsReminderModalVisible(false)}
              >
                <Icon name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
            <TodoReminderPicker
              testIDPrefix={`event-todo-reminder-${todo.id}`}
              isAllDay={isAllDay}
              eventStartAt={eventStartAt}
              reminderAt={todo.reminderAt}
              onChange={(reminderAt) => onSetReminder(todo.id, reminderAt)}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
  },
  doneText: {
    color: "#999",
    textDecorationLine: "line-through",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    width: "85%",
    borderRadius: 12,
    padding: 20,
    backgroundColor: "#fff",
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
