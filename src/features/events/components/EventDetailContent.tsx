import { useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useAuthSession } from "../../auth/hooks";
import { useCalendarMembers, useMyCalendars } from "../../calendars/hooks";
import { EventCommentsSection } from "../../communication/components/EventCommentsSection";
import { useComments, useDeleteComment, usePostComment } from "../../communication/hooks";
import { DeleteEventConfirmModal } from "./DeleteEventConfirmModal";
import { EventFormFields, type EventFormValue } from "./EventFormFields";
import { EventReminderPicker } from "./EventReminderPicker";
import {
  useAddEventReminder,
  useDeleteEvent,
  useEvent,
  useEventReminders,
  useRemoveEventReminder,
  useUpdateEvent,
} from "../hooks";
import type { EventReminder, EventReminderCustomOffset, EventReminderKind } from "../types";
import { EventPhotosGallery } from "../../memories/components/EventPhotosGallery";
import { pickPhotoFromLibrary } from "../../memories/imagePicker";
import {
  useAttachPhoto,
  useDetachPhoto,
  useEventPhotos,
  useSetPhotoThumbnail,
  type EventPhotoWithUrl,
} from "../../memories/hooks";
import { EventTagBadges } from "../../tags/components/EventTagBadges";
import { PersonalOnlyBadge } from "../../../shared/components/PersonalOnlyBadge";
import { TagPickerRow } from "../../tags/components/TagPickerRow";
import { useAttachTagsToEvent, useDetachTagFromEvent, useEventTags, useTagTree } from "../../tags/hooks";
import { useCreateTodo, useDeleteTodo, useToggleDone, useTodosByEvent, useUpdateTodo } from "../../todos/hooks";
import type { Todo } from "../../todos/types";
import { EventTodoRow } from "./EventTodoRow";
import { Icon } from "../../../shared/components/Icon";
import { formatDateTimeRange, toJstDateKey } from "../../../shared/utils/formatDateTime";

export interface EventDetailContentProps {
  eventId: string;
  /**
   * Called after the event is successfully deleted, so the caller can decide
   * what "leaving the detail view" means for it - the standalone route
   * (app/event/[id].tsx) navigates back, while a caller embedding this in a
   * modal (e.g. the history tab) just closes the modal instead.
   */
  onDeleted: () => void;
  /** Called when the top-left back (←) button is pressed. */
  onBack: () => void;
  /**
   * Shows a calendar icon in the header that jumps to the Calendar tab on
   * this event's date, for callers that aren't already the calendar screen
   * itself (e.g. the history tab's in-tab modal - pressing back there just
   * closes the modal, so it needs its own way to get to the calendar).
   * Defaults to false.
   */
  showGoToCalendarButton?: boolean;
}

/**
 * All of a single event's detail/edit UI (header, reactions, comments,
 * memories/photos, reminders, tags, ToDo, delete) - extracted out of the
 * `/event/[id]` route so it can also be embedded in a modal (e.g. the
 * history tab's "view without leaving the tab" flow) without duplicating
 * this logic. This component owns its own header (back button + optional
 * "go to calendar" button, safe-area aware) so every caller looks and
 * behaves identically instead of each wrapper building its own chrome.
 */
export function EventDetailContent({
  eventId,
  onDeleted,
  onBack,
  showGoToCalendarButton = false,
}: EventDetailContentProps) {
  const insets = useSafeAreaInsets();
  const { session } = useAuthSession();
  const { event, isLoading: isEventLoading, refetch: refetchEvent } = useEvent(eventId);
  const calendarId = event?.calendarId ?? "";

  const { calendars } = useMyCalendars();
  // 個人用カレンダーの予定には「メンバーと共有」ラベルを出さない(共有相手が
  // いないカレンダーのため)。
  const isPersonalCalendar = calendars.find((calendar) => calendar.id === calendarId)?.kind === "personal";

  const { comments, refetch: refetchComments } = useComments(eventId);
  const { postComment } = usePostComment();
  const { deleteComment } = useDeleteComment();

  const { tags, refetch: refetchTags } = useEventTags(eventId);
  const { tagTree } = useTagTree();
  const { attachTagsToEvent } = useAttachTagsToEvent();
  const { detachTagFromEvent } = useDetachTagFromEvent();
  // タグは共有カレンダーでも個人用の項目(誰が何をタグ付けするかは各自の分類)なので、
  // 予定本体の編集(共有)とは別に、タグ欄自身の「編集」ボタンから独立して編集する。
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagEditSelection, setTagEditSelection] = useState<string[]>([]);

  const { todos, refetch: refetchTodos } = useTodosByEvent(eventId);
  const { createTodo } = useCreateTodo();
  const { toggleDone } = useToggleDone();
  const { deleteTodo } = useDeleteTodo();
  const { updateTodo } = useUpdateTodo();
  const [newTodoTitle, setNewTodoTitle] = useState("");

  const { members } = useCalendarMembers(calendarId);
  const { reminders, refetch: refetchReminders } = useEventReminders(eventId);
  const { addEventReminder } = useAddEventReminder();
  const { removeEventReminder } = useRemoveEventReminder();

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
  });

  const { photos, refetch: refetchPhotos } = useEventPhotos(eventId);
  const { attachPhoto } = useAttachPhoto();
  const { detachPhoto } = useDetachPhoto();
  const { setPhotoThumbnail } = useSetPhotoThumbnail();

  const isPast = event ? new Date(event.endAt) < new Date() : false;

  const resolveMemberLabel = (userId: string | null): string => {
    // 投稿者が退会してuser_idがNULL化されたコメントも、この汎用フォールバックでカバーされる
    if (userId === null) return "元メンバー";
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

  const handleStartEditingTags = () => {
    setTagEditSelection(tags.map((tag) => tag.id));
    setIsEditingTags(true);
  };

  const handleToggleTagEditSelection = (tagId: string) => {
    setTagEditSelection((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const saveTagSelection = async (selection: string[]) => {
    const currentTagIds = tags.map((tag) => tag.id);
    const tagIdsToAttach = selection.filter((id) => !currentTagIds.includes(id));
    const tagIdsToDetach = currentTagIds.filter((id) => !selection.includes(id));
    if (tagIdsToAttach.length > 0) {
      await attachTagsToEvent(eventId, tagIdsToAttach);
    }
    for (const tagId of tagIdsToDetach) {
      await detachTagFromEvent(eventId, tagId);
    }
    if (tagIdsToAttach.length > 0 || tagIdsToDetach.length > 0) {
      await refetchTags();
    }
  };

  const handleConfirmTagEdit = async () => {
    await saveTagSelection(tagEditSelection);
    setIsEditingTags(false);
  };

  const handleCancelTagEdit = () => {
    setIsEditingTags(false);
  };

  // 選択中のまま画面を離れた(戻る操作等でアンマウントされた)場合も、バツで
  // 明示的に取り消さない限りは変更を確定させる - バツボタン以外は「確定」扱い。
  const isEditingTagsRef = useRef(isEditingTags);
  const tagEditSelectionRef = useRef(tagEditSelection);
  const tagsRef = useRef(tags);
  useEffect(() => {
    isEditingTagsRef.current = isEditingTags;
  }, [isEditingTags]);
  useEffect(() => {
    tagEditSelectionRef.current = tagEditSelection;
  }, [tagEditSelection]);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  useEffect(() => {
    return () => {
      if (!isEditingTagsRef.current) return;
      const currentTagIds = tagsRef.current.map((tag) => tag.id);
      const selection = tagEditSelectionRef.current;
      const tagIdsToAttach = selection.filter((id) => !currentTagIds.includes(id));
      const tagIdsToDetach = currentTagIds.filter((id) => !selection.includes(id));
      if (tagIdsToAttach.length > 0) {
        attachTagsToEvent(eventId, tagIdsToAttach);
      }
      tagIdsToDetach.forEach((tagId) => {
        detachTagFromEvent(eventId, tagId);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

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

  const handleSetTodoReminder = async (todoId: string, reminderAt: string | null) => {
    const success = await updateTodo(todoId, { reminderAt });
    if (success) await refetchTodos();
  };

  const handleEditTodoTitle = async (todoId: string, title: string) => {
    const success = await updateTodo(todoId, { title });
    if (success) await refetchTodos();
  };

  const handleAddReminder = async (kind: EventReminderKind, custom?: EventReminderCustomOffset) => {
    const success = await addEventReminder(eventId, kind, custom);
    if (success) await refetchReminders();
  };

  const handleRemoveReminder = async (reminder: EventReminder) => {
    const success = await removeEventReminder(reminder.id);
    if (success) await refetchReminders();
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
    });
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
    });
    if (success) {
      setIsEditModalVisible(false);
      await refetchEvent();
    }
  };

  const handleConfirmDelete = async () => {
    const success = await deleteEvent(eventId);
    setIsDeleteModalVisible(false);
    if (success) {
      onDeleted();
    }
  };

  const handleAddPhoto = async () => {
    const picked = await pickPhotoFromLibrary();
    if (!picked) return;
    const success = await attachPhoto(eventId, picked);
    if (success) await refetchPhotos();
  };

  const handleDeleteOwnPhoto = async (photo: EventPhotoWithUrl) => {
    const success = await detachPhoto(photo.id, photo.storagePath);
    if (success) await refetchPhotos();
  };

  const handleSelectThumbnail = async (photo: EventPhotoWithUrl) => {
    const success = await setPhotoThumbnail(eventId, photo.id);
    if (success) await refetchPhotos();
  };

  const handleGoToCalendar = () => {
    if (!event) return;
    router.push({
      pathname: "/(tabs)/calendar",
      params: {
        date: toJstDateKey(event.startAt),
        calendarId: event.calendarId,
        // Forces the params object to change even when navigating to the
        // same date twice in a row, so the calendar screen's effect always re-fires.
        _t: String(Date.now()),
      },
    });
    // A modal caller (e.g. history) would otherwise stay open, stuck behind
    // the calendar tab, once the user comes back to this tab.
    onBack();
  };

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity testID="event-detail-back" style={styles.topBarButton} onPress={onBack}>
        <Text style={styles.topBarBackIcon}>←</Text>
      </TouchableOpacity>
      {showGoToCalendarButton && event ? (
        <TouchableOpacity
          testID="event-detail-go-to-calendar"
          style={styles.topBarButton}
          onPress={handleGoToCalendar}
        >
          <Icon name="calendar" size={20} color="#2f6fed" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (isEventLoading || !event) {
    return (
      <View style={styles.container}>
        {topBar}
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  // 各セクションを変数として1度だけ組み立てておき、下のreturn側は
  // 「どの枠に入れるか」だけを、共有カレンダー/個人用カレンダーで
  // 出し分ける(JSXそのものを2重に書かない)。
  const commentsSection = (
    <View style={styles.sectionInFrame} testID="event-comments-card">
      <Text style={styles.sectionTitle}>コメント</Text>
      <EventCommentsSection
        comments={comments}
        onSubmitComment={handlePostComment}
        currentUserId={session?.user.id}
        onDeleteComment={handleDeleteComment}
        resolveAuthorName={resolveMemberLabel}
      />
    </View>
  );

  const memoriesSection = isPast ? (
    <View style={styles.sectionInFrame}>
      <Text style={styles.sectionTitle}>思い出</Text>
      <EventPhotosGallery
        photos={photos}
        currentUserId={session?.user.id}
        onSelectThumbnail={handleSelectThumbnail}
        onDeleteOwnPhoto={handleDeleteOwnPhoto}
      />
      {photos.some((photo) => photo.uploadedBy === session?.user.id) ? null : (
        <TouchableOpacity
          testID="event-photo-add"
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={handleAddPhoto}
        >
          <Icon name="plus" size={16} color="#2f6fed" />
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  const reminderSection = isPast ? null : (
    <View style={styles.sectionInFrame}>
      <Text style={styles.sectionTitle}>リマインド</Text>
      <EventReminderPicker
        testIDPrefix="event-reminder"
        isAllDay={event.isAllDay}
        reminders={reminders}
        onAdd={handleAddReminder}
        onRemove={handleRemoveReminder}
      />
    </View>
  );

  const tagsSection = (
    <View style={styles.sectionInFrame}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>タグ</Text>
        {isEditingTags ? (
          <View style={styles.tagEditActions}>
            <TouchableOpacity testID="event-tags-cancel-button" onPress={handleCancelTagEdit}>
              <Icon name="close" size={16} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity testID="event-tags-confirm-button" onPress={handleConfirmTagEdit}>
              <Text style={styles.tagConfirmCheck}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID="event-tags-edit-button"
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleStartEditingTags}
          >
            <Icon name="edit" size={14} color="#2f6fed" />
          </TouchableOpacity>
        )}
      </View>

      {isEditingTags ? (
        <TagPickerRow
          testIDPrefix="event-tags"
          tagTree={tagTree}
          selectedTagIds={tagEditSelection}
          onToggle={handleToggleTagEditSelection}
          hideLabel
        />
      ) : tags.length > 0 ? (
        <EventTagBadges tags={tags} />
      ) : (
        <Text style={styles.emptyText}>タグはまだありません（編集から追加できます）</Text>
      )}
    </View>
  );

  const todoSection = (
    <View style={styles.sectionInFrame}>
      <Text style={styles.sectionTitle}>ToDo</Text>
      {todos.map((todo) => (
        <EventTodoRow
          key={todo.id}
          todo={todo}
          isAllDay={event.isAllDay}
          eventStartAt={event.startAt}
          onToggle={handleToggleTodo}
          onDelete={handleDeleteTodo}
          onSetReminder={handleSetTodoReminder}
          onEditTitle={handleEditTodoTitle}
        />
      ))}
      <View style={styles.todoAddRow}>
        <TextInput
          testID="event-todo-input"
          style={styles.input}
          placeholder="ToDoを追加"
          value={newTodoTitle}
          onChangeText={setNewTodoTitle}
        />
        <TouchableOpacity
          testID="event-todo-add"
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={handleAddTodo}
        >
          <Icon name="plus" size={16} color="#2f6fed" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
    {topBar}
    <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView
      style={styles.flexOne}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
    <View style={styles.headerCard}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{event.title}</Text>
        <TouchableOpacity
          testID="event-edit-button"
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={handleOpenEditModal}
        >
          <Icon name="edit" size={16} color="#2f6fed" />
        </TouchableOpacity>
      </View>

      <View style={styles.detailInfo}>
        <View style={styles.detailRow}>
          <Icon name="clock" size={14} color="#444" />
          <Text testID="event-detail-datetime" style={styles.detailText}>
            {formatDateTimeRange(event.startAt, event.endAt, event.isAllDay)}
          </Text>
        </View>
        {event.location ? (
          <View style={styles.detailRow}>
            <Icon name="location" size={14} color="#444" />
            <Text testID="event-detail-location" style={styles.detailText}>
              {event.location}
            </Text>
          </View>
        ) : null}
        {event.url ? (
          <View style={styles.detailRow}>
            <Icon name="link" size={14} color="#2f6fed" />
            <Text testID="event-detail-url" style={styles.detailLink}>
              {event.url}
            </Text>
          </View>
        ) : null}
      </View>
    </View>

    {isPersonalCalendar ? (
      // 個人用カレンダーには「共有」の概念自体が無い(見る相手がいない)ので、
      // コメント/思い出も含めて予定内の全項目を1つの個人用(グレー)の枠に
      // まとめる - 共有/個人の枠を塗り分ける意味があるのは、共有相手が
      // 実際にいるグループカレンダーの予定だけ(2026-09見直し:「個人用
      // カレンダーの予定は範囲がグループカレンダーの予定と違う」という
      // 指摘を受けて、個人用カレンダーでは枠を分けるのをやめた)。
      // 並び順はリマインド→タグ→ToDo→思い出→コメント(2026-09見直し)。
      <View style={styles.personalFrame} testID="event-personal-frame">
        {reminderSection}
        {tagsSection}
        {todoSection}
        {memoriesSection}
        {commentsSection}
      </View>
    ) : (
      // 並び順はリマインド→タグ→ToDo(個人用枠)→思い出→コメント(共有枠)
      // の順(2026-09見直し - 個人用の項目を先に、共有項目を後にする形へ変更)。
      <>
        <View style={styles.personalFrame} testID="event-personal-frame">
          <View testID="event-personal-group-label">
            <PersonalOnlyBadge />
          </View>
          {reminderSection}
          {tagsSection}
          {todoSection}
        </View>
        <View style={styles.sharedFrame} testID="event-shared-frame">
          <Text testID="event-shared-group-label" style={styles.sharedFrameLabel}>
            メンバーと共有
          </Text>
          {memoriesSection}
          {commentsSection}
        </View>
      </>
    )}

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
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity
          testID="event-edit-backdrop"
          style={styles.modalBackdropTouchable}
          activeOpacity={1}
          onPress={() => setIsEditModalVisible(false)}
        >
        <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>予定を編集</Text>

            <EventFormFields
              testIDPrefix="event-edit"
              value={editForm}
              onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="event-edit-cancel"
                onPress={() => setIsEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="event-edit-submit"
                style={styles.createButton}
                onPress={handleSubmitEdit}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.createButtonText}>✓</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </ScrollView>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f3f5",
  },
  flexOne: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "#f2f3f5",
  },
  topBarButton: {
    padding: 8,
  },
  topBarBackIcon: {
    fontSize: 24,
    color: "#2f6fed",
    fontWeight: "700",
  },
  loadingText: {
    paddingHorizontal: 16,
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
  // 「編集」「追加」用の、文言ではなくアイコンだけのボタン(2026-09見直し)。
  iconButton: {
    padding: 2,
  },
  detailInfo: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontSize: 16,
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  // 「共有」枠・「個人用」枠、どちらの内側でも使う個々のカード。枠自体が
  // 外側の余白(marginHorizontal)と枠同士の間隔(marginBottom相当のgap)を
  // 持つので、こちらは中身の白いカードの見た目(背景・角丸・内側の余白)
  // だけを担当する。
  sectionInFrame: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  // 「メンバーと共有」枠 - コメント・思い出はカレンダーメンバー全員から
  // 見える項目なので、下の個人用枠と色で見分けられるよう薄い青で塗る。
  sharedFrame: {
    backgroundColor: "#e8f0fe",
    borderWidth: 1,
    borderColor: "#c7dcfb",
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 10,
    gap: 10,
  },
  sharedFrameLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0c447c",
  },
  // 「個人用」枠 - リマインド・タグ・ToDoは自分にしか見えない/効かない
  // 項目なので、共有枠とは違うグレーで塗って区別する。
  personalFrame: {
    backgroundColor: "#f2f3f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 10,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagEditActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  tagConfirmCheck: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 16,
  },
  emptyText: {
    color: "#999",
    fontSize: 13,
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
