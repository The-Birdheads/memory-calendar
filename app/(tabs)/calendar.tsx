import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Tabs, router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useMyCalendars } from "../../src/features/calendars/hooks";
import { useMyProfile } from "../../src/features/profile/hooks";
import { CalendarSwitchChip } from "../../src/features/calendars/components/CalendarSwitchChip";
import { EventCreateModal } from "../../src/features/events/components/EventCreateModal";
import { computeDateKeyRange } from "../../src/features/events/dateRange";
import { buildEventColorLegend } from "../../src/features/events/eventColorLegend";
import { expandEventDateKeys } from "../../src/features/events/eventDateKeys";
import { formatDayHeaderLabel } from "../../src/features/events/formatDayHeaderLabel";
import { useEventsInRangeForCalendars } from "../../src/features/events/hooks";
import { isJapaneseHoliday } from "../../src/features/events/japaneseHolidays";
import { buildMonthGrid, type MonthGridCell, type WeekStartsOn } from "../../src/features/events/monthGrid";
import { buildMonthEventGroups } from "../../src/features/events/monthEventList";
import { buildMultiDayBanners, excludeBannerEvents, fillBannerGaps } from "../../src/features/events/multiDayBanners";
import { resolveMonthSwipeDirection } from "../../src/features/events/monthSwipe";
import type { Event, EventWithTagColor } from "../../src/features/events/types";
import { SettingsHubModal } from "../../src/features/calendars/components/SettingsHubModal";
import { AssigneeAvatars } from "../../src/features/assignees/components/AssigneeAvatars";
import { splitCellEvents } from "../../src/features/events/monthCellCapacity";
import { BulkSelectionActionBar } from "../../src/features/tags/components/BulkSelectionActionBar";
import { BulkTagAssignPanel } from "../../src/features/tags/components/BulkTagAssignPanel";
import { EventTagBadges } from "../../src/features/tags/components/EventTagBadges";
import { SelectionCircle } from "../../src/features/tags/components/SelectionCircle";
import { TagIcon } from "../../src/features/tags/components/TagIcon";
import {
  useAttachTagsToEvents,
  useBulkTagSelection,
  useEventTagsByEvents,
  useRemoveAllTagsFromEvents,
  useTagTree,
} from "../../src/features/tags/hooks";
import { flattenTagTree, sortTagsHierarchically } from "../../src/features/tags/tagTree";
import { FilterButton, FilterSection } from "../../src/shared/components/FilterButton";
import { Icon } from "../../src/shared/components/Icon";
import { hexToRgba } from "../../src/shared/utils/color";
import { formatTime, jstNow } from "../../src/shared/utils/formatDateTime";
import { normalizeUrl } from "../../src/shared/utils/url";

// index = 実際の曜日番号(0=日曜〜6=土曜、Date#getUTCDayと同じ基準)。週の開始
// 曜日設定に合わせてヘッダーの並び順を回転させても、土日の色分けなどは
// 引き続き実際の曜日番号で判定できるようにlabelとdayOfWeekを組で持つ。
const WEEKDAY_LABELS_BY_DAY = ["日", "月", "火", "水", "木", "金", "土"];

function getWeekdayHeaderCells(weekStartsOn: WeekStartsOn): { label: string; dayOfWeek: number }[] {
  return WEEKDAY_LABELS_BY_DAY.map((label, dayOfWeek) => ({ label, dayOfWeek })).map(
    (_, index, all) => all[(index + weekStartsOn) % 7]
  );
}

// gridContainerの左右paddingと同じ値(月グリッドの実際の表示幅を計算する
// のに使う - styles.gridContainerとこの定数の値は必ず揃える)。
const GRID_HORIZONTAL_PADDING = 8;

// 複数日予定のバー表示(TimeTree風)まわりの寸法。BANNER_AREA_TOPは
// gridCellの`paddingTop:4` + 日付バッジの高さ24 + `gap:2` の合計 - バーが
// 日付バッジの直下、通常のピル表示(gridEventList)と同じ高さから始まるように揃える。
const BANNER_AREA_TOP = 30;
const BANNER_ROW_HEIGHT = 14;
const BANNER_ROW_GAP = 2;
// 通常ピル(gridEventBar)は各セルのgridEventListが持つpaddingHorizontal:2の
// 分だけセルの左右端から内側に余白を取って表示される。バーはセルをまたいで
// 絶対配置するため、同じ見た目に揃うようこの余白を左右端にも適用する
// (2026-09修正 - 元はセル境界にぴったり合わせていたため、単日の予定の
// ピルより横に広がって見えるずれがあった)。
const GRID_CELL_PILL_INSET = 2;

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

// グリッドは前後月の数日を含めて週を埋めるので、予定の取得範囲もその
// パディング分を含む必要がある(そうしないと見えている日なのに予定が
// 表示されない)。
function rangeForGrid(grid: MonthGridCell[][]) {
  const firstWeek = grid[0];
  const lastWeek = grid[grid.length - 1];
  return computeDateKeyRange(firstWeek[0].dateKey, lastWeek[lastWeek.length - 1].dateKey);
}

// TimeTree風に、時間指定のある予定(終日でない)は背景を薄い半透明にして
// 文字をその予定の色にし、背景を予定の色で塗りつぶす終日の予定と見分けが
// つくようにする(2026-09)。
const TIMED_EVENT_BACKGROUND_ALPHA = 0.18;

// 場所・メモ・URLのサマリー行を、同じ行にある「終日」/時刻テキストの開始位置に
// 段落インデントとして揃える(丸10px+gap8px、個人カレンダーの鍵アイコンが
// 挟まる行はさらに鍵アイコン12px+gap8px分)。
const EVENT_SUMMARY_INDENT = 18;
const EVENT_SUMMARY_INDENT_PERSONAL = EVENT_SUMMARY_INDENT + 20;

function resolveEventPillStyle(
  event: Pick<Event, "calendarId" | "isAllDay"> & { tagColor?: string | null },
  calendarColorById: Record<string, string>
): { backgroundColor: string; textColor: string } {
  const color = resolveEventColor(event, calendarColorById);
  if (event.isAllDay) {
    return { backgroundColor: color, textColor: "#fff" };
  }
  return { backgroundColor: hexToRgba(color, TIMED_EVENT_BACKGROUND_ALPHA), textColor: color };
}

function DayModalEventSeparator() {
  return <View testID="calendar-day-modal-separator" style={styles.dayModalEventSeparator} />;
}

// 月の一覧表示: 同じ日の予定同士は細く薄い線、日付の切れ目はそれより少し
// 目立つ線で区切る(先頭の上・末尾の下には引かない)。
function MonthListEventSeparator() {
  return <View testID="calendar-month-list-event-separator" style={styles.dayModalEventSeparator} />;
}

function MonthListDateSeparator() {
  return <View testID="calendar-month-list-date-separator" style={styles.monthListDateSeparator} />;
}

export default function CalendarScreen() {
  const { date: dateParam, calendarId: calendarIdParam } = useLocalSearchParams<{
    date?: string;
    calendarId?: string;
  }>();

  const { session } = useAuthSession();
  const { calendars, refetch: refetchCalendars } = useMyCalendars();
  // 個人設定の「週の開始曜日」(未設定/未ログイン中は日曜始まりのデフォルトに揃える)。
  const { profile, refetch: refetchProfile } = useMyProfile(session?.user.id ?? "");
  const weekStartsOn: WeekStartsOn = profile?.weekStartsOn ?? 0;
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

  const monthGrid = useMemo(() => buildMonthGrid(focusedDate, weekStartsOn), [focusedDate, weekStartsOn]);
  // スワイプ中に隣の月の構造をその場で見せるための前月/翌月グリッド
  // (予定データは持たず、日付の並びだけ - 実データはスワイプが完了して
  // フォーカス月が実際に切り替わってから読み込まれる)。
  const prevMonthGrid = useMemo(() => {
    const date = new Date(focusedDate);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return buildMonthGrid(date, weekStartsOn);
  }, [focusedDate, weekStartsOn]);
  const nextMonthGrid = useMemo(() => {
    const date = new Date(focusedDate);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return buildMonthGrid(date, weekStartsOn);
  }, [focusedDate, weekStartsOn]);
  const range = useMemo(() => rangeForGrid(monthGrid), [monthGrid]);
  // 前月・翌月の予定もバックグラウンドで先読みしておくと、実際にスワイプ/
  // 矢印でそちらへ移動した瞬間には既にキャッシュ済みになっていて、毎回
  // 読み込み待ちにならずに済む(2026-09、月送り後の予定表示が遅く感じる
  // のを改善)。
  const prefetchRanges = useMemo(
    () => [rangeForGrid(prevMonthGrid), rangeForGrid(nextMonthGrid)],
    [prevMonthGrid, nextMonthGrid]
  );
  const { events, isLoading: isLoadingEvents, refetch: refetchEvents } = useEventsInRangeForCalendars(
    activeCalendarIds,
    range,
    prefetchRanges
  );

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
  const { tagsByEventId, refetch: refetchEventTags } = useEventTagsByEvents(eventIds);
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

  const [isDayEventsModalVisible, setIsDayEventsModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const { tagTree, refetch: refetchTagTree } = useTagTree();

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
  // 月グリッドの1行(1週間)の実際の高さ。1日の枠に予定を何行まで並べられるかの計算に使う
  // (月の週数や画面の大きさで変わる)。測れるまでは従来の固定の上限(3件)で表示する。
  const [gridRowHeight, setGridRowHeight] = useState<number | null>(null);

  const gridContainerHeight =
    containerHeight !== null && aboveGridHeight !== null && belowGridHeight !== null
      ? Math.max(200, containerHeight - aboveGridHeight - belowGridHeight)
      : null;

  const eventsForSelectedDate = events.filter((event) =>
    expandEventDateKeys(event.startAt, event.endAt).includes(selectedDateKey)
  );

  // 複数日にまたがる予定は、TimeTreeのように週をまたいでもつながって見える
  // 横長バーとして月グリッドの上に重ねて表示する(下記のmultiDayBanners)。
  // セル内の通常ピル表示(eventsByDate)には、単日の予定と、lane数の上限を
  // 超えてバー表示に乗れなかった複数日の予定だけを残す。
  const { banners: multiDayBanners, overflowEventIds: multiDayOverflowEventIds, laneCountByDateKey } = useMemo(
    () => buildMultiDayBanners(events, monthGrid),
    [events, monthGrid]
  );
  const cellPillEvents = useMemo(
    () => excludeBannerEvents(events, multiDayOverflowEventIds),
    [events, multiDayOverflowEventIds]
  );
  const bannersByWeekIndex = useMemo(() => {
    const map = new Map<number, typeof multiDayBanners>();
    multiDayBanners.forEach((banner) => {
      const list = map.get(banner.weekIndex) ?? [];
      list.push(banner);
      map.set(banner.weekIndex, list);
    });
    return map;
  }, [multiDayBanners]);

  // 複数日バーの上にできる空きlane(隣の日までバーが届かない日)を、その日の
  // 単日の予定で埋める(fillBannerGaps参照) - 埋まった予定はcellPillEvents
  // 側の通常ピル表示から除外し、二重に表示されないようにする。
  const singleDayEventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    cellPillEvents.forEach((event) => {
      const dateKeys = expandEventDateKeys(event.startAt, event.endAt);
      if (dateKeys.length !== 1) return;
      const list = map.get(dateKeys[0]) ?? [];
      list.push(event);
      map.set(dateKeys[0], list);
    });
    return map;
  }, [cellPillEvents]);

  const { gapFills: bannerGapFills, filledEventIds: bannerGapFilledEventIds } = useMemo(
    () => fillBannerGaps(multiDayBanners, laneCountByDateKey, monthGrid, singleDayEventsByDate),
    [multiDayBanners, laneCountByDateKey, monthGrid, singleDayEventsByDate]
  );

  const gapFillsByWeekIndex = useMemo(() => {
    const map = new Map<number, typeof bannerGapFills>();
    bannerGapFills.forEach((gapFill) => {
      const list = map.get(gapFill.weekIndex) ?? [];
      list.push(gapFill);
      map.set(gapFill.weekIndex, list);
    });
    return map;
  }, [bannerGapFills]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    cellPillEvents.forEach((event) => {
      if (bannerGapFilledEventIds.has(event.id)) return;
      for (const key of expandEventDateKeys(event.startAt, event.endAt)) {
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
      }
    });
    return map;
  }, [cellPillEvents, bannerGapFilledEventIds]);

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

  // 月送りスワイプの「つるん」としたスライド演出用。前月・今月・翌月の
  // 3枚のグリッドを横に並べた帯(幅 paneWidth*3)を持ち、常に「今月」が
  // 見える位置(-paneWidth)を基準に動かす - 指の動きをこの基準値に加算する
  // だけで、スワイプ中すぐ隣の月の構造が(白い空白を挟まず)見えるように
  // なる(2026-09見直し - 以前は1枚のグリッドを画面外までスライドさせてから
  // 中身を差し替えていたため、スライド中は隣に何も無い空白だった)。
  const { width: screenWidth } = useWindowDimensions();
  const paneWidth = screenWidth - GRID_HORIZONTAL_PADDING * 2;
  const gridTranslateXRef = useRef(new Animated.Value(-paneWidth));
  // スライド完了→shiftFocusedDate の直後にそのままgridTranslateXを基準位置へ
  // 戻すと、focusedDate の更新がまだ再レンダーに反映されていない(=中央
  // パネルの中身がまだ古い月のまま)タイミングで表示上「今月」の位置に
  // 戻ってしまい、次のレンダーで正しい月に切り替わるまでの一瞬、前の月の
  // 日付・予定がチラつく(2026-09修正)。そのため位置のリセットは
  // shiftFocusedDate の直後ではなく、focusedDate の変化を受けて実際に
  // 再レンダーがコミットされた後(下のuseEffect)まで遅らせる。
  const pendingSwipeResetRef = useRef(false);

  const animateMonthSwipe = (direction: 1 | -1) => {
    Animated.timing(gridTranslateXRef.current, {
      toValue: -paneWidth - direction * paneWidth,
      duration: 220,
      // useNativeDriver: false (下のuseLayoutEffectのコメント参照) - このアニメー
      // ション自体はネイティブ駆動でも問題ないが、位置リセットのsetValueと
      // 同じノードを同じ駆動方式で扱わないとRNがエラーを投げるため揃える。
      useNativeDriver: false,
    }).start(() => {
      pendingSwipeResetRef.current = true;
      shiftFocusedDate(direction);
    });
  };

  // focusedDateが実際に切り替わり、その値を使ったmonthGrid等の再レンダーが
  // コミットされた後にだけ、中央パネルの位置へ戻す(上のコメント参照)。
  // useEffectではなくuseLayoutEffectを使う - useEffectは画面に描画された
  // 「後」に(非同期に)実行されるため、一瞬だけ位置リセット前の(=スワイプ
  // 先の隣パネルがまだ表示された)フレームが見えてしまうチラつきが残っていた
  // (2026-09修正)。useLayoutEffectなら描画がユーザーに見える前に同期的に
  // リセットが反映されるため、そのフレームが見えることはない…はずだったが、
  // 実機ではそれでもまだチラついた(2026-09再修正)。原因はuseNativeDriver:
  // trueだと、このsetValueによる位置変更がJSスレッドの(useLayoutEffectを
  // 含む)コミットとは別に、ネイティブスレッド側で非同期に反映されるため、
  // Reactの再レンダー(新しい月のパネル内容の差し替え)と同じフレームに
  // 揃う保証が無かったこと。useNativeDriver: falseにすると、アニメーションも
  // このsetValueも同じJS駆動の経路(Reactのコミット/描画と同期)を通るように
  // なり、両者が必ず同じフレームで反映されるようになる。
  useLayoutEffect(() => {
    if (!pendingSwipeResetRef.current) return;
    pendingSwipeResetRef.current = false;
    gridTranslateXRef.current.setValue(-paneWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paneWidthはfocusedDateの変化では変わらない(画面回転時のみ変わるが、そのためだけにこのeffectを再定義する価値は薄い)
  }, [focusedDate]);

  // 初回レンダーで1度だけ生成する(依存配列は空)。生成時の shiftFocusedDate の
  // クロージャを掴み続けるが、shiftFocusedDate は関数型 setState で常に最新の
  // state を受け取るため問題ない(上のコメント参照)。
  /* eslint-disable react-hooks/refs -- ここで参照しているgridTranslateXRef.currentは、この
     useMemoの生成関数自体の実行時ではなく、下のonPanResponderMove/onPanResponderReleaseという
     イベントハンドラのクロージャ内で(タッチ操作に応じて)呼ばれる時にだけ読まれる。 */
  const monthSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
        onPanResponderMove: (_event, gestureState) => {
          gridTranslateXRef.current.setValue(-paneWidth + gestureState.dx);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const direction = resolveMonthSwipeDirection(gestureState.dx, gestureState.dy);
          if (direction !== null) {
            animateMonthSwipe(direction);
          } else {
            Animated.spring(gridTranslateXRef.current, { toValue: -paneWidth, useNativeDriver: false }).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gridTranslateXRef/paneWidthはこのPanResponder生成後に変わらない前提(画面幅は回転時に変わり得るが、そのためだけに一度掴んだPanResponderを作り直す価値は薄い)
    []
  );
  /* eslint-enable react-hooks/refs */

  const openCreateModal = () => {
    setIsCreateModalVisible(true);
  };

  // 予定一覧(日別モーダル・月の一覧表示)の各行で、タイトルの下に場所/メモ/URLを
  // 1行ずつアイコン付きで見せる(TimeTree同様、2026-09)。あれば全て表示する
  // - はみ出た分は各行独立で…省略。URLだけはタップでその場で開けるようにする
  // (外側の行タップ=予定詳細へ、と衝突しないようネストしたTouchableOpacityにする)。
  const renderEventSummaryLines = (
    event: Pick<Event, "id" | "location" | "memo" | "url">,
    testIDPrefix: string,
    isPersonal: boolean
  ) => (
    <View style={{ marginLeft: isPersonal ? EVENT_SUMMARY_INDENT_PERSONAL : EVENT_SUMMARY_INDENT, gap: 4 }}>
      {event.location ? (
        <View style={styles.eventSummaryLine}>
          <Icon testID={`${testIDPrefix}-location-icon-${event.id}`} name="location" size={12} color="#999" />
          <Text style={styles.eventSummaryText} numberOfLines={1} ellipsizeMode="tail">
            {event.location}
          </Text>
        </View>
      ) : null}
      {event.memo ? (
        <View style={styles.eventSummaryLine}>
          <Icon name="note" size={12} color="#999" />
          <Text style={styles.eventSummaryText} numberOfLines={1} ellipsizeMode="tail">
            {event.memo}
          </Text>
        </View>
      ) : null}
      {event.url ? (
        <TouchableOpacity
          testID={`${testIDPrefix}-url-${event.id}`}
          style={styles.eventSummaryLine}
          onPress={() => Linking.openURL(normalizeUrl(event.url!))}
        >
          <Icon testID={`${testIDPrefix}-url-icon-${event.id}`} name="link" size={12} color="#999" />
          <Text style={[styles.eventSummaryText, styles.eventSummaryLink]} numberOfLines={1} ellipsizeMode="tail">
            {event.url}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // タイトル行の右側に、写真/コメント同様の軽い気づきバッジとしてタグの有無・
  // 未達成ToDoの件数も表示する(タグは名前や色までは出さず、有無だけのマーク)。
  const renderEventCounts = (
    event: Pick<Event, "id"> &
      Pick<EventWithTagColor, "photoCount" | "commentCount" | "hasTags" | "incompleteTodoCount"> &
      Partial<Pick<EventWithTagColor, "assignees">>,
    testIDPrefix: string
  ) => {
    const assignees = event.assignees ?? [];
    if (
      !(
        event.photoCount > 0 ||
        event.commentCount > 0 ||
        event.hasTags ||
        event.incompleteTodoCount > 0 ||
        assignees.length > 0
      )
    ) {
      return null;
    }
    return (
      <View testID={`${testIDPrefix}-counts-${event.id}`} style={styles.eventCountsRow}>
        {event.photoCount > 0 ? (
          <View style={styles.eventCountBadge}>
            <Icon name="photo" size={11} color="#999" />
            <Text style={styles.eventCountText}>{event.photoCount}</Text>
          </View>
        ) : null}
        {event.commentCount > 0 ? (
          <View style={styles.eventCountBadge}>
            <Icon name="comment" size={11} color="#999" />
            <Text style={styles.eventCountText}>{event.commentCount}</Text>
          </View>
        ) : null}
        {event.hasTags ? (
          <View testID={`${testIDPrefix}-tag-mark-${event.id}`} style={styles.eventCountBadge}>
            <Icon name="tag" size={12} color="#999" />
          </View>
        ) : null}
        {event.incompleteTodoCount > 0 ? (
          <View style={styles.eventCountBadge}>
            <Icon name="checklist" size={11} color="#999" />
            <Text style={styles.eventCountText}>{event.incompleteTodoCount}</Text>
          </View>
        ) : null}
        <AssigneeAvatars testID={`${testIDPrefix}-assignees-${event.id}`} assignees={assignees} size={18} />
      </View>
    );
  };

  const isFilterActive = selectedCalendarIds !== null;
  const handleResetFilter = useCallback(() => {
    setSelectedCalendarIds(null);
  }, []);

  const bulk = useBulkTagSelection();
  const { attachTagsToEvents } = useAttachTagsToEvents();
  const { removeAllTagsFromEvents } = useRemoveAllTagsFromEvents();

  const allTagsFlat = useMemo(() => flattenTagTree(tagTree), [tagTree]);
  const bulkSelectedTagNames = useMemo(
    () => bulk.selectedTagIds.flatMap((tagId) => allTagsFlat.find((tag) => tag.id === tagId)?.name ?? []),
    [bulk.selectedTagIds, allTagsFlat]
  );

  const handleConfirmBulkTagAction = async () => {
    if (bulk.mode === "assign") {
      await attachTagsToEvents(bulk.selectedTagIds, bulk.selectedEventIds);
    } else {
      await removeAllTagsFromEvents(bulk.selectedEventIds);
    }
    bulk.deactivate();
    await refetchEventTags();
    await refetchEvents();
  };

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
      refetchEventTags();
    }, [refetchEvents, refetchEventTags])
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
      return () => {
        handleResetFilter();
        bulk.deactivate();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleResetFilter])
  );

  const headerOptions = useMemo(
    () => ({
      headerLeft: () => (
        <View style={styles.headerLeftRow}>
          <TouchableOpacity
            testID="calendar-settings-button"
            onPress={() => setSettingsModalRequest({})}
            style={styles.headerTagButton}
          >
            <Icon testID="calendar-settings-icon" name="gear" size={18} color="#444" />
          </TouchableOpacity>
          {viewMode === "list" ? (
            <TouchableOpacity
              testID="calendar-bulk-tag-button"
              onPress={() => (bulk.isActive ? bulk.deactivate() : bulk.activate())}
              style={styles.headerTagButton}
            >
              <TagIcon size={18} color={bulk.isActive ? "#2f6fed" : "#444"} />
            </TouchableOpacity>
          ) : null}
        </View>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleToggleCalendar is intentionally omitted (pre-existing, not part of this change): it's redefined every render, so including it would make this memo recompute every render too.
    [calendars, activeCalendarIds, isFilterActive, handleResetFilter, colorLegend, viewMode, bulk]
  );

  // 1つの月グリッド(週の配列)を描画する - 前月/今月/翌月の3パネルで共通
  // 利用する。前月/翌月パネルには実データ(paneEventsByDate等)を渡さず、
  // 空のMap/オブジェクトを渡すことで「日付の並びだけ」のプレースホルダーに
  // なる(スワイプ完了してフォーカス月が切り替わった時点で実データ付きで
  // 再描画される)。
  const renderGridPane = (
    grid: typeof monthGrid,
    paneEventsByDate: typeof eventsByDate,
    paneBannersByWeekIndex: typeof bannersByWeekIndex,
    paneLaneCountByDateKey: typeof laneCountByDateKey,
    paneGapFillsByWeekIndex: typeof gapFillsByWeekIndex,
    // 前月/翌月パネルは今月パネルと同じ日付(週をまたぐ余白日)を含み得る
    // ため、testIDが衝突しないようパネルごとに接頭辞を変える(今月パネルは
    // 既存テストと互換のデフォルト接頭辞のまま)。
    testIDPrefix = "calendar-grid"
  ) =>
    grid.map((week, weekIndex) => {
      const weekBanners = paneBannersByWeekIndex.get(weekIndex) ?? [];
      const weekGapFills = paneGapFillsByWeekIndex.get(weekIndex) ?? [];
      return (
        <View
          key={weekIndex}
          testID={`${testIDPrefix}-row-${weekIndex}`}
          style={styles.gridRow}
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            setGridRowHeight((previous) => (previous !== null && Math.abs(previous - height) < 0.5 ? previous : height));
          }}
        >
          {week.map((cell) => {
            const cellEvents = paneEventsByDate.get(cell.dateKey) ?? [];
            // その日に実際に重なっているバーの分だけ空ける(週全体では
            // なくセル単位 - バーが通らない日まで一律に空けてしまうと
            // 「関係ない日の予定が1行分下がって見える」不具合になる)。
            const laneCount = paneLaneCountByDateKey[cell.dateKey] ?? 0;
            // 枠に入るだけ予定を表示し、入りきらないときだけ最後の行を「+N」にする。
            const { visible: visibleCellEvents, hiddenCount: hiddenCellEventCount } = splitCellEvents(
              cellEvents,
              gridRowHeight,
              laneCount
            );
            const isToday = cell.dateKey === todayDateKey();
            const isSelected = cell.dateKey === selectedDateKey;
            const dayOfWeek = new Date(`${cell.dateKey}T00:00:00.000Z`).getUTCDay();
            const isSaturday = dayOfWeek === 6;
            const isSundayOrHoliday = dayOfWeek === 0 || isJapaneseHoliday(cell.dateKey);
            return (
              <TouchableOpacity
                key={cell.dateKey}
                testID={`${testIDPrefix}-cell-${cell.dateKey}`}
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
                <View
                  testID={`${testIDPrefix}-cell-events-${cell.dateKey}`}
                  style={[
                    styles.gridEventList,
                    laneCount > 0 && { marginTop: laneCount * (BANNER_ROW_HEIGHT + BANNER_ROW_GAP) },
                  ]}
                >
                  {visibleCellEvents.map((event) => {
                    const { backgroundColor, textColor } = resolveEventPillStyle(event, calendarColorById);
                    return (
                      <View
                        key={event.id}
                        testID={`${testIDPrefix}-dot-${event.id}`}
                        style={[styles.gridEventBar, { backgroundColor }]}
                      >
                        {personalCalendarIds.has(event.calendarId) ? (
                          <Icon
                            testID={`${testIDPrefix}-dot-personal-${event.id}`}
                            name="lock"
                            size={7}
                            color={textColor}
                            style={styles.gridEventBarLockIcon}
                          />
                        ) : null}
                        <Text style={[styles.gridEventBarText, { color: textColor }]} numberOfLines={1} ellipsizeMode="clip">
                          {event.title}
                        </Text>
                      </View>
                    );
                  })}
                  {hiddenCellEventCount > 0 ? (
                    <Text testID={`${testIDPrefix}-cell-overflow-${cell.dateKey}`} style={styles.gridDotOverflow}>
                      +{hiddenCellEventCount}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
          {weekBanners.length > 0 || weekGapFills.length > 0 ? (
            <View style={styles.gridBannerOverlay} pointerEvents="box-none">
              {weekBanners.map((banner) => {
                const { backgroundColor, textColor } = resolveEventPillStyle(banner.event, calendarColorById);
                return (
                  <TouchableOpacity
                    key={`${banner.event.id}-${weekIndex}`}
                    testID={`${testIDPrefix}-banner-${banner.event.id}-week-${weekIndex}`}
                    onPress={() => handleSelectDateCell(week[banner.colStart].dateKey)}
                    style={[
                      styles.gridBanner,
                      {
                        // 通常ピルと同じ「セルの左右端からGRID_CELL_PILL_INSET
                        // だけ内側」の見た目に揃える(上のコメント参照)。
                        left: (banner.colStart / 7) * paneWidth + GRID_CELL_PILL_INSET,
                        width:
                          ((banner.colEnd - banner.colStart + 1) / 7) * paneWidth - GRID_CELL_PILL_INSET * 2,
                        top: BANNER_AREA_TOP + banner.lane * (BANNER_ROW_HEIGHT + BANNER_ROW_GAP),
                        backgroundColor,
                        borderTopLeftRadius: banner.isStart ? 3 : 0,
                        borderBottomLeftRadius: banner.isStart ? 3 : 0,
                        borderTopRightRadius: banner.isEnd ? 3 : 0,
                        borderBottomRightRadius: banner.isEnd ? 3 : 0,
                      },
                    ]}
                  >
                    {personalCalendarIds.has(banner.event.calendarId) ? (
                      <Icon name="lock" size={7} color={textColor} style={styles.gridEventBarLockIcon} />
                    ) : null}
                    <Text style={[styles.gridEventBarText, { color: textColor }]} numberOfLines={1} ellipsizeMode="clip">
                      {banner.event.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {weekGapFills.map((gapFill) => {
                const { backgroundColor, textColor } = resolveEventPillStyle(gapFill.event, calendarColorById);
                return (
                  <TouchableOpacity
                    key={`gapfill-${gapFill.event.id}-${weekIndex}`}
                    testID={`${testIDPrefix}-gapfill-${gapFill.event.id}-week-${weekIndex}`}
                    onPress={() => handleSelectDateCell(week[gapFill.col].dateKey)}
                    style={[
                      styles.gridBanner,
                      {
                        left: (gapFill.col / 7) * paneWidth + GRID_CELL_PILL_INSET,
                        width: (1 / 7) * paneWidth - GRID_CELL_PILL_INSET * 2,
                        top: BANNER_AREA_TOP + gapFill.lane * (BANNER_ROW_HEIGHT + BANNER_ROW_GAP),
                        backgroundColor,
                        borderRadius: 3,
                      },
                    ]}
                  >
                    {personalCalendarIds.has(gapFill.event.calendarId) ? (
                      <Icon name="lock" size={7} color={textColor} style={styles.gridEventBarLockIcon} />
                    ) : null}
                    <Text style={[styles.gridEventBarText, { color: textColor }]} numberOfLines={1} ellipsizeMode="clip">
                      {gapFill.event.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      );
    });

  const EMPTY_EVENTS_BY_DATE: typeof eventsByDate = new Map();
  const EMPTY_BANNERS_BY_WEEK: typeof bannersByWeekIndex = new Map();
  const EMPTY_LANE_COUNT: typeof laneCountByDateKey = {};
  const EMPTY_GAP_FILLS_BY_WEEK: typeof gapFillsByWeekIndex = new Map();

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
            refetchProfile();
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
          <View testID="calendar-weekday-row" style={styles.weekdayRow}>
            {getWeekdayHeaderCells(weekStartsOn).map(({ label, dayOfWeek }) => (
              <Text
                key={dayOfWeek}
                style={[
                  styles.weekdayLabel,
                  dayOfWeek === 6 && styles.weekdaySaturday,
                  dayOfWeek === 0 && styles.weekdaySunday,
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
          {/* Animated.Valueは安定したオブジェクト参照であり、毎レンダーでstyleへ渡すのがReact Native公式のPanResponder+Animatedパターン(react-hooks/refsの誤検知)。 */}
          <View style={styles.gridWeeksClip}>
            <Animated.View
              testID="calendar-weeks-area"
              style={[
                styles.weeksAreaTrack,
                {
                  width: paneWidth * 3,
                  // eslint-disable-next-line react-hooks/refs -- 上のコメント参照。Animated.Valueの安定参照を毎レンダーでstyleへ渡す公式パターン。
                  transform: [{ translateX: gridTranslateXRef.current }],
                },
              ]}
            >
              <View testID="calendar-weeks-pane-prev" style={{ width: paneWidth }}>
                {renderGridPane(
                  prevMonthGrid,
                  EMPTY_EVENTS_BY_DATE,
                  EMPTY_BANNERS_BY_WEEK,
                  EMPTY_LANE_COUNT,
                  EMPTY_GAP_FILLS_BY_WEEK,
                  "calendar-grid-prev"
                )}
              </View>
              <View testID="calendar-weeks-pane-current" style={{ width: paneWidth }}>
                {renderGridPane(monthGrid, eventsByDate, bannersByWeekIndex, laneCountByDateKey, gapFillsByWeekIndex)}
              </View>
              <View testID="calendar-weeks-pane-next" style={{ width: paneWidth }}>
                {renderGridPane(
                  nextMonthGrid,
                  EMPTY_EVENTS_BY_DATE,
                  EMPTY_BANNERS_BY_WEEK,
                  EMPTY_LANE_COUNT,
                  EMPTY_GAP_FILLS_BY_WEEK,
                  "calendar-grid-next"
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      ) : (
        <View style={styles.monthListContainer} testID="calendar-month-list-container" {...monthSwipeResponder.panHandlers}>
          {bulk.isActive ? (
            <BulkTagAssignPanel
              testIDPrefix="calendar-bulk-tag"
              tagTree={tagTree}
              mode={bulk.mode}
              selectedTagIds={bulk.selectedTagIds}
              onToggleTag={bulk.toggleTag}
              onSwitchToRemoveMode={bulk.switchToRemoveMode}
              onSwitchToAssignMode={bulk.switchToAssignMode}
            />
          ) : null}

          {isLoadingEvents ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>読み込み中…</Text>
            </View>
          ) : monthEventGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>この月に予定はありません</Text>
            </View>
          ) : (
            <FlatList
              testID="calendar-month-list"
              data={monthEventGroups}
              keyExtractor={(group) => group.dateKey}
              contentContainerStyle={styles.monthListContent}
              ItemSeparatorComponent={MonthListDateSeparator}
              renderItem={({ item: group }) => (
                <View testID={`calendar-month-list-date-group-${group.dateKey}`}>
                  <Text style={styles.monthListDateHeader}>{group.label}</Text>
                  {group.events.map((event, index) => {
                    const tags = sortTagsHierarchically(tagsByEventId[event.id] ?? [], allTagsFlat);
                    return (
                      <Fragment key={event.id}>
                        {index > 0 ? <MonthListEventSeparator /> : null}
                        <TouchableOpacity
                          testID={`calendar-list-event-${event.id}`}
                          style={styles.eventRow}
                          onPress={() =>
                            bulk.isActive ? bulk.toggleEvent(event.id) : router.push(`/event/${event.id}`)
                          }
                        >
                          {bulk.isActive ? (
                            <SelectionCircle
                              testID={`calendar-list-event-select-${event.id}`}
                              isSelected={bulk.selectedEventIds.includes(event.id)}
                              onPress={() => bulk.toggleEvent(event.id)}
                            />
                          ) : null}
                          <View style={styles.eventRowContent}>
                            <View style={styles.eventRowMain}>
                              <View
                                style={[styles.categoryDot, { backgroundColor: resolveEventColor(event, calendarColorById) }]}
                              />
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
                              {renderEventCounts(event, "calendar-list-event")}
                            </View>
                            {renderEventSummaryLines(
                              event,
                              "calendar-list-event",
                              personalCalendarIds.has(event.calendarId)
                            )}
                            {tags.length > 0 ? (
                              <EventTagBadges tags={tags} fallbackColor={calendarColorById[event.calendarId]} />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      </Fragment>
                    );
                  })}
                </View>
              )}
            />
          )}

          {bulk.isActive ? (
            <BulkSelectionActionBar
              testIDPrefix="calendar-bulk-tag"
              mode={bulk.mode}
              selectedEventCount={bulk.selectedEventIds.length}
              selectedTagNames={bulkSelectedTagNames}
              onClearSelection={bulk.clearSelectedEvents}
              onConfirm={handleConfirmBulkTagAction}
            />
          ) : null}
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
                ItemSeparatorComponent={DayModalEventSeparator}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.eventRow}
                    testID={`calendar-event-${item.id}`}
                    onPress={() => {
                      setIsDayEventsModalVisible(false);
                      router.push(`/event/${item.id}`);
                    }}
                  >
                    <View style={styles.eventRowContent}>
                      <View style={styles.eventRowMain}>
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
                        {renderEventCounts(item, "calendar-event")}
                      </View>
                      {renderEventSummaryLines(item, "calendar-event", personalCalendarIds.has(item.calendarId))}
                    </View>
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

      {/* タグの一括付与中は、右下の選択完了ボタン(BulkSelectionActionBar)と重なるので隠す。 */}
      {bulk.isActive ? null : (
        <TouchableOpacity testID="calendar-add-event-fab" style={styles.fab} onPress={openCreateModal}>
          <Icon name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      <EventCreateModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreated={refetchEvents}
        calendars={calendars}
        defaultCalendarId={activeCalendarId}
        tagTree={tagTree}
        initialDateKey={selectedDateKey}
      />
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
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
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
  monthListDateSeparator: {
    height: 1,
    backgroundColor: "#cfd3d9",
    marginTop: 12,
    marginHorizontal: 8,
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
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  weekdayRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e0e0e0",
  },
  gridWeeksClip: {
    flex: 1,
    overflow: "hidden",
  },
  weeksAreaTrack: {
    flex: 1,
    flexDirection: "row",
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
    position: "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: "#e0e0e0",
  },
  gridBannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridBanner: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    height: 14,
    paddingHorizontal: 2,
  },
  gridCell: {
    flex: 1,
    alignItems: "center",
    paddingTop: 4,
    gap: 2,
    borderRadius: 8,
    overflow: "hidden",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: "#e0e0e0",
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
    fontSize: 10,
    lineHeight: 12,
    color: "#fff",
    fontWeight: "600",
  },
  gridDotOverflow: {
    fontSize: 10,
    // 予定1行(ピル)と同じ高さ。枠に入る行数の計算(monthCellCapacity.ts)がこれに依存する。
    lineHeight: 14,
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
  eventRowContent: {
    flex: 1,
    gap: 4,
  },
  eventRowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  eventTime: {
    color: "#666",
    fontSize: 13,
  },
  eventTitle: {
    flex: 1,
    fontSize: 15,
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
  eventSummaryLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eventSummaryText: {
    flex: 1,
    fontSize: 12,
    color: "#888",
  },
  eventSummaryLink: {
    color: "#2f6fed",
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
  dayModalEventSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 16,
  },
  dayModalEventList: {
    flex: 1,
  },
});
