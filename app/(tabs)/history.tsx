import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Tabs, useFocusEffect } from "expo-router";

import { useMyCalendars } from "../../src/features/calendars/hooks";
import { CalendarSwitchChip } from "../../src/features/calendars/components/CalendarSwitchChip";
import { EventCreateModal } from "../../src/features/events/components/EventCreateModal";
import { EventDetailModal } from "../../src/features/events/components/EventDetailModal";
import { formatDayHeaderLabel } from "../../src/features/events/formatDayHeaderLabel";
import { groupEventsByYearMonth } from "../../src/features/history/groupByYearMonth";
import { usePastEventsByTag } from "../../src/features/history/hooks";
import { groupMemoriesByYearMonth } from "../../src/features/memories/groupByYearMonth";
import { useEventIdsWithPhotos, useMemoriesTimeline } from "../../src/features/memories/hooks";
import { selectOnThisDayEntries } from "../../src/features/memories/onThisDay";
import { AdBanner } from "../../src/features/ads/AdBanner";
import { photoAdAfterCardIndexes } from "../../src/features/ads/photoGridAds";
import { useBannerPlacement } from "../../src/features/ads/useBannerPlacement";
import { BulkSelectionActionBar } from "../../src/features/tags/components/BulkSelectionActionBar";
import { BulkTagAssignPanel } from "../../src/features/tags/components/BulkTagAssignPanel";
import { EventTagBadges } from "../../src/features/tags/components/EventTagBadges";
import { SelectionCircle } from "../../src/features/tags/components/SelectionCircle";
import { TagIcon } from "../../src/features/tags/components/TagIcon";
import { TagPickerRow } from "../../src/features/tags/components/TagPickerRow";
import {
  useAttachTagsToEvents,
  useBulkTagSelection,
  useEventTagsByEvents,
  useRemoveAllTagsFromEvents,
  useTagTree,
} from "../../src/features/tags/hooks";
import { flattenTagTree, sortTagsHierarchically } from "../../src/features/tags/tagTree";
import { DateRangeFilterSection } from "../../src/shared/components/DateRangeFilterSection";
import { FilterButton, FilterSection } from "../../src/shared/components/FilterButton";
import { Icon } from "../../src/shared/components/Icon";
import { KeywordFilterField } from "../../src/shared/components/KeywordFilterField";
import { isDateKeyInRange } from "../../src/shared/utils/dateRangeFilter";
import { matchesKeyword } from "../../src/shared/utils/keywordFilter";
import { jstNow, todayJstDateKey, toJstDateKey } from "../../src/shared/utils/formatDateTime";

// 年表で、広告を入れる間隔(月のまとまり何個ごとか)。
const TIMELINE_AD_INTERVAL = 2;

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
  // 複数選択(AND条件 - 選択した全てのタグが付いている予定だけを表示)。
  // 「未設定」は実在のタグとは併用できない排他的な状態として別に持つ。
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isUntaggedSelected, setIsUntaggedSelected] = useState(false);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  // keyword = 絞り込みに反映済みの値。入力中の値はKeywordFilterField内で持ち、
  // 「絞り込み」ボタンを押した時だけここへ反映する(入力のたびに画面を
  // 再描画すると日本語の変換が途切れるため)。
  const [keyword, setKeyword] = useState("");
  const keywordDraftRef = useRef("");
  const [keywordFieldResetCount, setKeywordFieldResetCount] = useState(0);

  const bulk = useBulkTagSelection();
  const { attachTagsToEvents } = useAttachTagsToEvents();
  const { removeAllTagsFromEvents } = useRemoveAllTagsFromEvents();

  const handleResetFilters = useCallback(() => {
    setSelectedCalendarIds(null);
    setSelectedTagIds([]);
    setIsUntaggedSelected(false);
    setPeriodStart(null);
    setPeriodEnd(null);
    setKeyword("");
    keywordDraftRef.current = "";
    setKeywordFieldResetCount((count) => count + 1);
  }, []);

  const handleSelectAllTags = () => {
    setSelectedTagIds([]);
    setIsUntaggedSelected(false);
  };
  const handleSelectUntagged = () => {
    setSelectedTagIds([]);
    setIsUntaggedSelected(true);
  };
  const handleToggleTagFilter = (tagId: string) => {
    setIsUntaggedSelected(false);
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  // カレンダー名の変更はCalendarタブ自身のuseMyCalendarsしか再取得しないため、
  // このタブに来るたびに取り直して最新の名前を反映する。フィルターは、この
  // パネルを離れるたびに(戻ってきたときは常にまっさらな状態から絞り込み直せる
  // ように)リセットする - useFocusEffectのクリーンアップはフォーカスが
  // 外れた時、および(画像パネルへの切り替えで)アンマウントされた時に呼ばれる
  // ので、ここでリセットする。まとめて付与/削除モードも同じ扱いでリセットする。
  useFocusEffect(
    useCallback(() => {
      refetchCalendars();
      return () => {
        handleResetFilters();
        bulk.deactivate();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchCalendars, handleResetFilters])
  );

  // タグでの絞り込み(未設定/複数選択のAND条件)はすべてクライアント側で行う
  // ので、RPCへは常にタグ指定なし(全件)を渡す。
  const {
    events: eventsByTag,
    isLoading: isLoadingEventsByTag,
    refetch: refetchEventsByTag,
  } = usePastEventsByTag(undefined, activeCalendarIds);
  // 期間とタイトルのキーワードもタグ同様クライアント側で絞り込む。
  const periodFilteredEvents = useMemo(
    () =>
      eventsByTag.filter(
        (event) =>
          isDateKeyInRange(toJstDateKey(event.startAt), periodStart, periodEnd) &&
          matchesKeyword(event.title, keyword)
      ),
    [eventsByTag, periodStart, periodEnd, keyword]
  );

  const allTagsFlat = useMemo(() => flattenTagTree(tagTree), [tagTree]);

  const periodFilteredEventIds = useMemo(
    () => periodFilteredEvents.map((event) => event.id),
    [periodFilteredEvents]
  );
  const { tagsByEventId, refetch: refetchEventTags } = useEventTagsByEvents(periodFilteredEventIds);
  // タグは予定と違いイベントID一覧が変わらない限り自動では取り直されない
  // (カレンダー画面で付け外ししてこのタブに戻ってきても反映されない不具合の
  // 修正) - フォーカスのたびに明示的に取り直す。
  useFocusEffect(
    useCallback(() => {
      refetchEventTags();
    }, [refetchEventTags])
  );
  const events = useMemo(() => {
    if (isUntaggedSelected) {
      return periodFilteredEvents.filter((event) => (tagsByEventId[event.id] ?? []).length === 0);
    }
    if (selectedTagIds.length > 0) {
      return periodFilteredEvents.filter((event) => {
        const eventTagIds = new Set((tagsByEventId[event.id] ?? []).map((tag) => tag.id));
        return selectedTagIds.every((tagId) => eventTagIds.has(tagId));
      });
    }
    return periodFilteredEvents;
  }, [periodFilteredEvents, isUntaggedSelected, selectedTagIds, tagsByEventId]);

  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const { eventIdsWithPhotos } = useEventIdsWithPhotos(eventIds);
  const timelineGroups = useMemo(() => groupEventsByYearMonth(events), [events]);
  // 年表の広告: 2か月ごとに入れる。スクロールしない最初の画面には出さない。
  const timelineBanners = useBannerPlacement(timelineGroups.length, TIMELINE_AD_INTERVAL);
  const calendarColorById = useMemo(
    () => Object.fromEntries(calendars.map((calendar) => [calendar.id, calendar.color])),
    [calendars]
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreateEventModalVisible, setIsCreateEventModalVisible] = useState(false);
  // 予定詳細(EventDetailModal)はこの画面から離れずにその場で開閉するだけ
  // なので、フォーカス時のrefetchだけでは編集内容(タグの付け外しなど)が
  // 一覧に反映されない不具合の修正 - 閉じた時点で明示的に取り直す。
  const handleCloseDetail = () => {
    setSelectedEventId(null);
    refetchEventTags();
    refetchEventsByTag();
  };

  const isFilterActive =
    selectedCalendarIds !== null ||
    selectedTagIds.length > 0 ||
    isUntaggedSelected ||
    periodStart !== null ||
    periodEnd !== null ||
    keyword.trim() !== "";

  const selectedTagNames = useMemo(
    () => bulk.selectedTagIds.flatMap((tagId) => allTagsFlat.find((tag) => tag.id === tagId)?.name ?? []),
    [bulk.selectedTagIds, allTagsFlat]
  );

  const handleConfirmBulkAction = async () => {
    if (bulk.mode === "assign") {
      await attachTagsToEvents(bulk.selectedTagIds, bulk.selectedEventIds);
    } else {
      await removeAllTagsFromEvents(bulk.selectedEventIds);
    }
    bulk.deactivate();
    await refetchEventTags();
    await refetchEventsByTag();
  };

  const handleEventRowPress = (eventId: string) => {
    if (bulk.isActive) {
      bulk.toggleEvent(eventId);
    } else {
      setSelectedEventId(eventId);
    }
  };

  return (
    <>
      <Tabs.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity
              testID="history-bulk-tag-button"
              onPress={() => (bulk.isActive ? bulk.deactivate() : bulk.activate())}
              style={styles.headerTagButton}
            >
              <TagIcon size={18} color={bulk.isActive ? "#2f6fed" : "#444"} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <FilterButton
              testID="history-filter"
              isActive={isFilterActive}
              onReset={handleResetFilters}
              onApply={() => setKeyword(keywordDraftRef.current)}
            >
              <FilterSection title="キーワード(予定のタイトル)">
                <KeywordFilterField
                  key={keywordFieldResetCount}
                  testID="history-keyword-input"
                  appliedValue={keyword}
                  onDraftChange={(value) => {
                    keywordDraftRef.current = value;
                  }}
                />
              </FilterSection>
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
              <FilterSection title="タグ(複数選択時は全て含む予定のみ表示)">
                <TouchableOpacity
                  testID="history-tag-filter-all"
                  onPress={handleSelectAllTags}
                  style={[
                    styles.filterChip,
                    !isUntaggedSelected && selectedTagIds.length === 0 && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={
                      !isUntaggedSelected && selectedTagIds.length === 0
                        ? styles.filterChipTextActive
                        : styles.filterChipText
                    }
                  >
                    すべて
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="history-tag-filter-untagged"
                  onPress={handleSelectUntagged}
                  style={[styles.filterChip, isUntaggedSelected && styles.filterChipActive]}
                >
                  <Text style={isUntaggedSelected ? styles.filterChipTextActive : styles.filterChipText}>
                    未設定
                  </Text>
                </TouchableOpacity>
                <TagPickerRow
                  testIDPrefix="history-tag-filter"
                  tagTree={tagTree}
                  selectedTagIds={selectedTagIds}
                  onToggle={handleToggleTagFilter}
                  hideLabel
                />
              </FilterSection>
              <FilterSection title="期間">
                <DateRangeFilterSection
                  testIDPrefix="history-period"
                  startDate={periodStart}
                  endDate={periodEnd}
                  onChange={({ startDate, endDate }) => {
                    setPeriodStart(startDate);
                    setPeriodEnd(endDate);
                  }}
                />
              </FilterSection>
            </FilterButton>
          ),
        }}
      />

      {bulk.isActive ? (
        <BulkTagAssignPanel
          testIDPrefix="history-bulk-tag"
          tagTree={tagTree}
          mode={bulk.mode}
          selectedTagIds={bulk.selectedTagIds}
          onToggleTag={bulk.toggleTag}
          onSwitchToRemoveMode={bulk.switchToRemoveMode}
          onSwitchToAssignMode={bulk.switchToAssignMode}
        />
      ) : null}

      {isLoadingEventsByTag ? (
        <View style={styles.emptyState}>
          <Text>読み込み中…</Text>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text>該当する予定がありません</Text>
        </View>
      ) : (
        <FlatList
          testID="history-timeline"
          data={timelineGroups}
          keyExtractor={(group) => group.yearMonth}
          contentContainerStyle={styles.timelineContent}
          onLayout={timelineBanners.onViewportLayout}
          // 広告は、月のまとまりの間(N か月目の直後)に入れる。
          ItemSeparatorComponent={({ leadingItem }) => {
            const index = timelineGroups.indexOf(leadingItem);
            return timelineBanners.afterIndexes.has(index) ? (
              <AdBanner testID={`history-timeline-ad-${index}`} variant="banner" spacing={8} />
            ) : null;
          }}
          renderItem={({ item: group, index: groupIndex }) => (
            <View
              testID={`history-month-group-${group.yearMonth}`}
              onLayout={timelineBanners.onItemLayout(groupIndex)}
            >
              <Text style={styles.monthHeader}>{group.label}</Text>
              {group.events.map((event, index) => {
                const tags = sortTagsHierarchically(tagsByEventId[event.id] ?? [], allTagsFlat);
                const hasPhotos = eventIdsWithPhotos.has(event.id);
                const isLastInGroup = index === group.events.length - 1;

                return (
                  <TouchableOpacity
                    key={event.id}
                    testID={`history-event-${event.id}`}
                    style={styles.timelineRow}
                    onPress={() => handleEventRowPress(event.id)}
                  >
                    {bulk.isActive ? (
                      <SelectionCircle
                        testID={`history-event-select-${event.id}`}
                        isSelected={bulk.selectedEventIds.includes(event.id)}
                        onPress={() => bulk.toggleEvent(event.id)}
                      />
                    ) : (
                      <View style={styles.timelineRail}>
                        <View style={styles.timelineDot} />
                        {isLastInGroup ? null : <View style={styles.timelineLine} />}
                      </View>
                    )}
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
                        {tags.length > 0 ? (
                          <EventTagBadges tags={tags} fallbackColor={calendarColorById[event.calendarId]} />
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        />
      )}

      {bulk.isActive ? (
        <BulkSelectionActionBar
          testIDPrefix="history-bulk-tag"
          mode={bulk.mode}
          selectedEventCount={bulk.selectedEventIds.length}
          selectedTagNames={selectedTagNames}
          onClearSelection={bulk.clearSelectedEvents}
          onConfirm={handleConfirmBulkAction}
        />
      ) : null}

      {bulk.isActive ? null : (
        <TouchableOpacity
          testID="history-add-event-fab"
          style={styles.fab}
          onPress={() => setIsCreateEventModalVisible(true)}
        >
          <Icon name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      <EventCreateModal
        visible={isCreateEventModalVisible}
        onClose={() => setIsCreateEventModalVisible(false)}
        onCreated={() => {
          refetchEventsByTag();
          refetchEventTags();
        }}
        calendars={calendars}
        defaultCalendarId={activeCalendarIds[0] ?? ""}
        tagTree={tagTree}
        initialDateKey={todayJstDateKey()}
      />

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

  const { tagTree } = useTagTree();
  // 年表タブと同じ「複数選択時はAND条件、未設定は排他」のタグ絞り込み。
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isUntaggedSelected, setIsUntaggedSelected] = useState(false);

  const handleSelectAllTags = () => {
    setSelectedTagIds([]);
    setIsUntaggedSelected(false);
  };
  const handleSelectUntagged = () => {
    setSelectedTagIds([]);
    setIsUntaggedSelected(true);
  };
  const handleToggleTagFilter = (tagId: string) => {
    setIsUntaggedSelected(false);
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const isFilterActive =
    selectedCalendarIds !== null || isFilteringByMonth || selectedTagIds.length > 0 || isUntaggedSelected;
  const handleResetFilter = useCallback(() => {
    setSelectedCalendarIds(null);
    setFilterYear(null);
    setFilterMonth(null);
    setSelectedTagIds([]);
    setIsUntaggedSelected(false);
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

  const {
    entries: memoriesEntries,
    isLoading: isLoadingMemories,
    refetch: refetchMemories,
  } = useMemoriesTimeline(activeCalendarIds, memoriesFilter);
  // カレンダー画面など他の画面で写真を追加/削除してこのタブに戻ってきても
  // 反映されない不具合の修正 - イベントID一覧が変わらない限り自動では
  // 取り直されないため、フォーカスのたびに明示的に取り直す(タグの
  // refetchEventTagsと同じ理由・同じ形)。
  useFocusEffect(
    useCallback(() => {
      refetchMemories();
    }, [refetchMemories])
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const memoriesEntryIds = useMemo(() => memoriesEntries.map((entry) => entry.id), [memoriesEntries]);
  const { tagsByEventId, refetch: refetchEventTags } = useEventTagsByEvents(memoriesEntryIds);
  useFocusEffect(
    useCallback(() => {
      refetchEventTags();
    }, [refetchEventTags])
  );
  const entries = useMemo(() => {
    if (isUntaggedSelected) {
      return memoriesEntries.filter((entry) => (tagsByEventId[entry.id] ?? []).length === 0);
    }
    if (selectedTagIds.length > 0) {
      return memoriesEntries.filter((entry) => {
        const entryTagIds = new Set((tagsByEventId[entry.id] ?? []).map((tag) => tag.id));
        return selectedTagIds.every((tagId) => entryTagIds.has(tagId));
      });
    }
    return memoriesEntries;
  }, [memoriesEntries, isUntaggedSelected, selectedTagIds, tagsByEventId]);

  const monthGroups = useMemo(() => groupMemoriesByYearMonth(entries), [entries]);
  // 画像の一覧の広告: 10行ごと(月をまたいで数える)に、大きめの広告を写真の間に入れる。
  const photoAdPositions = useMemo(
    () => photoAdAfterCardIndexes(monthGroups.map((group) => ({ key: group.yearMonth, cardCount: group.entries.length }))),
    [monthGroups]
  );
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
              <FilterSection title="タグ(複数選択時は全て含む予定のみ表示)">
                <TouchableOpacity
                  testID="memories-tag-filter-all"
                  onPress={handleSelectAllTags}
                  style={[
                    styles.filterChip,
                    !isUntaggedSelected && selectedTagIds.length === 0 && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={
                      !isUntaggedSelected && selectedTagIds.length === 0
                        ? styles.filterChipTextActive
                        : styles.filterChipText
                    }
                  >
                    すべて
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="memories-tag-filter-untagged"
                  onPress={handleSelectUntagged}
                  style={[styles.filterChip, isUntaggedSelected && styles.filterChipActive]}
                >
                  <Text style={isUntaggedSelected ? styles.filterChipTextActive : styles.filterChipText}>
                    未設定
                  </Text>
                </TouchableOpacity>
                <TagPickerRow
                  testIDPrefix="memories-tag-filter"
                  tagTree={tagTree}
                  selectedTagIds={selectedTagIds}
                  onToggle={handleToggleTagFilter}
                  hideLabel
                />
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

      {isLoadingMemories ? (
        <View style={styles.emptyState}>
          <Text>読み込み中…</Text>
        </View>
      ) : entries.length === 0 ? (
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
                {group.entries.map((entry, entryIndex) => (
                  <Fragment key={entry.id}>
                  <TouchableOpacity
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
                  {photoAdPositions.get(group.yearMonth)?.has(entryIndex) ? (
                    <View style={styles.photoGridAd}>
                      <AdBanner testID={`memories-ad-after-${entry.id}`} variant="rectangle" />
                    </View>
                  ) : null}
                  </Fragment>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <EventDetailModal
        eventId={selectedEventId}
        onClose={() => {
          setSelectedEventId(null);
          refetchEventTags();
          refetchMemories();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafbfc",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2f6fed",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  headerTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  // カレンダー選択チップ(CalendarSwitchChip)・タグ選択チップ(TagPickerRow)と
  // 同じ大きさ・角丸に揃える(選択時はborder 1→2の分だけpaddingを1px減らす)。
  filterChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 13,
    paddingVertical: 9,
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
  // 写真の並びの途中に入れる広告。幅いっぱいで、自分の行を使う。
  photoGridAd: {
    width: "100%",
    alignItems: "center",
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
