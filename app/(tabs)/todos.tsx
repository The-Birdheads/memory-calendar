import { useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useMyCalendars } from "../../src/features/calendars/hooks";
import {
  useDeleteTodo,
  useToggleDone,
  useTodosByCalendar,
  useUpdateTodo,
} from "../../src/features/todos/hooks";
import type { TodoWithEventTitle } from "../../src/features/todos/types";
import { formatDateTime } from "../../src/shared/utils/formatDateTime";

interface TodoItemRowProps {
  todo: TodoWithEventTitle;
  onToggle: (todo: TodoWithEventTitle) => void;
  onDelete: (todoId: string) => void;
  onSetReminder: (todoId: string, reminderAt: string) => void;
}

function TodoItemRow({ todo, onToggle, onDelete, onSetReminder }: TodoItemRowProps) {
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [reminderText, setReminderText] = useState(todo.reminderAt ?? "");

  const openReminderModal = () => {
    setReminderText(todo.reminderAt ?? "");
    setIsReminderModalVisible(true);
  };

  const handleSaveReminder = () => {
    onSetReminder(todo.id, reminderText);
    setIsReminderModalVisible(false);
  };

  return (
    <View style={styles.todoRow} testID={`todo-item-${todo.id}`}>
      <View style={styles.todoMainRow}>
        <TouchableOpacity testID={`todo-checkbox-${todo.id}`} onPress={() => onToggle(todo)}>
          <Text>{todo.isDone ? "☑" : "☐"}</Text>
        </TouchableOpacity>
        <View style={styles.todoTextColumn}>
          <Text style={[styles.todoTitle, todo.isDone && styles.doneText]}>{todo.title}</Text>
          <Text testID={`todo-event-${todo.id}`} style={styles.eventLabel}>
            📅 {todo.eventTitle}
          </Text>
        </View>
        <TouchableOpacity testID={`todo-delete-${todo.id}`} onPress={() => onDelete(todo.id)}>
          <Text style={styles.deleteText}>削除</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.reminderSummaryRow}>
        <Text style={styles.meta}>
          {todo.reminderAt ? `⏰ ${formatDateTime(todo.reminderAt)}` : "リマインド未設定"}
        </Text>
        <TouchableOpacity testID={`todo-reminder-open-${todo.id}`} onPress={openReminderModal}>
          <Text style={styles.settingsLink}>設定</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isReminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>リマインドを設定</Text>
            <TextInput
              testID={`todo-reminder-input-${todo.id}`}
              style={styles.reminderInput}
              placeholder="リマインド日時(ISO)"
              value={reminderText}
              onChangeText={setReminderText}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                testID={`todo-reminder-cancel-${todo.id}`}
                onPress={() => setIsReminderModalVisible(false)}
              >
                <Text>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`todo-reminder-save-${todo.id}`} onPress={handleSaveReminder}>
                <Text style={styles.settingsLink}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function TodosScreen() {
  const { calendars } = useMyCalendars();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const activeCalendarId = selectedCalendarId ?? calendars[0]?.id ?? "";

  const { todos, refetch } = useTodosByCalendar(activeCalendarId);
  const { toggleDone } = useToggleDone();
  const { deleteTodo } = useDeleteTodo();
  const { updateTodo } = useUpdateTodo();

  const notDoneTodos = todos.filter((todo) => !todo.isDone);
  const doneTodos = todos.filter((todo) => todo.isDone);

  const handleToggle = async (todo: TodoWithEventTitle) => {
    const success = await toggleDone(todo.id, !todo.isDone);
    if (success) await refetch();
  };

  const handleDelete = async (todoId: string) => {
    const success = await deleteTodo(todoId);
    if (success) await refetch();
  };

  const handleSetReminder = async (todoId: string, reminderAt: string) => {
    const success = await updateTodo(todoId, { reminderAt });
    if (success) await refetch();
  };

  const renderItem = (item: TodoWithEventTitle) => (
    <TodoItemRow
      todo={item}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onSetReminder={handleSetReminder}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.switcher}>
        {calendars.map((calendar) => (
          <TouchableOpacity
            key={calendar.id}
            testID={`todos-calendar-switch-${calendar.id}`}
            onPress={() => setSelectedCalendarId(calendar.id)}
            style={[
              styles.switchButton,
              calendar.id === activeCalendarId && styles.switchButtonActive,
            ]}
          >
            <Text>{calendar.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>未完了</Text>
      <FlatList data={notDoneTodos} keyExtractor={(item) => item.id} renderItem={({ item }) => renderItem(item)} />

      <Text style={styles.sectionTitle}>完了</Text>
      <FlatList data={doneTodos} keyExtractor={(item) => item.id} renderItem={({ item }) => renderItem(item)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  switcher: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  switchButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  todoRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  todoMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  todoTextColumn: {
    flex: 1,
    gap: 2,
  },
  todoTitle: {
    flex: 1,
  },
  eventLabel: {
    color: "#888",
    fontSize: 12,
  },
  doneText: {
    color: "#999",
    textDecorationLine: "line-through",
  },
  deleteText: {
    color: "#d32f2f",
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
  reminderSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 32,
  },
  settingsLink: {
    color: "#2f6fed",
    fontWeight: "700",
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
    fontSize: 16,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  reminderInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
