import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Tabs, router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useMyCalendars } from "../../src/features/calendars/hooks";
import { CalendarLabel } from "../../src/features/calendars/components/CalendarLabel";
import { CalendarSwitchChip } from "../../src/features/calendars/components/CalendarSwitchChip";
import { EventFormFields, type EventFormValue } from "../../src/features/events/components/EventFormFields";
import { computeDateKeyRange } from "../../src/features/events/dateRange";
import { buildEventColorLegend } from "../../src/features/events/eventColorLegend";
import { expandEventDateKeys } from "../../src/features/events/eventDateKeys";
import { formatDayHeaderLabel } from "../../src/features/events/formatDayHeaderLabel";
import {
  useCreateDefaultEventReminders,
  useCreateEvent,
  useEventsInRangeForCalendars,
} from "../../src/features/events/hooks";
import { isJapaneseHoliday } from "../../src/features/events/japaneseHolidays";
import { buildMonthGrid } from "../../src/features/events/monthGrid";
import { buildMonthEventGroups } from "../../src/features/events/monthEventList";
import { resolveMonthSwipeDirection } from "../../src/features/events/monthSwipe";
import { getEventErrorMessageJa } from "../../src/features/events/service";
import type { Event } from "../../src/features/events/types";
import { SettingsHubModal } from "../../src/features/calendars/components/SettingsHubModal";
import { TagPickerRow } from "../../src/features/tags/components/TagPickerRow";
import { useAttachTagsToEvent, useEventTagsByEvents, useTagTree } from "../../src/features/tags/hooks";
import { useCreateTodo } from "../../src/features/todos/hooks";
import { FilterButton, FilterSection } from "../../src/shared/components/FilterButton";
import { Icon } from "../../src/shared/components/Icon";
import { PersonalOnlyBadge } from "../../src/shared/components/PersonalOnlyBadge";
import { formatTime, jstNow } from "../../src/shared/utils/formatDateTime";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const MAX_DOTS_PER_CELL = 3;

// focusedDate/"today" represent a CALENDAR DAY, not an absolute instant - by
// convention here their UTC-* accessors are read as if they were the
// intended (JST) day's own components, so "now" must be JST-shifted before
// seeding them (see jstNow) to keep "today" correct right around UTC
// midnight (9am JST). expandEventDateKeys handles the separate job of
// mapping a real event timestamp to its JST day.
function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function todayDateKey(): string {
  return toDateKey(jstNow().toISOString());
}

function formatMonthLabel(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
}

// タグが付いていればタグの色、無ければ予定が属するカレンダーのデフォルト色
// を使う(予定ごとの色は選ばせず、この2段階だけで自動的に決まる - 2026-09)。
function resolveEventColor(
  event: Pick<Event, "calendarId"> & { tagColor?: string | null },
  calendarColorById: Record<string, string>
): string {
  return event.tagColor ?? calendarColorById[event.calendarId] ?? "#999999";
}

export default function CalendarScreen() {
  const { date: dateParam, calendarId: calendarIdParam } = useLocalSearchParams<{
    date?: string;
    calendarId?: string;
  }>();

  const { session } = useAuthSession();
  const { calendars, refetch: refetchCalendars } = useMyCalendars();
  // null means "no explicit selection yet" - defaults to ALL calendars, so
  // every calendar is selected when the app first opens. Tapping a chip
  // always toggles that one calendar's own membership in the set (see
  // handleToggleCalendar), starting from that all-selected default on the
  // very first tap.
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string> | null>(null);

  const activeCalendarIds =
    selectedCalendarIds !== null
      ? Array.from(selectedCalendarIds)
      : calendars.map((calendar) => calendar.id);
  // The "primary" selected calendar - used wherever a single target calendar
  // is needed (new-event default, invite target), even while several are
  // selected for the overlay view.
  const activeCalendarId = activeCalendarIds[0] ?? "";
  const activeCalendar = calendars.find((calendar) => calendar.id === activeCalendarId) ?? null;

  const [focusedDate, setFocusedDate] = useState(() => jstNow());
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayDateKey());

  // グリッド(月間カレンダー)と一覧(その月の予定を網羅的にリスト表示)の
  // 切り替え。振り返り/献立タブと同じ「上部メニューで切り替える」パターン。
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // 月ラベルをタップして開く年月ピッカー。pickerYearはfocusedDateの年から
  // 独立させ、ピッカー内で年だけ先に動かしても(月を選ぶまで)実際の表示月
  // には影響しないようにしている。
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => focusedDate.getUTCFullYear());

  const openMonthPicker = () => {
    setPickerYear(focusedDate.getUTCFullYear());
    setIsMonthPickerVisible(true);
  };

  const handlePickMonth = (month: number) => {
    setFocusedDate(new Date(Date.UTC(pickerYear, month - 1, 1)));
    setIsMonthPickerVisible(false);
  };

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

  // Jumps the calendar to a specific date/calendar when navigated here with
  // ?date=&calendarId= (e.g. "カレンダーへ" from a ToDo's event section).
  useEffect(() => {
    if (calendarIdParam) {
      setSelectedCalendarIds(new Set([calendarIdParam]));
    }
  }, [calendarIdParam]);

  useEffect(() => {
    if (!dateParam) return;
    const parsed = new Date(`${dateParam}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return;
    setFocusedDate(parsed);
  }, [dateParam]);

  // Keeps the selected day in sync with whichever month is focused, whenever
  // focusedDate itself changes (month nav, "today", or the ?date= jump
  // above) - selecting a specific day within the CURRENT month (grid cell
  // taps) goes through setSelectedDateKey directly and doesn't touch
  // focusedDate, so it isn't affected by this.
  useEffect(() => {
    setSelectedDateKey(toDateKey(focusedDate.toISOString()));
  }, [focusedDate]);

  const monthGrid = useMemo(() => buildMonthGrid(focusedDate), [focusedDate]);
  // The grid shows a few leading/trailing days from the adjacent months to
  // pad out full weeks, so the query range must span the whole padded grid
  // (not just the focused calendar month) or events on those visible days
  // silently fail to show up.
  const range = useMemo(() => {
    const firstWeek = monthGrid[0];
    const lastWeek = monthGrid[monthGrid.length - 1];
    return computeDateKeyRange(firstWeek[0].dateKey, lastWeek[lastWeek.length - 1].dateKey);
  }, [monthGrid]);
  const { events, refetch: refetchEvents } = useEventsInRangeForCalendars(activeCalendarIds, range);
  const { createEvent, error: createEventError } = useCreateEvent();
  const { createDefaultEventReminders } = useCreateDefaultEventReminders();
  const { createTodo } = useCreateTodo();

  // 個人カレンダーの予定であることを、色とは別の要素(🔒)で見分けられるように
  // する。IDのSetにしておき、予定1件ごとにO(1)で判定できるようにしている。
  const personalCalendarIds = useMemo(
    () => new Set(calendars.filter((calendar) => calendar.kind === "personal").map((calendar) => calendar.id)),
    [calendars]
  );

  // 「一覧」表示用 - パディング分(前後月の数日)を含まない、実際にその月に
  // 属する日だけを対象にする。
  const monthEventGroups = useMemo(
    () => buildMonthEventGroups(events, focusedDate.getUTCFullYear(), focusedDate.getUTCMonth() + 1),
    [events, focusedDate]
  );

  // resolveEventColor/buildEventColorLegend が「タグなし予定の色」を引く
  // ためのカレンダーID→色マップ。
  const calendarColorById = useMemo(
    () => Object.fromEntries(calendars.map((calendar) => [calendar.id, calendar.color])),
    [calendars]
  );

  // 色の凡例(タグ名/カレンダー名)用。表示中の予定に付いているタグの実名が
  // 要るので、色だけ持つevent.tagColorとは別にタグ本体を引く。
  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const { tagsByEventId } = useEventTagsByEvents(eventIds);
  const colorLegend = useMemo(
    () => buildEventColorLegend(events, tagsByEventId, calendars),
    [events, tagsByEventId, calendars]
  );

  // null = 閉じている。渡す値で「設定ハブをどこから開くか」を切り替える
  // - ⚙ボタンは通常通りハブ(一覧)から、後述の「共有カレンダーを作る」
  // バナーはカレンダー設定の作成フォームへ直接ジャンプする(2026-09)。
  const [settingsModalRequest, setSettingsModalRequest] = useState<{
    initialSection?: "calendar";
    initialCalendarMode?: "create";
  } | null>(null);
  // 個人用カレンダーしか無い(=まだ共有カレンダーを作っていない)ユーザー
  // 向けに、カレンダータブ内で気づける案内バナーを出す。calendars.length
  // === 0は個人用カレンダーがサインアップ時に自動作成されるため実質発生
  // しない条件だったので、代わりにこちらを使う(2026-09)。
  const hasSharedCalendar = calendars.some((calendar) => calendar.kind !== "personal");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [isDayEventsModalVisible, setIsDayEventsModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  // Which calendar the event-being-created will belong to - defaults to the
  // active tab (see openCreateModal) but is independently selectable, since
  // an event's calendar no longer has to match whichever tab is focused.
  const [newEventCalendarId, setNewEventCalendarId] = useState("");
  const newEventCalendarKind = calendars.find((calendar) => calendar.id === newEventCalendarId)?.kind;
  const { tagTree, refetch: refetchTagTree } = useTagTree();
  const { attachTagsToEvent } = useAttachTagsToEvent();
  const [newEventForm, setNewEventForm] = useState<EventFormValue>(() => ({
    title: "",
    isAllDay: true,
    start: new Date(),
    end: new Date(),
    location: "",
    url: "",
  }));
  const [hasTodos, setHasTodos] = useState(false);
  const [todoItems, setTodoItems] = useState<string[]>([]);
  const [newTodoItemText, setNewTodoItemText] = useState("");

  // Relying on nested flex:1 alone to size the grid turned out unreliable in
  // practice (the grid could end up far shorter than the space actually
  // available, or spill past the screen on a 6-week month) - the root
  // <View>'s own bounded height is trustworthy, but flex distribution
  // through several intermediate levels was not. So instead we measure the
  // real rendered height of everything ABOVE and BELOW the grid (both
  // naturally-sized content, which onLayout always reports correctly) and
  // compute the grid's height ourselves as the remainder, applying it as an
  // explicit height rather than hoping flex:1 fills it correctly.
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [aboveGridHeight, setAboveGridHeight] = useState<number | null>(null);
  const [belowGridHeight, setBelowGridHeight] = useState<number | null>(null);

  const gridContainerHeight =
    containerHeight !== null && aboveGridHeight !== null && belowGridHeight !== null
      ? Math.max(200, containerHeight - aboveGridHeight - belowGridHeight)
      : null;

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

  const handleToday = () => {
    setFocusedDate(jstNow());
  };

  const handleSelectDateCell = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setIsDayEventsModalVisible(true);
  };

  // The swipe gesture's PanResponder is created once (see monthSwipeResponder
  // below) and keeps calling whatever shiftFocusedDate closure existed at
  // that first render. That's fine as long as shiftFocusedDate never reads
  // `focusedDate` directly from its own render's closure (which would be
  // stale) - so it computes the next month from React's functional setState
  // form instead, which always receives the truly-current state no matter
  // which render's closure ends up calling it or how many updates are
  // already queued.
  const shiftFocusedDate = (direction: 1 | -1) => {
    setFocusedDate((previousFocusedDate) => {
      const next = new Date(previousFocusedDate);
      next.setUTCMonth(next.getUTCMonth() + direction);
      return next;
    });
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
    });
    setHasTodos(false);
    setTodoItems([]);
    setNewTodoItemText("");
    setSelectedTagIds([]);
    setNewEventCalendarId(activeCalendarId);
    setIsCreateModalVisible(true);
  };

  const handleSelectEventCalendar = (calendarId: string) => {
    setNewEventCalendarId(calendarId);
    // The previously selected tags belong to the OLD calendar and won't
    // exist in the new one's tag tree, so clear them.
    setSelectedTagIds([]);
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

  const handleCreateEvent = async () => {
    const createdEvent = await createEvent({
      calendarId: newEventCalendarId || activeCalendarId,
      title: newEventForm.title,
      startAt: newEventForm.start.toISOString(),
      endAt: newEventForm.end.toISOString(),
      isAllDay: newEventForm.isAllDay,
      location: newEventForm.location || undefined,
      url: newEventForm.url || undefined,
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
      // 自分の意思でリマインドを設定しなくても最低限通知が届くよう、
      // 作成直後に既定のリマインド(終日: 当日+1日前 / 時刻指定: 10分前)を設定する。
      await createDefaultEventReminders(createdEvent.id, newEventForm.isAllDay);
      setIsCreateModalVisible(false);
      await refetchEvents();
    }
  };

  const isFilterActive = selectedCalendarIds !== null;
  const handleResetFilter = useCallback(() => {
    setSelectedCalendarIds(null);
  }, []);

  // タブに戻るたびに予定を取り直す - 予定詳細画面で削除/編集した直後に
  // このタブへ戻ってきても、消したはずの予定がグリッド/一覧/日別モーダルに
  // 残り続けて見える(実際には削除済みなのに紛らわしい)、という問題への
  // 対策(2026-09)。ToDoタブの「フォーカスで取り直す」と同じ考え方。
  // refetchEventsは月送りやカレンダー絞り込みが変わるたびに自身の
  // identityも変わる(依存先のuseEventsInRangeForCalendars参照)ため、この
  // effectはそのたびにも再実行されるが、無駄なリクエストが1回増えるだけで
  // 実害はない(ToDoタブの同種のrefetchも同じ性質を持つ)。
  useFocusEffect(
    useCallback(() => {
      refetchEvents();
    }, [refetchEvents])
  );

  // タブを離れるたびに絞り込みをリセットする(共通フィルターの決まり - 戻って
  // きたときは常にまっさらな状態から絞り込み直せるようにする)。上のrefetch
  // effectとは別のuseFocusEffectに分けること - 1つにまとめると、絞り込み
  // 変更のたびにrefetchEventsの依存(range/activeCalendarIds)経由でこの
  // effectごと再生成され、直前の実行のクリーンアップ(=フィルターのリセット)
  // が即座に走ってしまい、絞り込みが効かないように見える不具合が起きる
  // (ToDoタブの`useTodosByCalendars`まわりで実際に踏んだ問題と同じ)。
  useFocusEffect(
    useCallback(() => {
      return handleResetFilter;
    }, [handleResetFilter])
  );

  const headerOptions = useMemo(
    () => ({
      headerLeft: () => (
        <TouchableOpacity
          testID="calendar-settings-button"
          onPress={() => setSettingsModalRequest({})}
          style={styles.headerTagButton}
        >
          <Icon name="gear" size={18} color="#2f6fed" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <FilterButton testID="calendar-filter" isActive={isFilterActive} onReset={handleResetFilter}>
          <FilterSection title="カレンダー">
            {calendars.map((calendar) => (
              <CalendarSwitchChip
                key={calendar.id}
                testID={`calendar-switch-${calendar.id}`}
                calendar={calendar}
                isActive={activeCalendarIds.includes(calendar.id)}
                onPress={() => handleToggleCalendar(calendar.id)}
              />
            ))}
          </FilterSection>
          {colorLegend.length > 0 ? (
            <FilterSection title="色の凡例">
              <View testID="calendar-color-legend" style={styles.colorLegendRow}>
                {colorLegend.map((entry) => (
                  <View key={entry.color} testID={`calendar-color-legend-${entry.color}`} style={styles.colorLegendItem}>
                    <View style={[styles.colorLegendSwatch, { backgroundColor: entry.color }]} />
                    <Text style={styles.colorLegendLabel}>{entry.label}</Text>
                  </View>
                ))}
              </View>
            </FilterSection>
          ) : null}
        </FilterButton>
      ),
    }),
    [calendars, activeCalendarIds, isFilterActive, handleResetFilter, colorLegend]
  );

  // 個人用/共有どちらの枠にも同じToDoチェックリストUIを出すので、1度だけ
  // 組み立てておく(予定詳細画面のセクション変数と同じ考え方)。
  // 「+ 場所を追加」「+ URLを追加」(RevealableTextField)と同じ、タップで
  // 追加項目が現れるボタンの見た目に揃える(2026-09見直し - 元は「ToDoを
  // 追加する」というスイッチ付きの行で、同じ「追加」操作なのに場所/URLと
  // 表示が違っていた)。一度タップして現れたら、場所/URLと同様その場では
  // 引っ込めない。
  const todoSection = hasTodos ? (
    <View style={styles.todoChecklist}>
      {todoItems.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.todoChecklistRow} testID={`event-create-todo-item-${index}`}>
          <Text style={styles.todoChecklistText}>{item}</Text>
          <TouchableOpacity
            testID={`event-create-todo-item-${index}-remove`}
            onPress={() => handleRemoveTodoItem(index)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="trash" size={16} color="#d32f2f" />
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
  ) : (
    <TouchableOpacity
      testID="event-create-has-todos-toggle"
      style={styles.addFieldButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      onPress={() => setHasTodos(true)}
    >
      <Icon name="plus" size={12} color="#2f6fed" />
      <Text style={styles.addFieldButtonText}>ToDoを追加</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Tabs.Screen options={headerOptions} />
      <View
        testID="calendar-container"
        style={styles.container}
        onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
      >
      <View
        testID="calendar-above-grid"
        onLayout={(event) => setAboveGridHeight(event.nativeEvent.layout.height)}
      >
      {!hasSharedCalendar ? (
        <TouchableOpacity
          testID="calendar-share-banner"
          style={styles.shareBanner}
          onPress={() => setSettingsModalRequest({ initialSection: "calendar", initialCalendarMode: "create" })}
        >
          <Icon name="calendar" size={18} color="#2f6fed" />
          <View style={styles.shareBannerTextGroup}>
            <Text style={styles.shareBannerTitle}>家族や友人と予定を共有できます</Text>
            <Text style={styles.shareBannerAction}>共有カレンダーを作る ›</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <View style={styles.monthHeaderRow}>
        <View style={styles.monthHeaderSide} testID="calendar-view-mode-switch">
          <TouchableOpacity
            testID="calendar-view-mode-grid"
            style={[styles.viewModeButton, viewMode === "grid" && styles.viewModeButtonActive]}
            onPress={() => setViewMode("grid")}
          >
            <Icon name="grid" size={15} color={viewMode === "grid" ? "#fff" : "#666"} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="calendar-view-mode-list"
            style={[styles.viewModeButton, viewMode === "list" && styles.viewModeButtonActive]}
            onPress={() => setViewMode("list")}
          >
            <Icon name="list" size={15} color={viewMode === "list" ? "#fff" : "#666"} />
          </TouchableOpacity>
        </View>

        {/* 行全体にposition:absoluteで重ねて中央寄せすることで、左右ブロックの
            内容量に関わらず月ラベルを行の水平中央に固定している(詳細は
            ui.mdの「月ラベルの中央揃え」)。pointerEvents="box-none"が無いと、
            このオーバーレイ自身が行全体の透明部分でもタップを吸ってしまい、
            背後にある左右のボタン(表示切替アイコン・今日ボタン)が反応しなく
            なる - 自分の子(‹/月ラベル/›)だけをタップ対象にし、それ以外の
            透明な部分は下のビューへタップを通す。 */}
        <View style={styles.monthNavGroup} pointerEvents="box-none">
          <TouchableOpacity testID="calendar-month-prev" onPress={() => shiftFocusedDate(-1)} style={styles.monthNavButton}>
            <Text style={styles.monthNavText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="calendar-month-label" onPress={openMonthPicker}>
            <Text style={styles.monthLabel}>{formatMonthLabel(focusedDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="calendar-month-next" onPress={() => shiftFocusedDate(1)} style={styles.monthNavButton}>
            <Text style={styles.monthNavText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.monthHeaderSide, styles.monthHeaderSideRight]}>
          <TouchableOpacity testID="calendar-today-button" onPress={handleToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>今日</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>

      {settingsModalRequest !== null ? (
        <SettingsHubModal
          calendars={calendars}
          currentUserId={session?.user.id}
          onClose={() => setSettingsModalRequest(null)}
          onChange={() => {
            refetchCalendars();
            refetchTagTree();
          }}
          initialSection={settingsModalRequest.initialSection}
          initialCalendarMode={settingsModalRequest.initialCalendarMode}
        />
      ) : null}

      {viewMode === "grid" ? (
        <View
          style={[
            styles.gridContainer,
            gridContainerHeight !== null ? { height: gridContainerHeight, flex: 0 } : { flex: 1 },
          ]}
          testID="calendar-grid-container"
          {...monthSwipeResponder.panHandlers}
        >
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
          <View testID="calendar-weeks-area" style={styles.weeksArea}>
            {monthGrid.map((week, weekIndex) => (
              <View key={weekIndex} testID={`calendar-grid-row-${weekIndex}`} style={styles.gridRow}>
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
                            style={[styles.gridEventBar, { backgroundColor: resolveEventColor(event, calendarColorById) }]}
                          >
                            {personalCalendarIds.has(event.calendarId) ? (
                              <Icon
                                testID={`calendar-grid-dot-personal-${event.id}`}
                                name="lock"
                                size={7}
                                color="#fff"
                                style={styles.gridEventBarLockIcon}
                              />
                            ) : null}
                            <Text style={styles.gridEventBarText} numberOfLines={1} ellipsizeMode="clip">
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
      ) : (
        <View style={styles.monthListContainer} testID="calendar-month-list-container" {...monthSwipeResponder.panHandlers}>
          {monthEventGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>この月に予定はありません</Text>
            </View>
          ) : (
            <FlatList
              testID="calendar-month-list"
              data={monthEventGroups}
              keyExtractor={(group) => group.dateKey}
              contentContainerStyle={styles.monthListContent}
              renderItem={({ item: group }) => (
                <View testID={`calendar-month-list-date-group-${group.dateKey}`}>
                  <Text style={styles.monthListDateHeader}>{group.label}</Text>
                  {group.events.map((event) => (
                    <TouchableOpacity
                      key={event.id}
                      testID={`calendar-list-event-${event.id}`}
                      style={styles.eventRow}
                      onPress={() => router.push(`/event/${event.id}`)}
                    >
                      <View style={[styles.categoryDot, { backgroundColor: resolveEventColor(event, calendarColorById) }]} />
                      {personalCalendarIds.has(event.calendarId) ? (
                        <Icon
                          testID={`calendar-list-event-personal-${event.id}`}
                          name="lock"
                          size={12}
                          color="#666"
                        />
                      ) : null}
                      <Text style={styles.eventTime}>
                        {event.isAllDay ? "終日" : `${formatTime(event.startAt)}〜${formatTime(event.endAt)}`}
                      </Text>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          )}
        </View>
      )}

      <Modal
        visible={isMonthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMonthPickerVisible(false)}
      >
        <TouchableOpacity
          testID="calendar-month-picker-backdrop"
          style={styles.dayModalOverlay}
          activeOpacity={1}
          onPress={() => setIsMonthPickerVisible(false)}
        >
          <TouchableOpacity
            testID="calendar-month-picker-card"
            activeOpacity={1}
            onPress={() => {}}
            style={styles.monthPickerCard}
          >
            <View style={styles.monthPickerYearRow}>
              <TouchableOpacity
                testID="calendar-year-picker-prev"
                onPress={() => setPickerYear((year) => year - 1)}
                style={styles.monthNavButton}
              >
                <Text style={styles.monthNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthPickerYearLabel} testID="calendar-year-picker-label">
                {pickerYear}年
              </Text>
              <TouchableOpacity
                testID="calendar-year-picker-next"
                onPress={() => setPickerYear((year) => year + 1)}
                style={styles.monthNavButton}
              >
                <Text style={styles.monthNavText}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthPickerGrid}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const isCurrentFocused =
                  pickerYear === focusedDate.getUTCFullYear() && month === focusedDate.getUTCMonth() + 1;
                return (
                  <TouchableOpacity
                    key={month}
                    testID={`calendar-year-picker-month-${month}`}
                    style={[styles.monthPickerCell, isCurrentFocused && styles.monthPickerCellActive]}
                    onPress={() => handlePickMonth(month)}
                  >
                    <Text style={isCurrentFocused ? styles.monthPickerCellTextActive : styles.monthPickerCellText}>
                      {month}月
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isDayEventsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDayEventsModalVisible(false)}
      >
        <TouchableOpacity
          testID="calendar-day-modal-backdrop"
          style={styles.dayModalOverlay}
          activeOpacity={1}
          onPress={() => setIsDayEventsModalVisible(false)}
        >
          <TouchableOpacity
            testID="calendar-day-modal-card"
            activeOpacity={1}
            onPress={() => {}}
            style={styles.dayModalCard}
          >
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
                  <Icon name="plus" size={20} color="#2f6fed" />
                </TouchableOpacity>
                <TouchableOpacity
                  testID="calendar-day-modal-close"
                  onPress={() => setIsDayEventsModalVisible(false)}
                >
                  <Icon name="close" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {eventsForSelectedDate.length === 0 ? (
              <Text style={styles.dayModalEmptyText}>予定はありません</Text>
            ) : (
              <FlatList
                style={styles.dayModalEventList}
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
                    <View style={[styles.categoryDot, { backgroundColor: resolveEventColor(item, calendarColorById) }]} />
                    {personalCalendarIds.has(item.calendarId) ? (
                      <Icon testID={`calendar-event-personal-${item.id}`} name="lock" size={12} color="#666" />
                    ) : null}
                    <Text style={styles.eventTime}>
                      {item.isAllDay ? "終日" : `${formatTime(item.startAt)}〜${formatTime(item.endAt)}`}
                    </Text>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.photoCount > 0 || item.commentCount > 0 ? (
                      <View testID={`calendar-event-counts-${item.id}`} style={styles.eventCountsRow}>
                        {item.photoCount > 0 ? (
                          <View style={styles.eventCountBadge}>
                            <Icon name="photo" size={11} color="#999" />
                            <Text style={styles.eventCountText}>{item.photoCount}</Text>
                          </View>
                        ) : null}
                        {item.commentCount > 0 ? (
                          <View style={styles.eventCountBadge}>
                            <Icon name="comment" size={11} color="#999" />
                            <Text style={styles.eventCountText}>{item.commentCount}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Empty on purpose - calendar member management now lives entirely in
          SettingsHubModal (its calendar-edit screen). This stays as a
          zero-height measurement point so the grid-height calc above (which
          needs a real "space below the grid" number) keeps working. */}
      <View
        testID="calendar-below-grid"
        onLayout={(event) => setBelowGridHeight(event.nativeEvent.layout.height)}
      />

      <TouchableOpacity testID="calendar-add-event-fab" style={styles.fab} onPress={openCreateModal}>
        <Icon name="plus" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            testID="event-create-backdrop"
            style={styles.modalBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIsCreateModalVisible(false)}
          >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>予定を作成</Text>

            <View style={styles.eventCalendarPickerRow}>
              {calendars.map((calendar) => (
                <TouchableOpacity
                  key={calendar.id}
                  testID={`event-create-calendar-${calendar.id}`}
                  style={[
                    styles.eventCalendarChip,
                    calendar.id === newEventCalendarId && styles.eventCalendarChipSelected,
                  ]}
                  onPress={() => handleSelectEventCalendar(calendar.id)}
                >
                  <CalendarLabel
                    calendar={calendar}
                    textStyle={
                      calendar.id === newEventCalendarId
                        ? styles.eventCalendarChipTextSelected
                        : styles.eventCalendarChipText
                    }
                  />
                </TouchableOpacity>
              ))}
            </View>

            {newEventCalendarKind === "personal" ? (
              // 個人用カレンダーには共有相手がいないので、予定情報もタグ・
              // ToDoもまとめて1つのグレーの個人用枠に入れる(予定詳細画面と
              // 同じ考え方 - 2026-09追加)。
              <View style={styles.personalFrame} testID="event-create-personal-frame">
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
                {todoSection}
              </View>
            ) : (
              // 共有カレンダー向けの予定作成では、メンバー全員に見える予定
              // 情報(青い共有枠)と、自分にしか効かないタグ・ToDo(グレーの
              // 個人用枠)を、予定詳細画面と同じ枠・背景色で塗り分ける。
              <>
                <View style={styles.sharedFrame} testID="event-create-shared-frame">
                  <Text testID="event-create-shared-label" style={styles.sharedFrameLabel}>
                    メンバーと共有
                  </Text>
                  <EventFormFields
                    testIDPrefix="event-create"
                    value={newEventForm}
                    onChange={(patch) => setNewEventForm((prev) => ({ ...prev, ...patch }))}
                  />
                </View>
                <View style={styles.personalFrame} testID="event-create-personal-frame">
                  <View testID="event-create-personal-group-label">
                    <PersonalOnlyBadge />
                  </View>
                  <TagPickerRow
                    testIDPrefix="event-create"
                    tagTree={tagTree}
                    selectedTagIds={selectedTagIds}
                    onToggle={handleToggleTagSelection}
                  />
                  {todoSection}
                </View>
              </>
            )}

            {createEventError ? (
              <Text style={styles.errorText}>{getEventErrorMessageJa(createEventError)}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="event-create-cancel"
                onPress={() => setIsCreateModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="event-create-submit" style={styles.createButton} onPress={handleCreateEvent}>
                <Text style={styles.createButtonText}>作成</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafbfc",
  },
  // 共有カレンダーを一つも持っていないユーザー向けの案内バナー(2026-09追加)。
  // calendars.length === 0(個人用カレンダーが無い状態)は実質発生しないので
  // 使っていた旧onboardingMessageは廃止し、代わりにこちらを使う。
  shareBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e8f0fe",
  },
  shareBannerTextGroup: {
    flex: 1,
    gap: 2,
  },
  shareBannerTitle: {
    fontSize: 13,
    color: "#444",
  },
  shareBannerAction: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2f6fed",
  },
  headerTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  monthHeaderRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  // 中央のYYYY年MM月を、左右のブロックの内容量に関係なく行の真ん中に
  // 確実に置くため、position:absoluteで行全体に重ねてから
  // justifyContent/alignItemsで中央寄せする(flex:1の左右2ブロックで余白を
  // 分け合わせるだけだと、片方の内容が僅かでも重いと中心がずれて見える
  // ことがあったための対策)。中身自体は左右のTouchableOpacityが並ぶだけの
  // 見た目なので、中身の外側(透明部分)は下のflex-startで並ぶ左右ブロックへ
  // のタップを妨げない。
  monthNavGroup: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  monthHeaderSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  monthHeaderSideRight: {
    justifyContent: "flex-end",
  },
  viewModeButton: {
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f3f5",
  },
  viewModeButtonActive: {
    backgroundColor: "#2f6fed",
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  todayButtonText: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 15,
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
  colorLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  colorLegendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorLegendLabel: {
    fontSize: 13,
    color: "#444",
  },
  monthListContainer: {
    flex: 1,
  },
  monthListContent: {
    paddingBottom: 24,
  },
  monthListDateHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    color: "#999",
  },
  monthPickerCard: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  monthPickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  monthPickerYearLabel: {
    fontSize: 18,
    fontWeight: "700",
    minWidth: 80,
    textAlign: "center",
  },
  monthPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  monthPickerCell: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f2f3f5",
  },
  monthPickerCellActive: {
    backgroundColor: "#2f6fed",
  },
  monthPickerCellText: {
    fontSize: 15,
    color: "#444",
  },
  monthPickerCellTextActive: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "700",
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
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  gridEventBarLockIcon: {
    marginRight: 1,
  },
  gridEventBarText: {
    flexShrink: 1,
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
  // 思い出(写真)・コメントが実際にある予定だけ、件数バッジで気づけるように
  // する(0件は省略 - 該当しない予定にまで並ぶとノイズになるため)。
  eventCountsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  eventCountText: {
    fontSize: 11,
    color: "#999",
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
  dayModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  dayModalCard: {
    // A definite height (not maxHeight) on purpose: the FlatList inside
    // has flex:1 to fill the remaining space below the header, and Yoga
    // can only resolve that against a parent with an actual resolved
    // size - maxHeight alone leaves the card "auto" (sized to content),
    // so the flex:1 list would get 0 height and silently show nothing.
    // A fixed height also matches the requested "固定枠" (fixed frame)
    // look, rather than a box that grows/shrinks with the event count.
    width: "85%",
    height: "70%",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 20,
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
  dayModalEmptyText: {
    color: "#999",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dayModalEventList: {
    flex: 1,
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
  // 予定詳細画面(EventDetailContent.tsx)と同じ色分け - メンバーと共有され
  // る予定情報は薄い青、自分にしか効かないタグ・ToDoは薄いグレー。
  sharedFrame: {
    backgroundColor: "#e8f0fe",
    borderWidth: 1,
    borderColor: "#c7dcfb",
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  sharedFrameLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0c447c",
  },
  personalFrame: {
    backgroundColor: "#f2f3f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  // 「+ 場所を追加」等(RevealableTextField)と揃えた、任意項目を追加する
  // ボタンの見た目。
  addFieldButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  addFieldButtonText: {
    color: "#2f6fed",
    fontSize: 13,
    fontWeight: "600",
  },
  errorText: {
    color: "#d32f2f",
  },
  eventCalendarPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  eventCalendarChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  eventCalendarChipSelected: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  eventCalendarChipText: {
    color: "#444",
  },
  eventCalendarChipTextSelected: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#fff",
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
  cancelText: {
    fontSize: 16,
    color: "#666",
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
