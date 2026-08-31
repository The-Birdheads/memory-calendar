import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useAuthSession } from "../../src/features/auth/hooks";
import {
  useCalendarMembers,
  useCreateCalendar,
  useCreateInvite,
  useJoinByInvite,
  useMyCalendars,
  useRemoveMember,
} from "../../src/features/calendars/hooks";
import { getCalendarErrorMessageJa } from "../../src/features/calendars/service";
import { CATEGORY_COLORS, EventFormFields, type EventFormValue } from "../../src/features/events/components/EventFormFields";
import { computeDateRange } from "../../src/features/events/dateRange";
import { expandEventDateKeys } from "../../src/features/events/eventDateKeys";
import { formatDayHeaderLabel } from "../../src/features/events/formatDayHeaderLabel";
import { useCreateEvent, useEventsInRange } from "../../src/features/events/hooks";
import { isJapaneseHoliday } from "../../src/features/events/japaneseHolidays";
import { buildMonthGrid } from "../../src/features/events/monthGrid";
import { resolveMonthSwipeDirection } from "../../src/features/events/monthSwipe";
import { getEventErrorMessageJa } from "../../src/features/events/service";
import type { Event } from "../../src/features/events/types";
import { TagManagementModal } from "../../src/features/tags/components/TagManagementModal";
import { TagPickerRow } from "../../src/features/tags/components/TagPickerRow";
import { useAttachTagsToEvent, useTagTree } from "../../src/features/tags/hooks";
import { useCreateTodo } from "../../src/features/todos/hooks";
import { formatTime } from "../../src/shared/utils/formatDateTime";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const MAX_DOTS_PER_CELL = 3;

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function todayDateKey(): string {
  return toDateKey(new Date().toISOString());
}

function formatMonthLabel(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
}

function resolveEventColor(event: Pick<Event, "categoryColor"> & { tagColor?: string | null }): string {
  return event.tagColor ?? event.categoryColor ?? "#999999";
}

export default function CalendarScreen() {
  const { date: dateParam, calendarId: calendarIdParam } = useLocalSearchParams<{
    date?: string;
    calendarId?: string;
  }>();

  const { session } = useAuthSession();
  const { calendars, refetch: refetchCalendars } = useMyCalendars();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);

  const activeCalendarId = selectedCalendarId ?? calendars[0]?.id ?? "";
  const { members, refetch } = useCalendarMembers(activeCalendarId);
  const { removeMember } = useRemoveMember();
  const { createCalendar, error: createCalendarError } = useCreateCalendar();
  const { createInvite } = useCreateInvite();
  const { joinByInvite, error: joinByInviteError } = useJoinByInvite();

  const [isOnboardingModalVisible, setIsOnboardingModalVisible] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);

  const [focusedDate, setFocusedDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayDateKey());

  // Jumps the calendar to a specific date/calendar when navigated here with
  // ?date=&calendarId= (e.g. "カレンダーへ" from a ToDo's event section).
  useEffect(() => {
    if (calendarIdParam) {
      setSelectedCalendarId(calendarIdParam);
    }
  }, [calendarIdParam]);

  useEffect(() => {
    if (!dateParam) return;
    const parsed = new Date(`${dateParam}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return;
    setFocusedDate(parsed);
    setSelectedDateKey(dateParam);
  }, [dateParam]);

  const range = useMemo(() => computeDateRange("month", focusedDate), [focusedDate]);
  const { events, refetch: refetchEvents } = useEventsInRange(activeCalendarId, range);
  const { createEvent, error: createEventError } = useCreateEvent();
  const { createTodo } = useCreateTodo();

  const { tagTree, refetch: refetchTagTree } = useTagTree(activeCalendarId);
  const { attachTagsToEvent } = useAttachTagsToEvent();
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [isDayEventsModalVisible, setIsDayEventsModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newEventForm, setNewEventForm] = useState<EventFormValue>(() => ({
    title: "",
    isAllDay: true,
    start: new Date(),
    end: new Date(),
    location: "",
    url: "",
    categoryColor: CATEGORY_COLORS[0].hex,
  }));
  const [hasTodos, setHasTodos] = useState(false);
  const [todoItems, setTodoItems] = useState<string[]>([]);
  const [newTodoItemText, setNewTodoItemText] = useState("");

  const monthGrid = useMemo(() => buildMonthGrid(focusedDate), [focusedDate]);
  const eventsForSelectedDate = events.filter((event) =>
    expandEventDateKeys(event.startAt, event.endAt).includes(selectedDateKey)
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((event) => {
      for (const key of expandEventDateKeys(event.startAt, event.endAt)) {
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
      }
    });
    return map;
  }, [events]);

  const isOwner = members.some(
    (member) => member.userId === session?.user.id && member.role === "owner"
  );

  const handleRemove = async (userId: string) => {
    const success = await removeMember(activeCalendarId, userId);
    if (success) {
      await refetch();
    }
  };

  const handleToday = () => {
    const now = new Date();
    setFocusedDate(now);
    setSelectedDateKey(toDateKey(now.toISOString()));
  };

  const handleSelectDateCell = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setIsDayEventsModalVisible(true);
  };

  // The swipe gesture's PanResponder is created once (see monthSwipeResponder
  // below) and keeps calling whatever shiftFocusedDate closure existed at that
  // first render, so shiftFocusedDate must read the CURRENT focusedDate via a
  // ref instead of closing over the (stale, first-render) `focusedDate`
  // variable directly - otherwise every swipe recomputes from that original
  // month instead of the month actually on screen.
  const focusedDateRef = useRef(focusedDate);
  focusedDateRef.current = focusedDate;

  const shiftFocusedDate = (direction: 1 | -1) => {
    const next = new Date(focusedDateRef.current);
    next.setUTCMonth(next.getUTCMonth() + direction);
    setFocusedDate(next);
    setSelectedDateKey(toDateKey(next.toISOString()));
  };

  const monthSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
      onPanResponderRelease: (_event, gestureState) => {
        const direction = resolveMonthSwipeDirection(gestureState.dx, gestureState.dy);
        if (direction !== null) {
          shiftFocusedDate(direction);
        }
      },
    })
  ).current;

  const openCreateModal = () => {
    const base = new Date(`${selectedDateKey}T09:00:00.000Z`);
    setNewEventForm({
      title: "",
      isAllDay: true,
      start: base,
      end: base,
      location: "",
      url: "",
      categoryColor: CATEGORY_COLORS[0].hex,
    });
    setHasTodos(false);
    setTodoItems([]);
    setNewTodoItemText("");
    setSelectedTagIds([]);
    setIsCreateModalVisible(true);
  };

  const handleToggleTagSelection = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleAddTodoItem = () => {
    if (!newTodoItemText.trim()) return;
    setTodoItems((prev) => [...prev, newTodoItemText.trim()]);
    setNewTodoItemText("");
  };

  const handleRemoveTodoItem = (index: number) => {
    setTodoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateCalendar = async () => {
    const success = await createCalendar({ name: newCalendarName });
    if (success) {
      setNewCalendarName("");
      setIsOnboardingModalVisible(false);
      await refetchCalendars();
    }
  };

  const handleJoinByInvite = async () => {
    const success = await joinByInvite(joinInviteCode);
    if (success) {
      setJoinInviteCode("");
      setIsOnboardingModalVisible(false);
      await refetchCalendars();
    }
  };

  const handleGenerateInvite = async () => {
    const invite = await createInvite(activeCalendarId);
    if (invite) {
      setGeneratedInviteCode(invite.code);
    }
  };

  const handleCreateEvent = async () => {
    const createdEvent = await createEvent({
      calendarId: activeCalendarId,
      title: newEventForm.title,
      startAt: newEventForm.start.toISOString(),
      endAt: newEventForm.end.toISOString(),
      isAllDay: newEventForm.isAllDay,
      location: newEventForm.location || undefined,
      url: newEventForm.url || undefined,
      categoryColor: newEventForm.categoryColor,
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
      setIsCreateModalVisible(false);
      await refetchEvents();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.switcher}>
        {calendars.map((calendar) => (
          <TouchableOpacity
            key={calendar.id}
            testID={`calendar-switch-${calendar.id}`}
            onPress={() => setSelectedCalendarId(calendar.id)}
            style={[
              styles.switchButton,
              calendar.id === activeCalendarId && styles.switchButtonActive,
            ]}
          >
            <Text>{calendar.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          testID="calendar-add-button"
          style={styles.switchAddButton}
          onPress={() => setIsOnboardingModalVisible(true)}
        >
          <Text style={styles.switchAddButtonText}>＋</Text>
        </TouchableOpacity>
        {activeCalendarId ? (
          <TouchableOpacity testID="calendar-invite-button" style={styles.inviteButton} onPress={handleGenerateInvite}>
            <Text style={styles.inviteButtonText}>招待</Text>
          </TouchableOpacity>
        ) : null}
        {activeCalendarId ? (
          <TouchableOpacity
            testID="calendar-manage-tags-button"
            style={styles.inviteButton}
            onPress={() => setIsTagModalVisible(true)}
          >
            <Text style={styles.inviteButtonText}>タグ管理</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {calendars.length === 0 ? (
        <Text style={styles.onboardingMessage}>
          カレンダーがありません。作成するか、招待コードで参加してください。
        </Text>
      ) : null}

      {generatedInviteCode ? (
        <View style={styles.inviteCodeBanner}>
          <Text style={styles.inviteCodeLabel}>招待コード</Text>
          <Text style={styles.inviteCodeValue}>{generatedInviteCode}</Text>
          <TouchableOpacity testID="calendar-invite-close" onPress={() => setGeneratedInviteCode(null)}>
            <Text>閉じる</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={isOnboardingModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>カレンダーを作成</Text>
              <TextInput
                testID="calendar-create-name-input"
                style={styles.input}
                placeholder="カレンダー名"
                value={newCalendarName}
                onChangeText={setNewCalendarName}
              />
              {createCalendarError ? (
                <Text style={styles.errorText}>{getCalendarErrorMessageJa(createCalendarError)}</Text>
              ) : null}
              <TouchableOpacity testID="calendar-create-submit" style={styles.createButton} onPress={handleCreateCalendar}>
                <Text style={styles.createButtonText}>作成</Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>招待コードで参加</Text>
              <TextInput
                testID="calendar-join-code-input"
                style={styles.input}
                placeholder="招待コード"
                value={joinInviteCode}
                onChangeText={setJoinInviteCode}
              />
              {joinByInviteError ? (
                <Text style={styles.errorText}>{getCalendarErrorMessageJa(joinByInviteError)}</Text>
              ) : null}
              <TouchableOpacity testID="calendar-join-submit" style={styles.createButton} onPress={handleJoinByInvite}>
                <Text style={styles.createButtonText}>参加</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="calendar-onboarding-cancel"
                onPress={() => setIsOnboardingModalVisible(false)}
              >
                <Text>閉じる</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {isTagModalVisible ? (
        <TagManagementModal
          calendars={calendars}
          initialCalendarId={activeCalendarId}
          onClose={() => setIsTagModalVisible(false)}
          onChange={refetchTagTree}
        />
      ) : null}

      <View style={styles.viewModeRow}>
        <TouchableOpacity testID="calendar-today-button" onPress={handleToday} style={styles.todayButton}>
          <Text>今日</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.monthHeaderRow}>
        <TouchableOpacity testID="calendar-month-prev" onPress={() => shiftFocusedDate(-1)} style={styles.monthNavButton}>
          <Text style={styles.monthNavText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{formatMonthLabel(focusedDate)}</Text>
        <TouchableOpacity testID="calendar-month-next" onPress={() => shiftFocusedDate(1)} style={styles.monthNavButton}>
          <Text style={styles.monthNavText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridContainer} testID="calendar-grid-container" {...monthSwipeResponder.panHandlers}>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, index) => (
            <Text
              key={label}
              style={[
                styles.weekdayLabel,
                index === 6 && styles.weekdaySaturday,
                index === 0 && styles.weekdaySunday,
              ]}
            >
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.weeksArea}>
          {monthGrid.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.gridRow}>
              {week.map((cell) => {
                const cellEvents = eventsByDate.get(cell.dateKey) ?? [];
                const isToday = cell.dateKey === todayDateKey();
                const isSelected = cell.dateKey === selectedDateKey;
                const dayOfWeek = new Date(`${cell.dateKey}T00:00:00.000Z`).getUTCDay();
                const isSaturday = dayOfWeek === 6;
                const isSundayOrHoliday = dayOfWeek === 0 || isJapaneseHoliday(cell.dateKey);
                return (
                  <TouchableOpacity
                    key={cell.dateKey}
                    testID={`calendar-grid-cell-${cell.dateKey}`}
                    style={[
                      styles.gridCell,
                      isSelected && styles.gridCellSelected,
                      !cell.isCurrentMonth && styles.gridCellMuted,
                    ]}
                    onPress={() => handleSelectDateCell(cell.dateKey)}
                  >
                    <View style={[styles.gridDayBadge, isToday && styles.gridDayBadgeToday]}>
                      <Text
                        style={[
                          styles.gridDayText,
                          isSaturday && styles.gridDaySaturday,
                          isSundayOrHoliday && styles.gridDaySunday,
                          isToday && styles.gridDayTextToday,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                    <View style={styles.gridEventList}>
                      {cellEvents.slice(0, MAX_DOTS_PER_CELL).map((event) => (
                        <View
                          key={event.id}
                          testID={`calendar-grid-dot-${event.id}`}
                          style={[styles.gridEventBar, { backgroundColor: resolveEventColor(event) }]}
                        >
                          <Text style={styles.gridEventBarText} numberOfLines={1}>
                            {event.title}
                          </Text>
                        </View>
                      ))}
                      {cellEvents.length > MAX_DOTS_PER_CELL ? (
                        <Text style={styles.gridDotOverflow}>+{cellEvents.length - MAX_DOTS_PER_CELL}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <Modal
        visible={isDayEventsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDayEventsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dayModalOverlay}
          activeOpacity={1}
          onPress={() => setIsDayEventsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.dayModalCard}>
            <View style={styles.dayModalHeader}>
              <Text style={styles.dayModalTitle}>{formatDayHeaderLabel(selectedDateKey)}</Text>
              <View style={styles.dayModalHeaderActions}>
                <TouchableOpacity
                  testID="calendar-day-modal-add"
                  onPress={() => {
                    setIsDayEventsModalVisible(false);
                    openCreateModal();
                  }}
                >
                  <Text style={styles.dayModalAddText}>＋</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="calendar-day-modal-close"
                  onPress={() => setIsDayEventsModalVisible(false)}
                >
                  <Text style={styles.dayModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {eventsForSelectedDate.length === 0 ? (
              <Text style={styles.dayModalEmptyText}>予定はありません</Text>
            ) : (
              <FlatList
                data={eventsForSelectedDate}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.eventRow}
                    testID={`calendar-event-${item.id}`}
                    onPress={() => {
                      setIsDayEventsModalVisible(false);
                      router.push(`/event/${item.id}`);
                    }}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: resolveEventColor(item) }]} />
                    <Text style={styles.eventTime}>
                      {item.isAllDay ? "終日" : `${formatTime(item.startAt)}〜${formatTime(item.endAt)}`}
                    </Text>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Text>
              {item.displayName ??
                (item.userId === session?.user.id ? session?.user.email ?? "メンバー" : "メンバー")}
            </Text>
            {isOwner && item.role !== "owner" ? (
              <TouchableOpacity
                testID={`remove-member-${item.userId}`}
                onPress={() => handleRemove(item.userId)}
              >
                <Text style={styles.removeText}>削除</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />

      <TouchableOpacity testID="calendar-add-event-fab" style={styles.fab} onPress={openCreateModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={isCreateModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>予定を作成</Text>

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

            <TouchableOpacity
              testID="event-create-has-todos-toggle"
              style={styles.alldayRow}
              onPress={() => setHasTodos((prev) => !prev)}
            >
              <Text>ToDoを追加する</Text>
              {hasTodos ? <Text testID="event-create-has-todos-checked">✓</Text> : null}
            </TouchableOpacity>

            {hasTodos ? (
              <View style={styles.todoChecklist}>
                {todoItems.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.todoChecklistRow} testID={`event-create-todo-item-${index}`}>
                    <Text style={styles.todoChecklistText}>{item}</Text>
                    <TouchableOpacity
                      testID={`event-create-todo-item-${index}-remove`}
                      onPress={() => handleRemoveTodoItem(index)}
                    >
                      <Text style={styles.removeText}>削除</Text>
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
            ) : null}

            {createEventError ? (
              <Text style={styles.errorText}>{getEventErrorMessageJa(createEventError)}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="event-create-cancel"
                onPress={() => setIsCreateModalVisible(false)}
              >
                <Text>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="event-create-submit" style={styles.createButton} onPress={handleCreateEvent}>
                <Text style={styles.createButtonText}>作成</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafbfc",
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
  switchAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  switchAddButtonText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  inviteButton: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2f6fed",
  },
  inviteButtonText: {
    color: "#2f6fed",
  },
  onboardingMessage: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    color: "#666",
  },
  inviteCodeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#e8f0fe",
  },
  inviteCodeLabel: {
    color: "#666",
  },
  inviteCodeValue: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
  viewModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  todayButton: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 8,
  },
  monthNavButton: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  monthNavText: {
    fontSize: 20,
    color: "#2f6fed",
    fontWeight: "700",
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 100,
    textAlign: "center",
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weeksArea: {
    flex: 1,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#888",
    paddingVertical: 4,
  },
  weekdaySaturday: {
    color: "#2f6fed",
  },
  weekdaySunday: {
    color: "#e53935",
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
  },
  gridCell: {
    flex: 1,
    alignItems: "center",
    paddingTop: 4,
    gap: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  gridCellSelected: {
    backgroundColor: "#e8f0fe",
  },
  gridCellMuted: {
    opacity: 0.35,
  },
  gridDayBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gridDayBadgeToday: {
    backgroundColor: "#2f6fed",
  },
  gridDayText: {
    fontSize: 13,
  },
  gridDaySaturday: {
    color: "#2f6fed",
  },
  gridDaySunday: {
    color: "#e53935",
  },
  gridDayTextToday: {
    color: "#fff",
    fontWeight: "700",
  },
  gridEventList: {
    width: "100%",
    gap: 1,
    paddingHorizontal: 2,
  },
  gridEventBar: {
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  gridEventBarText: {
    fontSize: 9,
    lineHeight: 11,
    color: "#fff",
    fontWeight: "600",
  },
  gridDotOverflow: {
    fontSize: 9,
    color: "#888",
    textAlign: "center",
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  eventTime: {
    color: "#666",
    fontSize: 12,
    width: 92,
  },
  eventTitle: {
    flex: 1,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  removeText: {
    color: "#d32f2f",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2f6fed",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 30,
  },
  dayModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dayModalCard: {
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  dayModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dayModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  dayModalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  dayModalAddText: {
    fontSize: 22,
    color: "#2f6fed",
    fontWeight: "700",
  },
  dayModalCloseText: {
    fontSize: 18,
    color: "#666",
  },
  dayModalEmptyText: {
    color: "#999",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  errorText: {
    color: "#d32f2f",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alldayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
});
