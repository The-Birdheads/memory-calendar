import { useState } from "react";
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
import { Stack, router, useLocalSearchParams } from "expo-router";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useCalendarMembers } from "../../src/features/calendars/hooks";
import { EventCommentsSection } from "../../src/features/communication/components/EventCommentsSection";
import { EventReactionsBar } from "../../src/features/communication/components/EventReactionsBar";
import {
  useAddReaction,
  useComments,
  useDeleteComment,
  usePostComment,
  useReactions,
} from "../../src/features/communication/hooks";
import { DeleteEventConfirmModal } from "../../src/features/events/components/DeleteEventConfirmModal";
import {
  CATEGORY_COLORS,
  EventFormFields,
  type EventFormValue,
} from "../../src/features/events/components/EventFormFields";
import { ReminderTargetsPicker } from "../../src/features/events/components/ReminderTargetsPicker";
import {
  useDeleteEvent,
  useEvent,
  useSetReminderTargets,
  useUpdateEvent,
} from "../../src/features/events/hooks";
import type { ReminderTargetsInput } from "../../src/features/events/types";
import { EventPhotosGallery } from "../../src/features/memories/components/EventPhotosGallery";
import { useAddReflection, useEventPhotos } from "../../src/features/memories/hooks";
import { EventTagBadges } from "../../src/features/tags/components/EventTagBadges";
import { TagPickerRow } from "../../src/features/tags/components/TagPickerRow";
import {
  useAttachTagsToEvent,
  useDetachTagFromEvent,
  useEventTags,
  useTagTree,
} from "../../src/features/tags/hooks";
import type { Tag, TagTreeNode } from "../../src/features/tags/types";
import {
  useCreateTodo,
  useDeleteTodo,
  useToggleDone,
  useTodosByEvent,
} from "../../src/features/todos/hooks";
import type { Todo } from "../../src/features/todos/types";
import { formatDateTimeRange } from "../../src/shared/utils/formatDateTime";

function flattenTagTree(nodes: TagTreeNode[]): Tag[] {
  return nodes.flatMap((node) => [node, ...flattenTagTree(node.children)]);
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? "";

  const { session } = useAuthSession();
  const { event, isLoading: isEventLoading, refetch: refetchEvent } = useEvent(eventId);
  const calendarId = event?.calendarId ?? "";

  const { comments, refetch: refetchComments } = useComments(eventId);
  const { postComment } = usePostComment();
  const { deleteComment } = useDeleteComment();

  const { reactions, refetch: refetchReactions } = useReactions(eventId);
  const { addReaction } = useAddReaction();

  const { tags, refetch: refetchTags } = useEventTags(eventId);
  const { tagTree } = useTagTree(calendarId);
  const { attachTagsToEvent } = useAttachTagsToEvent();
  const { detachTagFromEvent } = useDetachTagFromEvent();
  const [selectedEditTagIds, setSelectedEditTagIds] = useState<string[]>([]);

  const { todos, refetch: refetchTodos } = useTodosByEvent(eventId);
  const { createTodo } = useCreateTodo();
  const { toggleDone } = useToggleDone();
  const { deleteTodo } = useDeleteTodo();
  const [newTodoTitle, setNewTodoTitle] = useState("");

  const { members } = useCalendarMembers(calendarId);
  const { setReminderTargets } = useSetReminderTargets();
  const [reminderTargets, setReminderTargetsValue] = useState<ReminderTargetsInput>("all");

  const { deleteEvent } = useDeleteEvent();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const { updateEvent } = useUpdateEvent();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState<EventFormValue>({
    title: "",
    isAllDay: false,
    start: new Date(),
    end: new Date(),
    location: "",
    url: "",
    categoryColor: CATEGORY_COLORS[0].hex,
  });

  const { photos } = useEventPhotos(eventId);
  const { addReflection } = useAddReflection();
  const [reflectionBody, setReflectionBody] = useState("");

  const isPast = event ? new Date(event.endAt) < new Date() : false;
  const allTagsFlat = flattenTagTree(tagTree);

  const resolveMemberLabel = (userId: string): string => {
    const member = members.find((m) => m.userId === userId);
    if (member?.displayName) return member.displayName;
    if (userId === session?.user.id) return session?.user.email ?? "メンバー";
    return "メンバー";
  };

  const handlePostComment = async (body: string) => {
    const success = await postComment(eventId, body);
    if (success) await refetchComments();
  };

  const handleDeleteComment = async (commentId: string) => {
    const success = await deleteComment(commentId);
    if (success) await refetchComments();
  };

  const handleAddReaction = async (stampType: string) => {
    const success = await addReaction(eventId, stampType);
    if (success) await refetchReactions();
  };

  const handleToggleEditTag = (tagId: string) => {
    setSelectedEditTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    const success = await createTodo({ eventId, title: newTodoTitle });
    if (success) {
      setNewTodoTitle("");
      await refetchTodos();
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    const success = await toggleDone(todo.id, !todo.isDone);
    if (success) await refetchTodos();
  };

  const handleDeleteTodo = async (todoId: string) => {
    const success = await deleteTodo(todoId);
    if (success) await refetchTodos();
  };

  const handleSaveReminderTargets = async () => {
    await setReminderTargets(eventId, reminderTargets);
  };

  const handleOpenEditModal = () => {
    if (!event) return;
    setEditForm({
      title: event.title,
      isAllDay: event.isAllDay,
      start: new Date(event.startAt),
      end: new Date(event.endAt),
      location: event.location ?? "",
      url: event.url ?? "",
      categoryColor: event.categoryColor ?? CATEGORY_COLORS[0].hex,
    });
    setSelectedEditTagIds(tags.map((tag) => tag.id));
    setIsEditModalVisible(true);
  };

  const handleSubmitEdit = async () => {
    const success = await updateEvent(eventId, {
      title: editForm.title,
      startAt: editForm.start.toISOString(),
      endAt: editForm.end.toISOString(),
      isAllDay: editForm.isAllDay,
      location: editForm.location || null,
      url: editForm.url || null,
      categoryColor: editForm.categoryColor,
    });
    if (success) {
      const currentTagIds = tags.map((tag) => tag.id);
      const tagIdsToAttach = selectedEditTagIds.filter((id) => !currentTagIds.includes(id));
      const tagIdsToDetach = currentTagIds.filter((id) => !selectedEditTagIds.includes(id));
      if (tagIdsToAttach.length > 0) {
        await attachTagsToEvent(eventId, tagIdsToAttach);
      }
      for (const tagId of tagIdsToDetach) {
        await detachTagFromEvent(eventId, tagId);
      }
      if (tagIdsToAttach.length > 0 || tagIdsToDetach.length > 0) {
        await refetchTags();
      }
      setIsEditModalVisible(false);
      await refetchEvent();
    }
  };

  const handleConfirmDelete = async () => {
    const success = await deleteEvent(eventId);
    setIsDeleteModalVisible(false);
    if (success) {
      router.back();
    }
  };

  const handleAddReflection = async () => {
    if (!reflectionBody.trim()) return;
    const success = await addReflection(eventId, reflectionBody);
    if (success) {
      setReflectionBody("");
      await refetchComments();
    }
  };

  if (isEventLoading || !event) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: "予定", headerBackButtonDisplayMode: "minimal" }}
        />
        <View style={styles.container}>
          <Text>読み込み中...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: event.title, headerBackButtonDisplayMode: "minimal" }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerCard}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.title}</Text>
          <TouchableOpacity testID="event-edit-button" onPress={handleOpenEditModal}>
            <Text style={styles.editLink}>編集</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailInfo}>
          <Text testID="event-detail-datetime" style={styles.detailText}>
            🕐 {formatDateTimeRange(event.startAt, event.endAt)}
          </Text>
          {event.location ? (
            <Text testID="event-detail-location" style={styles.detailText}>
              📍 {event.location}
            </Text>
          ) : null}
          {event.url ? (
            <Text testID="event-detail-url" style={styles.detailLink}>
              🔗 {event.url}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>タグ</Text>
        {tags.length > 0 ? (
          <EventTagBadges tags={tags} />
        ) : (
          <Text style={styles.emptyText}>タグはまだありません（編集から追加できます）</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>スタンプ</Text>
        <EventReactionsBar reactions={reactions} onAddReaction={handleAddReaction} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>コメント</Text>
        <EventCommentsSection
          comments={comments}
          onSubmit={handlePostComment}
          currentUserId={session?.user.id}
          onDelete={handleDeleteComment}
          resolveAuthorName={resolveMemberLabel}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ToDo</Text>
        {todos.map((todo) => (
          <View key={todo.id} style={styles.todoRow} testID={`event-todo-${todo.id}`}>
            <TouchableOpacity
              testID={`event-todo-checkbox-${todo.id}`}
              onPress={() => handleToggleTodo(todo)}
            >
              <Text>{todo.isDone ? "☑" : "☐"}</Text>
            </TouchableOpacity>
            <Text style={[styles.todoTitle, todo.isDone && styles.doneText]}>{todo.title}</Text>
            <TouchableOpacity testID={`event-todo-delete-${todo.id}`} onPress={() => handleDeleteTodo(todo.id)}>
              <Text style={styles.deleteText}>削除</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.todoAddRow}>
          <TextInput
            testID="event-todo-input"
            style={styles.input}
            placeholder="ToDoを追加"
            value={newTodoTitle}
            onChangeText={setNewTodoTitle}
          />
          <TouchableOpacity testID="event-todo-add" onPress={handleAddTodo}>
            <Text>追加</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>リマインド対象者</Text>
        <ReminderTargetsPicker
          memberUserIds={members.map((member) => member.userId)}
          value={reminderTargets}
          onChange={setReminderTargetsValue}
          resolveMemberLabel={resolveMemberLabel}
        />
        <TouchableOpacity testID="event-reminder-targets-save" onPress={handleSaveReminderTargets}>
          <Text>保存</Text>
        </TouchableOpacity>
      </View>

      {isPast ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>思い出</Text>
          <EventPhotosGallery photos={photos} />
          <TextInput
            testID="event-reflection-input"
            style={styles.input}
            placeholder="感想を入力"
            value={reflectionBody}
            onChangeText={setReflectionBody}
          />
          <TouchableOpacity testID="event-reflection-submit" onPress={handleAddReflection}>
            <Text>感想を投稿</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        testID="event-delete-button"
        style={styles.deleteButton}
        onPress={() => setIsDeleteModalVisible(true)}
      >
        <Text style={styles.deleteText}>予定を削除</Text>
      </TouchableOpacity>

      <DeleteEventConfirmModal
        visible={isDeleteModalVisible}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalVisible(false)}
      />

      <Modal visible={isEditModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>予定を編集</Text>

              <EventFormFields
                testIDPrefix="event-edit"
                value={editForm}
                onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
              />

              <TagPickerRow
                testIDPrefix="event-edit"
                availableTags={allTagsFlat}
                selectedTagIds={selectedEditTagIds}
                onToggle={handleToggleEditTag}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity testID="event-edit-cancel" onPress={() => setIsEditModalVisible(false)}>
                  <Text>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="event-edit-submit" style={styles.createButton} onPress={handleSubmitEdit}>
                  <Text style={styles.createButtonText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f3f5",
  },
  contentContainer: {
    paddingVertical: 12,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    flexShrink: 1,
    paddingRight: 12,
  },
  editLink: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  detailInfo: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 6,
  },
  detailText: {
    color: "#444",
    fontSize: 14,
  },
  detailLink: {
    color: "#2f6fed",
    fontSize: 14,
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 8,
  },
  createButton: {
    backgroundColor: "#2f6fed",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
  },
  emptyText: {
    color: "#999",
    fontSize: 13,
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
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
  todoAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButton: {
    alignSelf: "center",
    paddingVertical: 16,
    marginBottom: 24,
  },
});
