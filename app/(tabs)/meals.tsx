import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Tabs, router, useFocusEffect } from "expo-router";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useCalendarMembersByCalendars, useMyCalendars } from "../../src/features/calendars/hooks";
import { CalendarSwitchChip } from "../../src/features/calendars/components/CalendarSwitchChip";
import { groupMealsByDate, groupMealsByMonth } from "../../src/features/meals/grouping";
import {
  useCreateMealRecord,
  useDeleteMealRecord,
  useMealRecordsByCalendars,
  useUpdateMealRecord,
} from "../../src/features/meals/hooks";
import { MealFormModal, type MealFormTarget, type MealFormValues } from "../../src/features/meals/components/MealFormModal";
import { MealNotificationBell } from "../../src/features/meals/components/MealNotificationBell";
import { mealFormPatchToUpdateInput } from "../../src/features/meals/formPatch";
import { MealRow } from "../../src/features/meals/components/MealRow";
import type { MealRecord, MealSlot } from "../../src/features/meals/types";
import { DateRangeFilterSection } from "../../src/shared/components/DateRangeFilterSection";
import { FilterButton, FilterSection } from "../../src/shared/components/FilterButton";
import { Icon } from "../../src/shared/components/Icon";
import { isDateKeyInRange } from "../../src/shared/utils/dateRangeFilter";
import { todayJstDateKey } from "../../src/shared/utils/formatDateTime";

type MealsMode = "plan" | "log";

/**
 * 献立タブ本体。上部のメニュー(予定/記録)で表示を切り替える - 振り返り
 * タブの年表/画像と同じ「統合タブ内に独立したパネルを複数持たせる」構成。
 * 「予定」はあらかじめ献立を決めてメモしておく(忘れずに食べられる)ため、
 * 「記録」は食べたものを振り返る(食べたいものが思いつかない時の参考に
 * する)ためのパネルで、それぞれ目的に合わせて別々にレイアウトしている。
 */
export default function MealsScreen() {
  const [mode, setMode] = useState<MealsMode>("log");

  return (
    <View style={styles.container}>
      <View style={styles.modeSwitchRow} testID="meals-mode-switch">
        <TouchableOpacity
          testID="meals-mode-log"
          style={[styles.modeSwitchButton, mode === "log" && styles.modeSwitchButtonActive]}
          onPress={() => setMode("log")}
        >
          <Text style={mode === "log" ? styles.modeSwitchTextActive : styles.modeSwitchText}>記録</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="meals-mode-plan"
          style={[styles.modeSwitchButton, mode === "plan" && styles.modeSwitchButtonActive]}
          onPress={() => setMode("plan")}
        >
          <Text style={mode === "plan" ? styles.modeSwitchTextActive : styles.modeSwitchText}>予定</Text>
        </TouchableOpacity>
      </View>

      {mode === "plan" ? <PlanPanel /> : <LogPanel />}
    </View>
  );
}

/**
 * カレンダー絞り込み(デフォルト全選択・タップでトグル)まわりの状態一式。
 * 予定パネル・記録パネルどちらも同じ仕組みを個別に持つ(パネルを離れる
 * =アンマウントされるたびにリセットされる、共通フィルターの決まり)。
 */
function useCalendarFilter() {
  const { session } = useAuthSession();
  const { calendars, refetch: refetchCalendars } = useMyCalendars();
  // 他画面と同じ「デフォルトで全カレンダー選択、タップで表示/非表示切り替え」方式。
  // null = まだ明示的に選択を触っていない(=全カレンダー)。
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string> | null>(null);
  const activeCalendarIds =
    selectedCalendarIds !== null ? Array.from(selectedCalendarIds) : calendars.map((calendar) => calendar.id);
  // 新規記録は複数カレンダーへ同時に作れないので、選択中(なければ先頭)の
  // カレンダーを保存先にする。
  const createTargetCalendarId = activeCalendarIds[0] ?? calendars[0]?.id ?? "";

  // 「誰が追加したか」の表示は共有カレンダーの献立にだけ意味があるので、
  // メンバー一覧も共有カレンダーの分だけ取得する(2026-09)。
  const groupCalendarIds = useMemo(
    () => calendars.filter((calendar) => calendar.kind === "group").map((calendar) => calendar.id),
    [calendars]
  );
  const { members } = useCalendarMembersByCalendars(groupCalendarIds);
  const resolveMemberLabel = (userId: string | null): string => {
    if (userId === null) return "元メンバー";
    const member = members.find((m) => m.userId === userId);
    if (member?.displayName) return member.displayName;
    if (userId === session?.user.id) return session?.user.email ?? "メンバー";
    return "メンバー";
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

  const isFilterActive = selectedCalendarIds !== null;
  const handleResetFilter = useCallback(() => {
    setSelectedCalendarIds(null);
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

  return {
    calendars,
    activeCalendarIds,
    createTargetCalendarId,
    isFilterActive,
    handleToggleCalendar,
    handleResetFilter,
    resolveMemberLabel,
  };
}

/**
 * 献立の追加/編集/削除まわりの状態とハンドラ一式。予定パネル・記録パネル
 * どちらも同じ流れ(フォームを開く→保存/削除→閉じてrefetch)なので、
 * ここに集約して2箇所での重複を避けている。
 */
function useMealFormController(createTargetCalendarId: string, refetch: () => Promise<void>) {
  const { createMealRecord, isSubmitting: isCreatingMeal } = useCreateMealRecord();
  const { updateMealRecord, isSubmitting: isUpdatingMeal } = useUpdateMealRecord();
  const { deleteMealRecord, isSubmitting: isDeletingMeal } = useDeleteMealRecord();
  const isSavingMeal = isCreatingMeal || isUpdatingMeal;
  const [formTarget, setFormTarget] = useState<MealFormTarget | null>(null);

  const openCreate = (defaults: { mealDate: string; slot: MealSlot }) => {
    setFormTarget({
      mode: "create",
      initialValues: { title: "", url: "", memo: "", rating: null, calendarId: createTargetCalendarId, ...defaults },
    });
  };

  const openEdit = (record: MealRecord) => {
    setFormTarget({
      mode: "edit",
      recordId: record.id,
      initialValues: {
        title: record.title,
        url: record.url ?? "",
        memo: record.memo ?? "",
        mealDate: record.mealDate,
        slot: record.slot,
        rating: record.rating,
        calendarId: record.calendarId,
      },
    });
  };

  const closeForm = () => setFormTarget(null);

  const handleSave = async (values: MealFormValues) => {
    // 連打で同じ献立が2件作られてしまうのを防ぐ(下のボタン側のdisabledと
    // 二重で防御する)。
    if (isSavingMeal) return;
    const success =
      formTarget?.mode === "edit"
        ? await updateMealRecord(formTarget.recordId, {
            title: values.title,
            url: values.url || null,
            memo: values.memo || null,
            mealDate: values.mealDate,
            slot: values.slot,
            rating: values.rating,
            calendarId: values.calendarId,
          })
        : await createMealRecord({
            // 作成時はフォーム内のカレンダーピッカーで選び直せる - 呼び出し
            // 時点のcreateTargetCalendarId(フィルターの先頭)ではなく、
            // ユーザーが最終的に選んだvalues.calendarIdを使う。
            calendarId: values.calendarId,
            mealDate: values.mealDate,
            slot: values.slot,
            title: values.title,
            url: values.url || undefined,
            memo: values.memo || undefined,
            rating: values.rating ?? undefined,
          });
    if (success) {
      closeForm();
      await refetch();
    }
  };

  // 詳細(編集モード)の項目単位の保存。フォームは開いたままにして(次の項目も
  // 続けて直せるように)、一覧だけ最新にする。
  const handleUpdateField = async (recordId: string, patch: Partial<MealFormValues>): Promise<boolean> => {
    if (isSavingMeal) return false;
    const success = await updateMealRecord(recordId, mealFormPatchToUpdateInput(patch));
    if (success) {
      await refetch();
    }
    return success;
  };

  const handleDelete = async (recordId: string) => {
    if (isDeletingMeal) return;
    const success = await deleteMealRecord(recordId);
    if (success) {
      closeForm();
      await refetch();
    }
  };

  return {
    formTarget,
    openCreate,
    openEdit,
    closeForm,
    handleSave,
    handleUpdateField,
    handleDelete,
    isSavingMeal,
    isDeletingMeal,
  };
}

function PlanPanel() {
  const {
    calendars,
    activeCalendarIds,
    createTargetCalendarId,
    isFilterActive,
    handleToggleCalendar,
    handleResetFilter,
    resolveMemberLabel,
  } = useCalendarFilter();
  const { mealRecords, isLoading, refetch } = useMealRecordsByCalendars(activeCalendarIds);
  // 表示中のカレンダーが複数ある時だけ、行にどのカレンダーの献立かを添える
  // (1つしかない時はどうせ全部同じなので出さない)。
  const calendarById = useMemo(() => new Map(calendars.map((calendar) => [calendar.id, calendar])), [calendars]);
  const { formTarget, openCreate, openEdit, closeForm, handleSave, handleUpdateField, handleDelete, isSavingMeal, isDeletingMeal } = useMealFormController(
    createTargetCalendarId,
    refetch
  );

  const today = todayJstDateKey();
  // 予定は近い将来のものが中心なので、月をまたいで束ねず日付見出しだけで
  // 十分 - 年表のように月単位でまとめると逆に見づらくなる。
  const dateGroups = useMemo(
    () => groupMealsByDate(mealRecords.filter((record) => record.mealDate >= today)),
    [mealRecords, today]
  );

  return (
    <View style={styles.panel}>
      <Tabs.Screen
        options={{
          headerLeft: () => <MealNotificationBell />,
          headerRight: () => (
            <View style={styles.headerRightRow}>
              <FilterButton testID="meals-filter" isActive={isFilterActive} onReset={handleResetFilter}>
                <FilterSection title="カレンダー">
                  {calendars.map((calendar) => (
                    <CalendarSwitchChip
                      key={calendar.id}
                      testID={`meals-calendar-switch-${calendar.id}`}
                      calendar={calendar}
                      isActive={activeCalendarIds.includes(calendar.id)}
                      onPress={() => handleToggleCalendar(calendar.id)}
                    />
                  ))}
                </FilterSection>
              </FilterButton>
              <TouchableOpacity
                testID="meals-search-button"
                style={styles.headerSearchButton}
                onPress={() =>
                  router.push({ pathname: "/meal-search", params: { calendarId: createTargetCalendarId } })
                }
              >
                <Icon name="search" size={22} color="#2f6fed" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>読み込み中…</Text>
        </View>
      ) : dateGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>🍽️</Text>
          <Text style={styles.emptyStateText}>まだ献立の予定がありません</Text>
          <Text style={styles.emptyStateHint}>右下の＋から、あらかじめ決めた献立をメモしておきましょう</Text>
        </View>
      ) : (
        <FlatList
          testID="meals-plan-list"
          data={dateGroups}
          keyExtractor={(group) => group.mealDate}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View testID={`meals-plan-date-group-${group.mealDate}`}>
              <Text style={styles.dateHeader}>{group.label}</Text>
              {group.records.map((record) => (
                <MealRow
                  key={record.id}
                  record={record}
                  onPress={() => openEdit(record)}
                  calendar={calendars.length > 1 ? calendarById.get(record.calendarId) : undefined}
                  creatorLabel={
                    calendarById.get(record.calendarId)?.kind === "group"
                      ? resolveMemberLabel(record.createdBy)
                      : undefined
                  }
                />
              ))}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        testID="meals-plan-add"
        style={styles.fab}
        onPress={() => openCreate({ mealDate: today, slot: "dinner" })}
      >
        <Icon name="plus" size={22} color="#fff" />
      </TouchableOpacity>

      <MealFormModal
        target={formTarget}
        calendars={calendars}
        onClose={closeForm}
        onSave={handleSave}
        onUpdateField={handleUpdateField}
        isSaving={isSavingMeal}
        isDeleting={isDeletingMeal}
        onDelete={formTarget?.mode === "edit" ? handleDelete : undefined}
      />
    </View>
  );
}

function LogPanel() {
  const {
    calendars,
    activeCalendarIds,
    createTargetCalendarId,
    isFilterActive: isCalendarFilterActive,
    handleToggleCalendar,
    handleResetFilter: handleResetCalendarFilter,
    resolveMemberLabel,
  } = useCalendarFilter();
  const { mealRecords, isLoading, refetch } = useMealRecordsByCalendars(activeCalendarIds);
  const { formTarget, openCreate, openEdit, closeForm, handleSave, handleUpdateField, handleDelete, isSavingMeal, isDeletingMeal } = useMealFormController(
    createTargetCalendarId,
    refetch
  );
  const calendarById = useMemo(() => new Map(calendars.map((calendar) => [calendar.id, calendar])), [calendars]);

  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const handleResetPeriod = useCallback(() => {
    setPeriodStart(null);
    setPeriodEnd(null);
  }, []);
  // カレンダー絞り込みと同じ「パネルを離れたらリセット」の決まりに従う -
  // useCalendarFilter自身のuseFocusEffectとは独立に、期間だけの専用effectを持つ。
  useFocusEffect(useCallback(() => handleResetPeriod, [handleResetPeriod]));

  const isFilterActive = isCalendarFilterActive || periodStart !== null || periodEnd !== null;
  const handleResetFilter = () => {
    handleResetCalendarFilter();
    handleResetPeriod();
  };

  const today = todayJstDateKey();
  // 振り返りは直近から遡って眺めたいので新しい順に並べ替えてから月ごとに
  // まとめ、月の中はさらに日付ごとに小見出しを立てる(振り返りタブの
  // 年表と同じ「月見出し＋日付ラベル」の2段構成)。
  const monthGroups = useMemo(() => {
    const pastRecordsDescending = mealRecords
      .filter((record) => record.mealDate < today)
      .filter((record) => isDateKeyInRange(record.mealDate, periodStart, periodEnd))
      .slice()
      .reverse();
    return groupMealsByMonth(pastRecordsDescending);
  }, [mealRecords, today, periodStart, periodEnd]);

  return (
    <View style={styles.panel}>
      <Tabs.Screen
        options={{
          headerLeft: () => <MealNotificationBell />,
          headerRight: () => (
            <View style={styles.headerRightRow}>
              <FilterButton testID="meals-filter" isActive={isFilterActive} onReset={handleResetFilter}>
                <FilterSection title="カレンダー">
                  {calendars.map((calendar) => (
                    <CalendarSwitchChip
                      key={calendar.id}
                      testID={`meals-calendar-switch-${calendar.id}`}
                      calendar={calendar}
                      isActive={activeCalendarIds.includes(calendar.id)}
                      onPress={() => handleToggleCalendar(calendar.id)}
                    />
                  ))}
                </FilterSection>
                <FilterSection title="期間">
                  <DateRangeFilterSection
                    testIDPrefix="meals-period"
                    startDate={periodStart}
                    endDate={periodEnd}
                    onChange={({ startDate, endDate }) => {
                      setPeriodStart(startDate);
                      setPeriodEnd(endDate);
                    }}
                  />
                </FilterSection>
              </FilterButton>
              <TouchableOpacity
                testID="meals-search-button"
                style={styles.headerSearchButton}
                onPress={() =>
                  router.push({ pathname: "/meal-search", params: { calendarId: createTargetCalendarId } })
                }
              >
                <Icon name="search" size={22} color="#2f6fed" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>読み込み中…</Text>
        </View>
      ) : monthGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>📝</Text>
          <Text style={styles.emptyStateText}>記録がありません</Text>
          <Text style={styles.emptyStateHint}>食べたものをメモしておくと、次に迷ったときの参考になります</Text>
        </View>
      ) : (
        <FlatList
          testID="meals-log-list"
          data={monthGroups}
          keyExtractor={(group) => group.yearMonth}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: group }) => (
            <View testID={`meals-log-month-group-${group.yearMonth}`}>
              <Text style={styles.monthHeader}>{group.label}</Text>
              {groupMealsByDate(group.records).map((dateGroup) => (
                <View key={dateGroup.mealDate} testID={`meals-log-date-group-${dateGroup.mealDate}`}>
                  <Text style={styles.dateSubHeader}>{dateGroup.label}</Text>
                  {dateGroup.records.map((record) => (
                    <MealRow
                      key={record.id}
                      record={record}
                      onPress={() => openEdit(record)}
                      calendar={calendars.length > 1 ? calendarById.get(record.calendarId) : undefined}
                      creatorLabel={
                        calendarById.get(record.calendarId)?.kind === "group"
                          ? resolveMemberLabel(record.createdBy)
                          : undefined
                      }
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        />
      )}

      <TouchableOpacity
        testID="meals-log-add"
        style={styles.fab}
        onPress={() => openCreate({ mealDate: today, slot: "dinner" })}
      >
        <Icon name="plus" size={22} color="#fff" />
      </TouchableOpacity>

      <MealFormModal
        target={formTarget}
        calendars={calendars}
        onClose={closeForm}
        onSave={handleSave}
        onUpdateField={handleUpdateField}
        isSaving={isSavingMeal}
        isDeleting={isDeletingMeal}
        onDelete={formTarget?.mode === "edit" ? handleDelete : undefined}
      />
    </View>
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
  panel: {
    flex: 1,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerSearchButton: {
    marginRight: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 88,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 4,
  },
  emptyStateEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
  },
  emptyStateHint: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    paddingTop: 16,
    paddingBottom: 8,
  },
  monthHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    paddingTop: 16,
    paddingBottom: 4,
  },
  dateSubHeader: {
    fontSize: 12,
    color: "#999",
    paddingTop: 10,
    paddingBottom: 4,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
