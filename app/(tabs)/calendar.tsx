import { useMemo, useState } from "react";
import { FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useCalendarMembers, useMyCalendars, useRemoveMember } from "../../src/features/calendars/hooks";
import { computeDateRange, type CalendarViewMode } from "../../src/features/events/dateRange";
import { useCreateEvent, useEventsInRange } from "../../src/features/events/hooks";
import { buildMonthGrid } from "../../src/features/events/monthGrid";
import type { Event } from "../../src/features/events/types";

const VIEW_MODES: CalendarViewMode[] = ["month", "week", "day"];
const VIEW_MODE_LABELS: Record<CalendarViewMode, string> = { month: "月", week: "週", day: "日" };
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const CATEGORY_COLORS: { name: string; hex: string }[] = [
  { name: "blue", hex: "#2f6fed" },
  { name: "red", hex: "#e53935" },
  { name: "green", hex: "#43a047" },
  { name: "orange", hex: "#fb8c00" },
  { name: "purple", hex: "#8e24aa" },
];

const MAX_DOTS_PER_CELL = 3;

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function todayDateKey(): string {
  return toDateKey(new Date().toISOString());
}

function listDateKeysInRange(start: string, end: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(start);
  const endDate = new Date(end);
  while (cursor <= endDate) {
    keys.push(toDateKey(cursor.toISOString()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function formatMonthLabel(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
}

function formatFieldLabel(date: Date, isAllDay: boolean): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  if (isAllDay) {
    return `${y}/${m}/${d}`;
  }
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export default function CalendarScreen() {
  const { session } = useAuthSession();
  const { calendars } = useMyCalendars();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);

  const activeCalendarId = selectedCalendarId ?? calendars[0]?.id ?? "";
  const { members, refetch } = useCalendarMembers(activeCalendarId);
  const { removeMember } = useRemoveMember();

  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [focusedDate, setFocusedDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayDateKey());

  const range = useMemo(() => computeDateRange(viewMode, focusedDate), [viewMode, focusedDate]);
  const { events, refetch: refetchEvents } = useEventsInRange(activeCalendarId, range);
  const { createEvent } = useCreateEvent();

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [newEventStart, setNewEventStart] = useState(() => new Date());
  const [newEventEnd, setNewEventEnd] = useState(() => new Date());
  const [newEventColor, setNewEventColor] = useState(CATEGORY_COLORS[0].hex);
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);

  const dateKeys = useMemo(() => listDateKeysInRange(range.start, range.end), [range]);
  const monthGrid = useMemo(() => buildMonthGrid(focusedDate), [focusedDate]);
  const eventsForSelectedDate = events.filter((event) => toDateKey(event.startAt) === selectedDateKey);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((event) => {
      const key = toDateKey(event.startAt);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
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

  const shiftFocusedDate = (direction: 1 | -1) => {
    const next = new Date(focusedDate);
    if (viewMode === "month") {
      next.setUTCMonth(next.getUTCMonth() + direction);
    } else if (viewMode === "week") {
      next.setUTCDate(next.getUTCDate() + direction * 7);
    } else {
      next.setUTCDate(next.getUTCDate() + direction);
    }
    setFocusedDate(next);
    setSelectedDateKey(toDateKey(next.toISOString()));
  };

  const openCreateModal = () => {
    const base = new Date(`${selectedDateKey}T09:00:00.000Z`);
    setNewEventTitle("");
    setNewEventAllDay(false);
    setNewEventStart(base);
    setNewEventEnd(base);
    setNewEventColor(CATEGORY_COLORS[0].hex);
    setActivePicker(null);
    setIsCreateModalVisible(true);
  };

  const handleCreateEvent = async () => {
    const success = await createEvent({
      calendarId: activeCalendarId,
      title: newEventTitle,
      startAt: newEventStart.toISOString(),
      endAt: newEventEnd.toISOString(),
      isAllDay: newEventAllDay,
      categoryColor: newEventColor,
    });
    if (success) {
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
      </View>

      <View style={styles.viewModeRow}>
        {VIEW_MODES.map((mode) => (
          <TouchableOpacity
            key={mode}
            testID={`calendar-view-${mode}`}
            onPress={() => setViewMode(mode)}
            style={[styles.viewModeButton, mode === viewMode && styles.viewModeButtonActive]}
          >
            <Text>{VIEW_MODE_LABELS[mode]}</Text>
          </TouchableOpacity>
        ))}
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

      {viewMode === "month" ? (
        <View style={styles.gridContainer}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>
          {monthGrid.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.gridRow}>
              {week.map((cell) => {
                const cellEvents = eventsByDate.get(cell.dateKey) ?? [];
                const isToday = cell.dateKey === todayDateKey();
                const isSelected = cell.dateKey === selectedDateKey;
                return (
                  <TouchableOpacity
                    key={cell.dateKey}
                    testID={`calendar-grid-cell-${cell.dateKey}`}
                    style={[
                      styles.gridCell,
                      isSelected && styles.gridCellSelected,
                      !cell.isCurrentMonth && styles.gridCellMuted,
                    ]}
                    onPress={() => setSelectedDateKey(cell.dateKey)}
                  >
                    <View style={[styles.gridDayBadge, isToday && styles.gridDayBadgeToday]}>
                      <Text style={[styles.gridDayText, isToday && styles.gridDayTextToday]}>{cell.day}</Text>
                    </View>
                    <View style={styles.gridDotsRow}>
                      {cellEvents.slice(0, MAX_DOTS_PER_CELL).map((event) => (
                        <View
                          key={event.id}
                          testID={`calendar-grid-dot-${event.id}`}
                          style={[styles.gridDot, { backgroundColor: event.categoryColor ?? "#999999" }]}
                        />
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
      ) : (
        <ScrollView horizontal style={styles.dateList}>
          {dateKeys.map((item) => (
            <TouchableOpacity
              key={item}
              testID={`calendar-date-${item}`}
              onPress={() => setSelectedDateKey(item)}
              style={[styles.dateChip, item === selectedDateKey && styles.dateChipActive]}
            >
              <Text>{item.slice(8, 10)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={eventsForSelectedDate}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.eventRow} testID={`calendar-event-${item.id}`}>
            <View style={[styles.categoryDot, { backgroundColor: item.categoryColor ?? "#999999" }]} />
            <Text>{item.title}</Text>
          </View>
        )}
      />

      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Text>{item.userId}</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>予定を作成</Text>

            <TextInput
              testID="event-create-title-input"
              style={styles.input}
              placeholder="タイトル"
              value={newEventTitle}
              onChangeText={setNewEventTitle}
            />

            <TouchableOpacity
              testID="event-create-allday-toggle"
              style={styles.alldayRow}
              onPress={() => setNewEventAllDay((prev) => !prev)}
            >
              <Text>終日</Text>
              {newEventAllDay ? <Text testID="event-create-allday-checked">✓</Text> : null}
            </TouchableOpacity>

            <TouchableOpacity
              testID="event-create-start-button"
              style={styles.dateField}
              onPress={() => setActivePicker("start")}
            >
              <Text style={styles.dateFieldLabel}>開始</Text>
              <Text>{formatFieldLabel(newEventStart, newEventAllDay)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="event-create-end-button"
              style={styles.dateField}
              onPress={() => setActivePicker("end")}
            >
              <Text style={styles.dateFieldLabel}>終了</Text>
              <Text>{formatFieldLabel(newEventEnd, newEventAllDay)}</Text>
            </TouchableOpacity>

            {activePicker ? (
              <View style={styles.pickerContainer}>
                {Platform.OS === "web" ? (
                  <TextInput
                    testID={activePicker === "start" ? "event-create-start-picker" : "event-create-end-picker"}
                    style={styles.input}
                    placeholder={newEventAllDay ? "YYYY-MM-DD" : "YYYY-MM-DDTHH:mm"}
                    onChangeText={(text) => {
                      const parsed = new Date(newEventAllDay ? `${text}T00:00:00.000Z` : `${text}:00.000Z`);
                      if (!Number.isNaN(parsed.getTime())) {
                        if (activePicker === "start") setNewEventStart(parsed);
                        else setNewEventEnd(parsed);
                      }
                    }}
                  />
                ) : (
                  <DateTimePicker
                    testID={activePicker === "start" ? "event-create-start-picker" : "event-create-end-picker"}
                    value={activePicker === "start" ? newEventStart : newEventEnd}
                    mode={newEventAllDay ? "date" : "datetime"}
                    onChange={(_event: unknown, selected?: Date) => {
                      if (selected) {
                        if (activePicker === "start") {
                          setNewEventStart(selected);
                        } else {
                          setNewEventEnd(selected);
                        }
                      }
                    }}
                  />
                )}
                <TouchableOpacity
                  testID="event-create-picker-done"
                  style={styles.pickerDoneButton}
                  onPress={() => setActivePicker(null)}
                >
                  <Text>完了</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.colorRow}>
              {CATEGORY_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.name}
                  testID={`event-create-color-${color.name}`}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color.hex },
                    newEventColor === color.hex && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setNewEventColor(color.hex)}
                />
              ))}
            </View>

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
        </View>
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
  viewModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  viewModeButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewModeButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
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
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#888",
    paddingVertical: 4,
  },
  gridRow: {
    flexDirection: "row",
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    paddingTop: 4,
    gap: 2,
    borderRadius: 8,
  },
  gridCellSelected: {
    backgroundColor: "#e8f0fe",
  },
  gridCellMuted: {
    opacity: 0.35,
  },
  gridDayBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  gridDayBadgeToday: {
    backgroundColor: "#2f6fed",
  },
  gridDayText: {
    fontSize: 12,
  },
  gridDayTextToday: {
    color: "#fff",
    fontWeight: "700",
  },
  gridDotsRow: {
    flexDirection: "row",
    gap: 2,
    minHeight: 6,
  },
  gridDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  gridDotOverflow: {
    fontSize: 8,
    color: "#888",
  },
  dateList: {
    flexGrow: 0,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  dateChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  dateChipActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
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
  dateField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFieldLabel: {
    color: "#666",
  },
  pickerContainer: {
    gap: 8,
    alignItems: "flex-end",
  },
  pickerDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: "#333",
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
