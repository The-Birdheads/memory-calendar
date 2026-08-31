import { useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { useMyCalendars } from "../../src/features/calendars/hooks";
import { groupTodosByEvent, type EventTodoGroup } from "../../src/features/todos/groupByEvent";
import {
  useDeleteTodo,
  useToggleDone,
  useTodosByCalendar,
  useUpdateTodo,
} from "../../src/features/todos/hooks";
import type { TodoWithEventTitle } from "../../src/features/todos/types";
import { formatDateTime } from "../../src/shared/utils/formatDateTime";

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

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

  const hasReminder = todo.reminderAt !== null;

  return (
    <View style={styles.todoRow} testID={`todo-item-${todo.id}`}>
      <View style={styles.todoMainRow}>
        <TouchableOpacity testID={`todo-checkbox-${todo.id}`} onPress={() => onToggle(todo)}>
          <Text>{todo.isDone ? "☑" : "☐"}</Text>
        </TouchableOpacity>
        <Text style={[styles.todoTitle, todo.isDone && styles.doneText]}>{todo.title}</Text>
        <TouchableOpacity testID={`todo-delete-${todo.id}`} onPress={() => onDelete(todo.id)}>
          <Text style={styles.deleteText}>削除</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        testID={`todo-reminder-open-${todo.id}`}
        style={styles.reminderSummaryRow}
        onPress={openReminderModal}
      >
        <Text
          testID={`todo-reminder-icon-${todo.id}`}
          style={[styles.reminderIcon, !hasReminder && styles.reminderIconInactive]}
        >
          ⏰
        </Text>
        {hasReminder ? <Text style={styles.meta}>{formatDateTime(todo.reminderAt as string)}</Text> : null}
      </TouchableOpacity>

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

interface EventSectionProps {
  group: EventTodoGroup;
  activeCalendarId: string;
  isCollapsed: boolean;
  onToggleCollapse: (eventId: string) => void;
  onToggleTodo: (todo: TodoWithEventTitle) => void;
  onDeleteTodo: (todoId: string) => void;
  onSetReminder: (todoId: string, reminderAt: string) => void;
}

function EventSection({
  group,
  activeCalendarId,
  isCollapsed,
  onToggleCollapse,
  onToggleTodo,
  onDeleteTodo,
  onSetReminder,
}: EventSectionProps) {
  const handleGoToCalendar = () => {
    router.push({
      pathname: "/(tabs)/calendar",
      params: {
        date: toDateKey(group.eventStartAt),
        calendarId: activeCalendarId,
        // Forces the params object to change even when navigating to the same
        // date twice in a row, so the calendar screen's effect always re-fires.
        _t: String(Date.now()),
      },
    });
  };

  return (
    <View style={styles.section} testID={`todo-section-container-${group.eventId}`}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          testID={`todo-section-${group.eventId}`}
          style={styles.sectionHeaderToggle}
          onPress={() => onToggleCollapse(group.eventId)}
        >
          <Text style={styles.sectionChevron}>{isCollapsed ? "▶" : "▼"}</Text>
          <Text style={styles.sectionTitle}>{group.eventTitle}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`todo-section-calendar-${group.eventId}`} onPress={handleGoToCalendar}>
          <Text style={styles.calendarLink}>カレンダーへ</Text>
        </TouchableOpacity>
      </View>

      {!isCollapsed
        ? group.todos.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              onToggle={onToggleTodo}
              onDelete={onDeleteTodo}
              onSetReminder={onSetReminder}
            />
          ))
        : null}
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

  const [collapsedEventIds, setCollapsedEventIds] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupTodosByEvent(todos), [todos]);

  const handleToggleSection = (eventId: string) => {
    setCollapsedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

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

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text>ToDoがありません</Text>
        </View>
      ) : (
        <FlatList
          testID="todos-section-list"
          data={groups}
          keyExtractor={(group) => group.eventId}
          renderItem={({ item: group }) => (
            <EventSection
              group={group}
              activeCalendarId={activeCalendarId}
              isCollapsed={collapsedEventIds.has(group.eventId)}
              onToggleCollapse={handleToggleSection}
              onToggleTodo={handleToggle}
              onDeleteTodo={handleDelete}
              onSetReminder={handleSetReminder}
            />
          )}
        />
      )}
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f2f3f5",
  },
  sectionHeaderToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sectionChevron: {
    color: "#666",
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  calendarLink: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 13,
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
  todoTitle: {
    flex: 1,
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
    alignItems: "center",
    gap: 6,
    paddingLeft: 32,
  },
  reminderIcon: {
    fontSize: 14,
  },
  reminderIconInactive: {
    opacity: 0.35,
    textDecorationLine: "line-through",
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
