import { useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useMyCalendars } from "../../src/features/calendars/hooks";
import {
  useComments,
  usePostComment,
  useReactions,
  useToggleReaction,
} from "../../src/features/communication/hooks";
import { EventCommentsSection } from "../../src/features/communication/components/EventCommentsSection";
import { EventReactionsBar } from "../../src/features/communication/components/EventReactionsBar";
import { useEventPhotos, useMemoriesTimeline } from "../../src/features/memories/hooks";
import { EventPhotosGallery } from "../../src/features/memories/components/EventPhotosGallery";
import { formatDateTime, jstNow } from "../../src/shared/utils/formatDateTime";

export default function MemoriesScreen() {
  const { session } = useAuthSession();
  const { calendars } = useMyCalendars();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const activeCalendarId = selectedCalendarId ?? calendars[0]?.id ?? "";
  // 個人用カレンダーの予定にはスタンプ機能を出さない。
  const activeCalendar = calendars.find((calendar) => calendar.id === activeCalendarId) ?? calendars[0];
  const isPersonalCalendar = activeCalendar?.kind === "personal";

  // null/null = すべて(絞り込みなし)。有効化すると現在のJST年月から始める。
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const isFilteringByMonth = filterYear !== null && filterMonth !== null;
  const memoriesFilter = isFilteringByMonth ? { year: filterYear, month: filterMonth } : undefined;

  const { entries } = useMemoriesTimeline(activeCalendarId, memoriesFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clearMonthFilter = () => {
    setFilterYear(null);
    setFilterMonth(null);
  };

  const enableMonthFilter = () => {
    const now = jstNow();
    setFilterYear(now.getUTCFullYear());
    setFilterMonth(now.getUTCMonth() + 1);
  };

  const shiftFilterMonth = (delta: number) => {
    if (filterYear === null || filterMonth === null) return;
    const zeroBased = filterMonth - 1 + delta;
    const wrappedMonth = ((zeroBased % 12) + 12) % 12;
    const yearDelta = Math.floor(zeroBased / 12);
    setFilterYear(filterYear + yearDelta);
    setFilterMonth(wrappedMonth + 1);
  };

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;

  const { photos } = useEventPhotos(selectedId ?? "");
  const { comments, refetch: refetchComments } = useComments(selectedId ?? "");
  const { postComment } = usePostComment();
  const { reactions, refetch: refetchReactions } = useReactions(selectedId ?? "");
  const { toggleReaction } = useToggleReaction();

  const myReaction = reactions.find((reaction) => reaction.userId === session?.user.id) ?? null;

  const handleSubmitComment = async (body: string) => {
    if (!selectedId) return;
    const success = await postComment(selectedId, body);
    if (success) await refetchComments();
  };

  const handleToggleReaction = async (stampType: string) => {
    if (!selectedId) return;
    const success = await toggleReaction(selectedId, stampType, myReaction);
    if (success) await refetchReactions();
  };

  if (selectedEntry) {
    return (
      <View style={styles.container}>
        <TouchableOpacity testID="memory-back-button" onPress={() => setSelectedId(null)}>
          <Text>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedEntry.title}</Text>
        <Text style={styles.meta}>{formatDateTime(selectedEntry.startAt)}</Text>
        <EventPhotosGallery photos={photos} />
        {isPersonalCalendar ? null : (
          <EventReactionsBar
            reactions={reactions}
            currentUserId={session?.user.id}
            onToggleReaction={handleToggleReaction}
          />
        )}
        <EventCommentsSection comments={comments} onSubmit={handleSubmitComment} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>思い出</Text>

      <View style={styles.switcher}>
        {calendars.map((calendar) => (
          <TouchableOpacity
            key={calendar.id}
            testID={`memories-calendar-switch-${calendar.id}`}
            onPress={() => {
              setSelectedCalendarId(calendar.id);
              setSelectedId(null);
            }}
            style={[
              styles.switchButton,
              calendar.id === activeCalendarId && styles.switchButtonActive,
            ]}
          >
            <Text>{calendar.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          testID="memories-filter-all"
          onPress={clearMonthFilter}
          style={[styles.filterChip, !isFilteringByMonth && styles.filterChipActive]}
        >
          <Text>すべて</Text>
        </TouchableOpacity>
        {isFilteringByMonth ? (
          <View style={styles.monthNav}>
            <TouchableOpacity
              testID="memories-month-prev"
              onPress={() => shiftFilterMonth(-1)}
              style={styles.monthNavButton}
            >
              <Text style={styles.monthNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {filterYear}年{filterMonth}月
            </Text>
            <TouchableOpacity
              testID="memories-month-next"
              onPress={() => shiftFilterMonth(1)}
              style={styles.monthNavButton}
            >
              <Text style={styles.monthNavText}>›</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID="memories-filter-month-toggle"
            onPress={enableMonthFilter}
            style={styles.filterChip}
          >
            <Text>年月で絞り込む</Text>
          </TouchableOpacity>
        )}
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text>思い出がありません</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`memory-item-${item.id}`}
              style={styles.item}
              onPress={() => setSelectedId(item.id)}
            >
              {item.thumbnailUrl ? (
                <Image
                  testID={`memory-thumbnail-${item.id}`}
                  source={{ uri: item.thumbnailUrl }}
                  style={styles.thumbnail}
                />
              ) : null}
              <Text>{item.title}</Text>
            </TouchableOpacity>
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
  title: {
    fontSize: 18,
    fontWeight: "700",
    padding: 12,
  },
  meta: {
    color: "#666",
    fontSize: 12,
    paddingHorizontal: 12,
  },
  switcher: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
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
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  monthNavButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthNavText: {
    fontSize: 18,
    color: "#2f6fed",
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 72,
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    flex: 1,
    padding: 8,
    alignItems: "center",
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
});
