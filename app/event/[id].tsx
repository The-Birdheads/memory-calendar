import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

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
import { ReminderTargetsPicker } from "../../src/features/events/components/ReminderTargetsPicker";
import { useDeleteEvent, useEvent, useSetReminderTargets } from "../../src/features/events/hooks";
import type { ReminderTargetsInput } from "../../src/features/events/types";
import { EventPhotosGallery } from "../../src/features/memories/components/EventPhotosGallery";
import { useAddReflection, useEventPhotos } from "../../src/features/memories/hooks";
import { EventTagBadges } from "../../src/features/tags/components/EventTagBadges";
import { useAttachTagsToEvent, useEventTags, useTagTree } from "../../src/features/tags/hooks";
import type { Tag, TagTreeNode } from "../../src/features/tags/types";
import {
  useCreateTodo,
  useDeleteTodo,
  useToggleDone,
  useTodosByEvent,
} from "../../src/features/todos/hooks";
import type { Todo } from "../../src/features/todos/types";

function flattenTagTree(nodes: TagTreeNode[]): Tag[] {
  return nodes.flatMap((node) => [node, ...flattenTagTree(node.children)]);
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? "";

  const { session } = useAuthSession();
  const { event, isLoading: isEventLoading } = useEvent(eventId);
  const calendarId = event?.calendarId ?? "";

  const { comments, refetch: refetchComments } = useComments(eventId);
  const { postComment } = usePostComment();
  const { deleteComment } = useDeleteComment();

  const { reactions, refetch: refetchReactions } = useReactions(eventId);
  const { addReaction } = useAddReaction();

  const { tags, refetch: refetchTags } = useEventTags(eventId);
  const { tagTree } = useTagTree(calendarId);
  const { attachTagsToEvent } = useAttachTagsToEvent();

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

  const { photos } = useEventPhotos(eventId);
  const { addReflection } = useAddReflection();
  const [reflectionBody, setReflectionBody] = useState("");

  const isPast = event ? new Date(event.endAt) < new Date() : false;
  const attachedTagIds = new Set(tags.map((tag) => tag.id));
  const availableTags = flattenTagTree(tagTree).filter((tag) => !attachedTagIds.has(tag.id));

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

  const handleAttachTag = async (tagId: string) => {
    const success = await attachTagsToEvent(eventId, [tagId]);
    if (success) await refetchTags();
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
      <View style={styles.container}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{event.title}</Text>

      <EventTagBadges tags={tags} />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>タグを追加</Text>
        <View style={styles.tagPickerRow}>
          {availableTags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              testID={`event-tag-attach-${tag.id}`}
              style={[styles.tagOption, { borderColor: tag.color }]}
              onPress={() => handleAttachTag(tag.id)}
            >
              <Text>{tag.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    padding: 16,
  },
  section: {
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  tagPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagOption: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
