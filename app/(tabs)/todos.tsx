import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Tabs, useFocusEffect } from "expo-router";

import { useMyCalendars } from "../../src/features/calendars/hooks";
import { CalendarSwitchChip } from "../../src/features/calendars/components/CalendarSwitchChip";
import { EventDetailModal } from "../../src/features/events/components/EventDetailModal";
import { FilterButton, FilterSection } from "../../src/shared/components/FilterButton";
import { Icon } from "../../src/shared/components/Icon";
import { PersonalOnlyBadge } from "../../src/shared/components/PersonalOnlyBadge";
import { EventTagBadges } from "../../src/features/tags/components/EventTagBadges";
import { useEventTagsByEvents } from "../../src/features/tags/hooks";
import type { Tag } from "../../src/features/tags/types";
import { formatEventDateRangeLabel } from "../../src/features/todos/formatEventDateRangeLabel";
import { countIncomplete, groupTodosByEvent, type EventTodoGroup } from "../../src/features/todos/groupByEvent";
import { getEventUrgency } from "../../src/features/todos/eventUrgency";
import { ReattachTodoModal } from "../../src/features/todos/components/ReattachTodoModal";
import { TodoReminderPicker } from "../../src/features/todos/components/TodoReminderPicker";
import {
  useDeleteTodo,
  useOrphanedTodos,
  useToggleDone,
  useTodosByCalendars,
  useUpdateTodo,
} from "../../src/features/todos/hooks";
import type { Todo, TodoWithEventTitle } from "../../src/features/todos/types";
import { todayJstDateKey, toJstDateKey } from "../../src/shared/utils/formatDateTime";

/** Scrolls the given ScrollView so the node comes into view near the top. */
function scrollToNode(scrollRef: React.RefObject<ScrollView | null>, node: View | null) {
  if (!node || !scrollRef.current) return;
  // measureLayout exists on the underlying native view but RN's View typings
  // don't model it cleanly against a composite ScrollView ref - this is the
  // standard (if awkwardly-typed) way to scroll an arbitrary descendant into
  // view without giving every nested list its own independent scroller.
  (node as unknown as { measureLayout: Function }).measureLayout(
    scrollRef.current,
    (_x: number, y: number) => {
      scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
    },
    () => {}
  );
}

interface TodoItemRowProps {
  todo: TodoWithEventTitle;
  emphasizeOverdue?: boolean;
  onToggle: (todo: TodoWithEventTitle) => void;
  onDelete: (todoId: string) => void;
  onSetReminder: (todoId: string, reminderAt: string | null) => void;
  onEditTitle: (todoId: string, title: string) => void;
}

function TodoItemRow({ todo, emphasizeOverdue, onToggle, onDelete, onSetReminder, onEditTitle }: TodoItemRowProps) {
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);

  const handleConfirmDelete = () => {
    onDelete(todo.id);
    setIsDeleteConfirmVisible(false);
  };

  const handleStartEditTitle = () => {
    setTitleDraft(todo.title);
    setIsEditingTitle(true);
  };

  const handleConfirmEditTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    if (trimmed !== todo.title) onEditTitle(todo.id, trimmed);
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
  };

  const hasReminder = todo.reminderAt !== null;

  return (
    <View
      style={[styles.todoRow, emphasizeOverdue && styles.todoRowOverdue]}
      testID={`todo-item-${todo.id}`}
    >
      <View style={styles.todoMainRow}>
        <TouchableOpacity testID={`todo-checkbox-${todo.id}`} onPress={() => onToggle(todo)}>
          <Text style={styles.checkboxGlyph}>{todo.isDone ? "☑" : "☐"}</Text>
        </TouchableOpacity>

        {isEditingTitle ? (
          <>
            <TextInput
              testID={`todo-title-input-${todo.id}`}
              style={styles.todoTitleInput}
              value={titleDraft}
              onChangeText={setTitleDraft}
              autoFocus
            />
            <TouchableOpacity
              testID={`todo-title-confirm-${todo.id}`}
              onPress={handleConfirmEditTitle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.confirmCheck}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`todo-title-cancel-${todo.id}`}
              onPress={handleCancelEditTitle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.todoTitle, todo.isDone && styles.doneText]}>{todo.title}</Text>
            <TouchableOpacity
              testID={`todo-edit-${todo.id}`}
              onPress={handleStartEditTitle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="edit" size={18} color="#2f6fed" />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`todo-reminder-icon-${todo.id}`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setIsReminderModalVisible(true)}
            >
              <Icon
                testID={`todo-reminder-bell-${todo.id}`}
                name={hasReminder ? "bell" : "bell-off"}
                size={18}
                color={hasReminder ? "#2f6fed" : "#999"}
              />
            </TouchableOpacity>
            <TouchableOpacity testID={`todo-delete-${todo.id}`} onPress={() => setIsDeleteConfirmVisible(true)}>
              <Icon name="trash" size={18} color="#d32f2f" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal
        visible={isReminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReminderModalVisible(false)}
      >
        <TouchableOpacity
          testID={`todo-reminder-backdrop-${todo.id}`}
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsReminderModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>リマインドを設定</Text>
              <TouchableOpacity
                testID={`todo-reminder-close-${todo.id}`}
                onPress={() => setIsReminderModalVisible(false)}
              >
                <Icon name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>
            <TodoReminderPicker
              testIDPrefix={`todo-reminder-${todo.id}`}
              isAllDay={todo.eventIsAllDay}
              eventStartAt={todo.eventStartAt}
              reminderAt={todo.reminderAt}
              onChange={(reminderAt) => onSetReminder(todo.id, reminderAt)}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isDeleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteConfirmVisible(false)}
      >
        <TouchableOpacity
          testID={`todo-delete-backdrop-${todo.id}`}
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDeleteConfirmVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{todo.title}を削除しますか?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                testID={`todo-delete-cancel-${todo.id}`}
                onPress={() => setIsDeleteConfirmVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`todo-delete-confirm-${todo.id}`}
                onPress={handleConfirmDelete}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="trash" size={20} color="#d32f2f" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const URGENCY_BADGE_LABEL: Record<"overdue" | "today" | "tomorrow", string> = {
  overdue: "期限超過",
  today: "今日",
  tomorrow: "明日",
};

const URGENCY_BADGE_STYLE = {
  overdue: "badgeOverdue",
  today: "badgeToday",
  tomorrow: "badgeTomorrow",
} as const;

interface EventSectionProps {
  group: EventTodoGroup;
  today: string;
  tags: Tag[];
  isCollapsed: boolean;
  onToggleCollapse: (eventId: string) => void;
  onToggleTodo: (todo: TodoWithEventTitle) => void;
  onDeleteTodo: (todoId: string) => void;
  onSetReminder: (todoId: string, reminderAt: string | null) => void;
  onEditTodoTitle: (todoId: string, title: string) => void;
  onOpenEvent: (eventId: string) => void;
  sectionRef?: (node: View | null) => void;
}

function EventSection({
  group,
  today,
  tags,
  isCollapsed,
  onToggleCollapse,
  onToggleTodo,
  onDeleteTodo,
  onSetReminder,
  onEditTodoTitle,
  onOpenEvent,
  sectionRef,
}: EventSectionProps) {
  const [isDoneExpanded, setIsDoneExpanded] = useState(false);

  const incompleteTodos = group.todos.filter((todo) => !todo.isDone);
  const doneTodos = group.todos.filter((todo) => todo.isDone);
  const urgency = incompleteTodos.length > 0 ? getEventUrgency(group.eventStartAt, today) : "none";
  const isOverdue = urgency === "overdue";

  return (
    <View
      ref={sectionRef}
      style={styles.section}
      testID={`todo-section-container-${group.eventId}`}
    >
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          testID={`todo-section-${group.eventId}`}
          style={styles.sectionHeaderTitleRow}
          onPress={() => onToggleCollapse(group.eventId)}
        >
          <Icon name={isCollapsed ? "chevron-right" : "chevron-down"} size={15} color="#666" />
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {group.eventTitle}
          </Text>
          {urgency !== "none" ? (
            <Text
              testID={`todo-section-badge-${group.eventId}`}
              style={[styles.badge, styles[URGENCY_BADGE_STYLE[urgency]]]}
            >
              {URGENCY_BADGE_LABEL[urgency]}
            </Text>
          ) : null}
          <Text testID={`todo-section-progress-${group.eventId}`} style={styles.progressText}>
            {doneTodos.length}件/{group.todos.length}件
          </Text>
        </TouchableOpacity>
        {tags.length > 0 ? (
          <View testID={`todo-section-tags-${group.eventId}`}>
            <EventTagBadges tags={tags} />
          </View>
        ) : null}
        <View style={styles.sectionHeaderSubRow}>
          <Text style={styles.sectionDateLabel}>
            {formatEventDateRangeLabel(group.eventStartAt, group.eventEndAt)}
          </Text>
          <TouchableOpacity
            testID={`todo-section-open-event-${group.eventId}`}
            style={styles.moreButton}
            onPress={() => onOpenEvent(group.eventId)}
          >
            <Text style={styles.moreButtonGlyph}>⋯</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isCollapsed ? (
        <>
          {incompleteTodos.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              emphasizeOverdue={isOverdue}
              onToggle={onToggleTodo}
              onDelete={onDeleteTodo}
              onSetReminder={onSetReminder}
              onEditTitle={onEditTodoTitle}
            />
          ))}

          {doneTodos.length > 0 ? (
            <TouchableOpacity
              testID={`todo-done-toggle-${group.eventId}`}
              style={styles.doneToggleRow}
              onPress={() => setIsDoneExpanded((prev) => !prev)}
            >
              <Text style={styles.doneToggleText}>
                {isDoneExpanded ? "完了済みを隠す" : `完了済みを表示 (${doneTodos.length})`}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isDoneExpanded
            ? doneTodos.map((todo) => (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  onToggle={onToggleTodo}
                  onDelete={onDeleteTodo}
                  onSetReminder={onSetReminder}
                  onEditTitle={onEditTodoTitle}
                />
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

interface OrphanedTodoRowProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onDelete: (todoId: string) => void;
  onReattach: (todo: Todo) => void;
  onEditTitle: (todoId: string, title: string) => void;
}

function OrphanedTodoRow({ todo, onToggle, onDelete, onReattach, onEditTitle }: OrphanedTodoRowProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);

  const handleStartEditTitle = () => {
    setTitleDraft(todo.title);
    setIsEditingTitle(true);
  };

  const handleConfirmEditTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    if (trimmed !== todo.title) onEditTitle(todo.id, trimmed);
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
  };

  return (
    <View style={styles.todoRow} testID={`orphaned-todo-item-${todo.id}`}>
      <View style={styles.todoMainRow}>
        <TouchableOpacity testID={`orphaned-todo-checkbox-${todo.id}`} onPress={() => onToggle(todo)}>
          <Text style={styles.checkboxGlyph}>{todo.isDone ? "☑" : "☐"}</Text>
        </TouchableOpacity>

        {isEditingTitle ? (
          <>
            <TextInput
              testID={`orphaned-todo-title-input-${todo.id}`}
              style={styles.todoTitleInput}
              value={titleDraft}
              onChangeText={setTitleDraft}
              autoFocus
            />
            <TouchableOpacity
              testID={`orphaned-todo-title-confirm-${todo.id}`}
              onPress={handleConfirmEditTitle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.confirmCheck}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`orphaned-todo-title-cancel-${todo.id}`}
              onPress={handleCancelEditTitle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.todoTitle, todo.isDone && styles.doneText]}>{todo.title}</Text>
            <TouchableOpacity
              testID={`orphaned-todo-edit-${todo.id}`}
              onPress={handleStartEditTitle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="edit" size={18} color="#2f6fed" />
            </TouchableOpacity>
            <TouchableOpacity testID={`orphaned-todo-reattach-${todo.id}`} onPress={() => onReattach(todo)}>
              <Text style={styles.reattachLink}>予定に紐付ける</Text>
            </TouchableOpacity>
            <TouchableOpacity testID={`orphaned-todo-delete-${todo.id}`} onPress={() => onDelete(todo.id)}>
              <Icon name="trash" size={18} color="#d32f2f" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export default function TodosScreen() {
  const { calendars, refetch: refetchCalendars } = useMyCalendars();
  // カレンダー画面と同じ「デフォルトで全カレンダー選択、タップで表示/非表示切り替え」方式。
  // null = まだ明示的に選択を触っていない(=全カレンダー)。
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string> | null>(null);
  const activeCalendarIds =
    selectedCalendarIds !== null ? Array.from(selectedCalendarIds) : calendars.map((calendar) => calendar.id);

  const handleToggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((prev) => {
      const base = prev ?? new Set(calendars.map((calendar) => calendar.id));
      const next = new Set(base);
      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }
      return next;
    });
  };

  const { todos, refetch } = useTodosByCalendars(activeCalendarIds);
  const { todos: orphanedTodos, refetch: refetchOrphaned } = useOrphanedTodos();
  const [reattachTargetTodo, setReattachTargetTodo] = useState<Todo | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const groups = useMemo(() => groupTodosByEvent(todos), [todos]);
  const eventIds = useMemo(() => groups.map((group) => group.eventId), [groups]);
  const { tagsByEventId } = useEventTagsByEvents(eventIds);

  const isFilterActive = selectedCalendarIds !== null;
  const handleResetFilter = useCallback(() => {
    setSelectedCalendarIds(null);
  }, []);

  // Realtime alone isn't reliable for "created elsewhere" cases (e.g. adding
  // a ToDo from the calendar's event-creation form), so also refetch every
  // time this tab actually comes into view - tabs stay mounted in the
  // background, so switching to this tab wouldn't otherwise re-run anything.
  // The calendar list is refetched here too, since renaming a calendar in the
  // Calendar tab's settings modal only refreshes that tab's own instance of
  // useMyCalendars - every other tab keeps showing the stale name otherwise.
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchOrphaned();
      refetchCalendars();
    }, [refetch, refetchOrphaned, refetchCalendars])
  );
  // On blur (leaving the tab), reset the calendar filter (共通フィルターの決まり).
  // Kept as its own useFocusEffect, independent of the one above: refetch's
  // own identity changes whenever the calendar selection changes (that's by
  // design - it depends on activeCalendarIds), and bundling it into the same
  // effect as the reset meant every toggle tore down and rebuilt that effect,
  // firing the *previous* run's cleanup (this very reset) immediately - so
  // tapping a calendar chip looked like it did nothing, since the filter
  // reset itself right back before the next render was seen.
  useFocusEffect(
    useCallback(() => {
      return handleResetFilter;
    }, [handleResetFilter])
  );
  const { toggleDone } = useToggleDone();
  const { deleteTodo } = useDeleteTodo();
  const { updateTodo } = useUpdateTodo();

  const [collapsedEventIds, setCollapsedEventIds] = useState<Set<string>>(new Set());
  const [isPastVisible, setIsPastVisible] = useState(false);
  const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);

  const today = todayJstDateKey();
  const futureGroups = useMemo(
    () => groups.filter((group) => toJstDateKey(group.eventStartAt) >= today),
    [groups, today]
  );
  // Past events with a still-incomplete todo need attention, so they're
  // always shown (not tucked behind the past-todos toggle below) - only
  // past events that are fully done get hidden there.
  const overdueGroups = useMemo(
    () =>
      groups.filter(
        (group) => countIncomplete(group) > 0 && toJstDateKey(group.eventStartAt) < today
      ),
    [groups, today]
  );
  const pastGroups = useMemo(
    () =>
      groups.filter(
        (group) => countIncomplete(group) === 0 && toJstDateKey(group.eventStartAt) < today
      ),
    [groups, today]
  );
  const incompleteTodoCount = useMemo(() => todos.filter((todo) => !todo.isDone).length, [todos]);
  // "期限超過" gets its own panel, so "期限が近い" now covers only today/tomorrow.
  const dueSoonGroupCount = useMemo(
    () =>
      groups.filter((group) => {
        if (countIncomplete(group) === 0) return false;
        const urgency = getEventUrgency(group.eventStartAt, today);
        return urgency === "today" || urgency === "tomorrow";
      }).length,
    [groups, today]
  );

  const scrollViewRef = useRef<ScrollView>(null);
  const mainListAnchorRef = useRef<View>(null);
  const sectionRefs = useRef(new Map<string, View | null>());

  const handleScrollToIncomplete = () => {
    scrollToNode(scrollViewRef, mainListAnchorRef.current);
  };

  const handleScrollToDueSoon = () => {
    const firstDueSoon = futureGroups.find((group) => {
      if (countIncomplete(group) === 0) return false;
      const urgency = getEventUrgency(group.eventStartAt, today);
      return urgency === "today" || urgency === "tomorrow";
    });
    const node = firstDueSoon ? sectionRefs.current.get(firstDueSoon.eventId) ?? null : null;
    scrollToNode(scrollViewRef, node ?? mainListAnchorRef.current);
  };

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

  const handleSetReminder = async (todoId: string, reminderAt: string | null) => {
    const success = await updateTodo(todoId, { reminderAt });
    if (success) await refetch();
  };

  const handleEditTodoTitle = async (todoId: string, title: string) => {
    const success = await updateTodo(todoId, { title });
    if (success) await refetch();
  };

  const handleToggleOrphaned = async (todo: Todo) => {
    const success = await toggleDone(todo.id, !todo.isDone);
    if (success) await refetchOrphaned();
  };

  const handleDeleteOrphaned = async (todoId: string) => {
    const success = await deleteTodo(todoId);
    if (success) await refetchOrphaned();
  };

  const handleEditOrphanedTodoTitle = async (todoId: string, title: string) => {
    const success = await updateTodo(todoId, { title });
    if (success) await refetchOrphaned();
  };

  const handleReattached = async () => {
    setReattachTargetTodo(null);
    await refetchOrphaned();
    await refetch();
  };

  return (
    <>
      <Tabs.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitleText}>ToDo</Text>
              <PersonalOnlyBadge />
            </View>
          ),
          headerRight: () => (
            <FilterButton testID="todos-filter" isActive={isFilterActive} onReset={handleResetFilter}>
              <FilterSection title="カレンダー">
                {calendars.map((calendar) => (
                  <CalendarSwitchChip
                    key={calendar.id}
                    testID={`todos-calendar-switch-${calendar.id}`}
                    calendar={calendar}
                    isActive={activeCalendarIds.includes(calendar.id)}
                    onPress={() => handleToggleCalendar(calendar.id)}
                  />
                ))}
              </FilterSection>
            </FilterButton>
          ),
        }}
      />
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
      <View style={styles.summaryRow} testID="todos-summary">
        <TouchableOpacity
          testID="todos-summary-incomplete"
          style={styles.summaryCard}
          onPress={handleScrollToIncomplete}
        >
          <Text style={styles.summaryText}>未完了 {incompleteTodoCount}件</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="todos-summary-urgent"
          style={[styles.summaryCard, styles.summaryCardUrgent]}
          onPress={handleScrollToDueSoon}
        >
          <Text style={styles.summaryTextUrgent}>期限が近い {dueSoonGroupCount}件</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="todos-summary-overdue"
          style={[styles.summaryCard, styles.summaryCardOverdue]}
          onPress={() => {
            if (overdueGroups.length > 0) setIsOverdueExpanded((prev) => !prev);
          }}
        >
          <Text style={styles.summaryTextOverdue}>期限超過 {overdueGroups.length}件</Text>
          {overdueGroups.length > 0 ? (
            <Text testID="todos-summary-overdue-hint" style={styles.summaryHint}>
              {isOverdueExpanded ? "タップで隠す" : "タップで展開"}
            </Text>
          ) : null}
        </TouchableOpacity>
      </View>

      {overdueGroups.length > 0 && isOverdueExpanded ? (
        <View style={styles.overdueSection} testID="todos-overdue-section">
          <FlatList
            testID="todos-overdue-section-list"
            data={overdueGroups}
            scrollEnabled={false}
            keyExtractor={(group) => group.eventId}
            renderItem={({ item: group }) => (
              <EventSection
                group={group}
                today={today}
                tags={tagsByEventId[group.eventId] ?? []}
                isCollapsed={collapsedEventIds.has(group.eventId)}
                onToggleCollapse={handleToggleSection}
                onToggleTodo={handleToggle}
                onDeleteTodo={handleDelete}
                onSetReminder={handleSetReminder}
                onEditTodoTitle={handleEditTodoTitle}
                onOpenEvent={setSelectedEventId}
              />
            )}
          />
        </View>
      ) : null}

      <View ref={mainListAnchorRef} style={styles.mainList}>
        {orphanedTodos.length > 0 ? (
          <View style={styles.section} testID="orphaned-todos-section">
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>未紐付けのToDo</Text>
            </View>
            {orphanedTodos.map((todo) => (
              <OrphanedTodoRow
                key={todo.id}
                todo={todo}
                onToggle={handleToggleOrphaned}
                onDelete={handleDeleteOrphaned}
                onReattach={setReattachTargetTodo}
                onEditTitle={handleEditOrphanedTodoTitle}
              />
            ))}
          </View>
        ) : null}

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text>ToDoがありません</Text>
          </View>
        ) : (
          <>
            {futureGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Text>今後のToDoはありません</Text>
              </View>
            ) : (
              <FlatList
                testID="todos-section-list"
                data={futureGroups}
                scrollEnabled={false}
                keyExtractor={(group) => group.eventId}
                renderItem={({ item: group }) => (
                  <EventSection
                    group={group}
                    today={today}
                    tags={tagsByEventId[group.eventId] ?? []}
                    isCollapsed={collapsedEventIds.has(group.eventId)}
                    onToggleCollapse={handleToggleSection}
                    onToggleTodo={handleToggle}
                    onDeleteTodo={handleDelete}
                    onSetReminder={handleSetReminder}
                    onEditTodoTitle={handleEditTodoTitle}
                    onOpenEvent={setSelectedEventId}
                    sectionRef={(node) => sectionRefs.current.set(group.eventId, node)}
                  />
                )}
              />
            )}

            {pastGroups.length > 0 ? (
              <View style={styles.pastToggleRow}>
                <TouchableOpacity testID="todos-past-toggle" onPress={() => setIsPastVisible((prev) => !prev)}>
                  <Text style={styles.pastToggleText}>
                    {isPastVisible ? "過去のToDoを隠す" : `過去のToDoを表示 (${pastGroups.length})`}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isPastVisible ? (
              <FlatList
                testID="todos-past-section-list"
                data={pastGroups}
                scrollEnabled={false}
                keyExtractor={(group) => group.eventId}
                renderItem={({ item: group }) => (
                  <EventSection
                    group={group}
                    today={today}
                    tags={tagsByEventId[group.eventId] ?? []}
                    isCollapsed={collapsedEventIds.has(group.eventId)}
                    onToggleCollapse={handleToggleSection}
                    onToggleTodo={handleToggle}
                    onDeleteTodo={handleDelete}
                    onSetReminder={handleSetReminder}
                    onEditTodoTitle={handleEditTodoTitle}
                    onOpenEvent={setSelectedEventId}
                  />
                )}
              />
            ) : null}
          </>
        )}
      </View>

      {reattachTargetTodo ? (
        <ReattachTodoModal
          todo={reattachTargetTodo}
          calendars={calendars}
          onClose={() => setReattachTargetTodo(null)}
          onReattached={handleReattached}
        />
      ) : null}
      </ScrollView>
      <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafbfc",
  },
  contentContainer: {
    flexGrow: 1,
  },
  // Lets the empty-state messages below (which use flex:1 to center
  // themselves) actually have room to center in, when the ScrollView's
  // content is shorter than the screen.
  mainList: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pastToggleRow: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  pastToggleText: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 15,
  },
  // A card per event, so one event's ToDos read as clearly separate from
  // the next one instead of blending together on the page.
  section: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f2f3f5",
    gap: 4,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionHeaderSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  sectionDateLabel: {
    color: "#999",
    fontSize: 12,
  },
  moreButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e4e6e9",
    alignItems: "center",
    justifyContent: "center",
  },
  moreButtonGlyph: {
    color: "#444",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeOverdue: {
    color: "#fff",
    backgroundColor: "#e24b4a",
  },
  badgeToday: {
    color: "#791f1f",
    backgroundColor: "#fcebeb",
  },
  badgeTomorrow: {
    color: "#633806",
    backgroundColor: "#faeeda",
  },
  progressText: {
    color: "#999",
    fontSize: 12,
  },
  overdueSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  todoRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  todoRowOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: "#e24b4a",
    backgroundColor: "#fcebeb",
  },
  doneToggleRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneToggleText: {
    color: "#666",
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#f2f3f5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  summaryCardUrgent: {
    backgroundColor: "#faeeda",
  },
  summaryCardOverdue: {
    backgroundColor: "#fcebeb",
  },
  summaryText: {
    color: "#444",
    fontWeight: "700",
    fontSize: 15,
  },
  summaryTextUrgent: {
    color: "#633806",
    fontWeight: "700",
    fontSize: 15,
  },
  summaryTextOverdue: {
    color: "#791f1f",
    fontWeight: "700",
    fontSize: 15,
  },
  summaryHint: {
    color: "#791f1f",
    fontSize: 11,
  },
  todoMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkboxGlyph: {
    fontSize: 22,
  },
  todoTitle: {
    flex: 1,
    fontSize: 16,
  },
  todoTitleInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  confirmCheck: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f6fed",
  },
  doneText: {
    color: "#999",
    textDecorationLine: "line-through",
  },
  reattachLink: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 14,
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
});
