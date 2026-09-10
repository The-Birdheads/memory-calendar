import { useCallback, useMemo, useState } from "react";
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Tabs, useFocusEffect } from "expo-router";

import { useMyCalendars } from "../../src/features/calendars/hooks";
import { CalendarSwitchChip } from "../../src/features/calendars/components/CalendarSwitchChip";
import { EventDetailModal } from "../../src/features/events/components/EventDetailModal";
import { formatDayHeaderLabel } from "../../src/features/events/formatDayHeaderLabel";
import { groupEventsByYearMonth } from "../../src/features/history/groupByYearMonth";
import { usePastEventsByTag } from "../../src/features/history/hooks";
import { groupMemoriesByYearMonth } from "../../src/features/memories/groupByYearMonth";
import { useEventIdsWithPhotos, useMemoriesTimeline } from "../../src/features/memories/hooks";
import { selectOnThisDayEntries } from "../../src/features/memories/onThisDay";
import { EventTagBadges } from "../../src/features/tags/components/EventTagBadges";
import { useEventTagsByEvents, useTagTree } from "../../src/features/tags/hooks";
import { flattenVisibleTagTree, getAncestorChainIds } from "../../src/features/tags/tagTree";
import type { TagTreeNode } from "../../src/features/tags/types";
import { FilterButton, FilterSection } from "../../src/shared/components/FilterButton";
import { Icon } from "../../src/shared/components/Icon";
import { jstNow, todayJstDateKey, toJstDateKey } from "../../src/shared/utils/formatDateTime";

function flattenTags(nodes: TagTreeNode[]): TagTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTags(node.children)]);
}

/** "2年前"/"1年前" - どちらもJST日付キー("YYYY-MM-DD")なので年の部分の文字列比較だけで済む。 */
function yearsAgoLabel(entryJstDateKey: string, todayKey: string): string {
  const years = Number(todayKey.slice(0, 4)) - Number(entryJstDateKey.slice(0, 4));
  return `${years}年前`;
}

type HistoryMode = "timeline" | "photos";

/**
 * 振り返りタブ本体。上部のメニュー(年表/画像)で表示を切り替える - 年表は
 * 旧・振り返りタブ、画像は旧・思い出タブの内容をそのまま引き継ぐ。片方は
 * 常にアンマウントされる(タブを離れた時と同じ扱いで、都度絞り込みが
 * リセットされる)ので、それぞれ独立したuseFocusEffect/フィルター状態を
 * 持つ従来の実装をそのままパネルとして残している。
 */
export default function HistoryScreen() {
  const [mode, setMode] = useState<HistoryMode>("timeline");

  return (
    <View style={styles.container}>
      <View style={styles.modeSwitchRow} testID="history-mode-switch">
        <TouchableOpacity
          testID="history-mode-timeline"
          style={[styles.modeSwitchButton, mode === "timeline" && styles.modeSwitchButtonActive]}
          onPress={() => setMode("timeline")}
        >
          <Text style={mode === "timeline" ? styles.modeSwitchTextActive : styles.modeSwitchText}>年表</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="history-mode-photos"
          style={[styles.modeSwitchButton, mode === "photos" && styles.modeSwitchButtonActive]}
          onPress={() => setMode("photos")}
        >
          <Text style={mode === "photos" ? styles.modeSwitchTextActive : styles.modeSwitchText}>画像</Text>
        </TouchableOpacity>
      </View>

      {mode === "timeline" ? <TimelinePanel /> : <PhotoGridPanel />}
    </View>
  );
}

function TimelinePanel() {
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

  const { tagTree } = useTagTree();
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined);

  const handleResetFilters = useCallback(() => {
    setSelectedCalendarIds(null);
    setSelectedTagId(undefined);
  }, []);

  // カレンダー名の変更はCalendarタブ自身のuseMyCalendarsしか再取得しないため、
  // このタブに来るたびに取り直して最新の名前を反映する。フィルターは、この
  // パネルを離れるたびに(戻ってきたときは常にまっさらな状態から絞り込み直せる
  // ように)リセットする - useFocusEffectのクリーンアップはフォーカスが
  // 外れた時、および(画像パネルへの切り替えで)アンマウントされた時に呼ばれる
  // ので、ここでリセットする。
  useFocusEffect(
    useCallback(() => {
      refetchCalendars();
      return handleResetFilters;
    }, [refetchCalendars, handleResetFilters])
  );

  const { events } = usePastEventsByTag(selectedTagId, activeCalendarIds);

  // 大分類 → 中分類 → 小分類 の順にドリルダウンして選択肢を表示する。
  const allTagsFlat = useMemo(() => flattenTags(tagTree), [tagTree]);
  const expandedTagIds = useMemo(
    () => getAncestorChainIds(selectedTagId, allTagsFlat),
    [selectedTagId, allTagsFlat]
  );
  const visibleTags = useMemo(
    () => flattenVisibleTagTree(tagTree, expandedTagIds),
    [tagTree, expandedTagIds]
  );

  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const { tagsByEventId } = useEventTagsByEvents(eventIds);
  const { eventIdsWithPhotos } = useEventIdsWithPhotos(eventIds);
  const timelineGroups = useMemo(() => groupEventsByYearMonth(events), [events]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const handleCloseDetail = () => setSelectedEventId(null);

  const isFilterActive = selectedCalendarIds !== null || selectedTagId !== undefined;

  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <FilterButton testID="history-filter" isActive={isFilterActive} onReset={handleResetFilters}>
              <FilterSection title="カレンダー">
                {calendars.map((calendar) => (
                  <CalendarSwitchChip
                    key={calendar.id}
                    testID={`history-calendar-filter-${calendar.id}`}
                    calendar={calendar}
                    isActive={activeCalendarIds.includes(calendar.id)}
                    onPress={() => handleToggleCalendar(calendar.id)}
                  />
                ))}
              </FilterSection>
              <FilterSection title="タグ">
                <TouchableOpacity
                  testID="history-tag-filter-all"
                  onPress={() => setSelectedTagId(undefined)}
                  style={[styles.filterChip, selectedTagId === undefined && styles.filterChipActive]}
                >
                  <Text style={selectedTagId === undefined ? styles.filterChipTextActive : styles.filterChipText}>
                    すべて
                  </Text>
                </TouchableOpacity>
                {visibleTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    testID={`history-tag-filter-${tag.id}`}
                    onPress={() => setSelectedTagId(tag.id)}
                    style={[styles.filterChip, selectedTagId === tag.id && styles.filterChipActive]}
                  >
                    <Text style={selectedTagId === tag.id ? styles.filterChipTextActive : styles.filterChipText}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </FilterSection>
            </FilterButton>
          ),
        }}
      />

      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text>該当する予定がありません</Text>
        </View>
      ) : (
        <FlatList
          testID="history-timeline"
          data={timelineGroups}
          keyExtractor={(group) => group.yearMonth}
          contentContainerStyle={styles.timelineContent}
          renderItem={({ item: group }) => (
            <View testID={`history-month-group-${group.yearMonth}`}>
              <Text style={styles.monthHeader}>{group.label}</Text>
              {group.events.map((event, index) => {
                const tags = tagsByEventId[event.id] ?? [];
                const hasPhotos = eventIdsWithPhotos.has(event.id);
                const isLastInGroup = index === group.events.length - 1;

                return (
                  <TouchableOpacity
                    key={event.id}
                    testID={`history-event-${event.id}`}
                    style={styles.timelineRow}
                    onPress={() => setSelectedEventId(event.id)}
                  >
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {isLastInGroup ? null : <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineCardWrap}>
                      <Text style={styles.timelineDate}>
                        {formatDayHeaderLabel(toJstDateKey(event.startAt))}
                      </Text>
                      <View style={styles.timelineCard}>
                        <View style={styles.timelineTitleRow}>
                          <Text style={styles.timelineTitle} numberOfLines={1}>
                            {event.title}
                          </Text>
                          {hasPhotos ? (
                            <Icon
                              testID={`history-event-photo-icon-${event.id}`}
                              name="photo"
                              size={16}
                              color="#2f6fed"
                            />
                          ) : null}
                        </View>
                        {tags.length > 0 ? <EventTagBadges tags={tags} /> : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        />
      )}

      <EventDetailModal eventId={selectedEventId} onClose={handleCloseDetail} />
    </>
  );
}

function PhotoGridPanel() {
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

  // null/null = すべて(絞り込みなし)。有効化すると現在のJST年月から始める。
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const isFilteringByMonth = filterYear !== null && filterMonth !== null;
  const memoriesFilter = isFilteringByMonth ? { year: filterYear, month: filterMonth } : undefined;

  const isFilterActive = selectedCalendarIds !== null || isFilteringByMonth;
  const handleResetFilter = useCallback(() => {
    setSelectedCalendarIds(null);
    setFilterYear(null);
    setFilterMonth(null);
  }, []);

  // カレンダー名の変更はCalendarタブ自身のuseMyCalendarsしか再取得しないため、
  // このタブに来るたびに取り直して最新の名前を反映する。パネルを離れるたびに
  // 絞り込みをリセットする(共通フィルターの決まり)。
  useFocusEffect(
    useCallback(() => {
      refetchCalendars();
      return handleResetFilter;
    }, [refetchCalendars, handleResetFilter])
  );

  const { entries } = useMemoriesTimeline(activeCalendarIds, memoriesFilter);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const monthGroups = useMemo(() => groupMemoriesByYearMonth(entries), [entries]);
  // 「n年前の今日」サプライズ演出 - 特定の年月に絞り込んでいる間は(その月の
  // 中に今日と同じ月日がある年もあるので)紛らわしくなるため出さない。
  const today = todayJstDateKey();
  const onThisDayEntries = useMemo(
    () => (isFilteringByMonth ? [] : selectOnThisDayEntries(entries, today)),
    [entries, isFilteringByMonth, today]
  );

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

  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <FilterButton testID="memories-filter" isActive={isFilterActive} onReset={handleResetFilter}>
              <FilterSection title="カレンダー">
                {calendars.map((calendar) => (
                  <CalendarSwitchChip
                    key={calendar.id}
                    testID={`memories-calendar-switch-${calendar.id}`}
                    calendar={calendar}
                    isActive={activeCalendarIds.includes(calendar.id)}
                    onPress={() => handleToggleCalendar(calendar.id)}
                  />
                ))}
              </FilterSection>
              <FilterSection title="期間">
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
              </FilterSection>
            </FilterButton>
          ),
        }}
      />

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>📷</Text>
          <Text>思い出がありません</Text>
        </View>
      ) : (
        <FlatList
          testID="memories-timeline"
          data={monthGroups}
          keyExtractor={(group) => group.yearMonth}
          contentContainerStyle={styles.photoListContent}
          ListHeaderComponent={
            onThisDayEntries.length > 0 ? (
              <View style={styles.onThisDayCard} testID="memories-on-this-day">
                <Text style={styles.onThisDayTitle}>✨ 今日の思い出</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.onThisDayRow}
                >
                  {onThisDayEntries.map((entry) => (
                    <TouchableOpacity
                      key={entry.id}
                      testID={`memories-on-this-day-item-${entry.id}`}
                      style={styles.onThisDayItem}
                      onPress={() => setSelectedEventId(entry.id)}
                    >
                      {entry.thumbnailUrl ? (
                        <Image source={{ uri: entry.thumbnailUrl }} style={styles.onThisDayThumbnail} />
                      ) : null}
                      <Text style={styles.onThisDayItemYear}>{yearsAgoLabel(toJstDateKey(entry.startAt), today)}</Text>
                      <Text style={styles.onThisDayItemLabel} numberOfLines={1}>
                        {entry.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          renderItem={({ item: group }) => (
            <View testID={`memories-month-group-${group.yearMonth}`}>
              <Text style={styles.photoMonthHeader}>
                {group.label} <Text style={styles.photoMonthCount}>{group.entries.length}件</Text>
              </Text>
              <View style={styles.photoGrid}>
                {group.entries.map((entry) => (
                  <TouchableOpacity
                    key={entry.id}
                    testID={`memory-item-${entry.id}`}
                    style={styles.photoCard}
                    onPress={() => setSelectedEventId(entry.id)}
                  >
                    {entry.thumbnailUrl ? (
                      <Image
                        testID={`memory-thumbnail-${entry.id}`}
                        source={{ uri: entry.thumbnailUrl }}
                        style={styles.photoCardImage}
                      />
                    ) : (
                      <View style={styles.photoCardImagePlaceholder} />
                    )}
                    <View style={styles.photoCardCaption}>
                      <Text style={styles.photoCardTitle} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      <Text style={styles.photoCardDate}>{formatDayHeaderLabel(toJstDateKey(entry.startAt))}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafbfc",
  },
  modeSwitchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  modeSwitchButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f2f3f5",
  },
  modeSwitchButtonActive: {
    backgroundColor: "#2f6fed",
  },
  modeSwitchText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
  },
  modeSwitchTextActive: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  filterChipActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 15,
    color: "#444",
  },
  filterChipTextActive: {
    fontSize: 15,
    color: "#0c447c",
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  monthHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    paddingTop: 16,
    paddingBottom: 8,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
  },
  timelineRail: {
    width: 12,
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2f6fed",
    marginTop: 6,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#e0e0e0",
    marginTop: 2,
  },
  timelineCardWrap: {
    flex: 1,
    paddingBottom: 14,
  },
  timelineDate: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  timelineCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timelineTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
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
  emptyStateEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  photoListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // 「n年前の今日」サプライズカード - タイムライン本文とは違うトーン(暖色)
  // にして、通常のアルバム閲覧とは違う特別感/ワクワク感を出す。
  onThisDayCard: {
    backgroundColor: "#faeeda",
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  onThisDayTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#633806",
    marginBottom: 10,
  },
  onThisDayRow: {
    gap: 10,
  },
  onThisDayItem: {
    width: 96,
  },
  onThisDayThumbnail: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: "#eee",
    marginBottom: 6,
  },
  onThisDayItemYear: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a15c00",
  },
  onThisDayItemLabel: {
    fontSize: 12,
    color: "#633806",
  },
  photoMonthHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    paddingTop: 8,
    paddingBottom: 12,
  },
  photoMonthCount: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999",
  },
  // アルバムをめくるような2カラムのカードグリッド - 単なるカメラロールの
  // 正方形タイルより写真が大きく、ふと見て思い出せるサイズを確保する。
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 20,
  },
  photoCard: {
    width: "47%",
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  photoCardImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#eee",
  },
  photoCardImagePlaceholder: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#eee",
  },
  photoCardCaption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  photoCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  photoCardDate: {
    fontSize: 11,
    color: "#999",
  },
});
