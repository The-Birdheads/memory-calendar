import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useCalendarMembers, useMyCalendars, useRemoveMember } from "../../src/features/calendars/hooks";
import { computeDateRange, type CalendarViewMode } from "../../src/features/events/dateRange";
import { useCreateEvent, useEventsInRange } from "../../src/features/events/hooks";

const VIEW_MODES: CalendarViewMode[] = ["month", "week", "day"];
const VIEW_MODE_LABELS: Record<CalendarViewMode, string> = { month: "月", week: "週", day: "日" };

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

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStartAt, setNewEventStartAt] = useState("");
  const [newEventEndAt, setNewEventEndAt] = useState("");

  const dateKeys = useMemo(() => listDateKeysInRange(range.start, range.end), [range]);
  const eventsForSelectedDate = events.filter((event) => toDateKey(event.startAt) === selectedDateKey);

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

  const handleCreateEvent = async () => {
    const success = await createEvent({
      calendarId: activeCalendarId,
      title: newEventTitle,
      startAt: newEventStartAt,
      endAt: newEventEndAt,
    });
    if (success) {
      setNewEventTitle("");
      setNewEventStartAt("");
      setNewEventEndAt("");
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

      <View style={styles.createForm}>
        <TextInput
          testID="event-create-title-input"
          style={styles.input}
          placeholder="タイトル"
          value={newEventTitle}
          onChangeText={setNewEventTitle}
        />
        <TextInput
          testID="event-create-start-input"
          style={styles.input}
          placeholder="開始日時(ISO)"
          value={newEventStartAt}
          onChangeText={setNewEventStartAt}
        />
        <TextInput
          testID="event-create-end-input"
          style={styles.input}
          placeholder="終了日時(ISO)"
          value={newEventEndAt}
          onChangeText={setNewEventEndAt}
        />
        <TouchableOpacity testID="event-create-submit" style={styles.createButton} onPress={handleCreateEvent}>
          <Text>予定を作成</Text>
        </TouchableOpacity>
      </View>

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
  createForm: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
