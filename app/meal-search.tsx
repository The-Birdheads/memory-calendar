import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { useMyCalendars } from "../src/features/calendars/hooks";
import { MealFormModal, type MealFormTarget, type MealFormValues } from "../src/features/meals/components/MealFormModal";
import { MEAL_SLOT_LABELS, MealRow } from "../src/features/meals/components/MealRow";
import { RatingStars } from "../src/features/meals/components/RatingStars";
import { useDeleteMealRecord, useMealRecords, useUpdateMealRecord } from "../src/features/meals/hooks";
import type { MealRecord, MealSlot } from "../src/features/meals/types";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const MAX_SUGGESTIONS = 5;

/** "YYYY-MM-DD" (already a plain date, no time) + the slot label, e.g. "2026/9/1 昼食". */
function formatMealDateSlotLabel(mealDate: string, slot: MealSlot): string {
  return `${mealDate.replace(/-/g, "/")} ${MEAL_SLOT_LABELS[slot]}`;
}

/** "YYYY-MM-DD" → "YYYY/MM/DD" - the slot itself is already shown by MealRow's
 * own slot chip, so search results only need the bare date alongside it. */
function formatDateLabel(mealDate: string): string {
  return mealDate.replace(/-/g, "/");
}

export default function MealSearchScreen() {
  const { calendarId } = useLocalSearchParams<{ calendarId?: string }>();
  const activeCalendarId = calendarId ?? "";

  const { calendars } = useMyCalendars();
  const [selectedSlot, setSelectedSlot] = useState<MealSlot | undefined>(undefined);
  const filter = selectedSlot ? { slot: selectedSlot } : undefined;
  const { mealRecords, refetch } = useMealRecords(activeCalendarId, filter);

  // 検索結果は献立タブの一覧と同じ行(MealRow)をそのまま使い、タップすると
  // 同じ編集フォームが開く - 「さがして終わり」ではなく、見つけた献立の
  // 評価やメモをその場で直せるようにする(2026-09)。
  const { updateMealRecord } = useUpdateMealRecord();
  const { deleteMealRecord } = useDeleteMealRecord();
  const [formTarget, setFormTarget] = useState<MealFormTarget | null>(null);

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

  const handleSaveEdit = async (values: MealFormValues) => {
    if (formTarget?.mode !== "edit") return;
    const success = await updateMealRecord(formTarget.recordId, {
      title: values.title,
      url: values.url || null,
      memo: values.memo || null,
      mealDate: values.mealDate,
      slot: values.slot,
      rating: values.rating,
    });
    if (success) {
      closeForm();
      await refetch();
    }
  };

  const handleDelete = async (recordId: string) => {
    const success = await deleteMealRecord(recordId);
    if (success) {
      closeForm();
      await refetch();
    }
  };

  const [query, setQuery] = useState("");
  // 「n★以上」の下限フィルター。null=絞り込みなし。RatingStarsは元々
  // 「そのレコード自身の評価を編集する」用途だが、タップしたところまで
  // 塗りつぶす/同じ星を再タップで解除、という挙動自体はそのまま「n★以上」
  // の下限指定にも使い回せる。
  const [minRating, setMinRating] = useState<number | null>(null);
  const [randomPick, setRandomPick] = useState<MealRecord | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const titleSuggestions = useMemo(() => {
    if (!normalizedQuery) return [];
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const record of mealRecords) {
      if (record.title === query) continue;
      if (!record.title.toLowerCase().includes(normalizedQuery)) continue;
      if (seen.has(record.title)) continue;
      seen.add(record.title);
      suggestions.push(record.title);
      if (suggestions.length >= MAX_SUGGESTIONS) break;
    }
    return suggestions;
  }, [mealRecords, normalizedQuery, query]);

  const results = useMemo(() => {
    return mealRecords.filter((record) => {
      if (normalizedQuery && !record.title.toLowerCase().includes(normalizedQuery)) return false;
      if (minRating !== null && (record.rating === null || record.rating < minRating)) return false;
      return true;
    });
  }, [mealRecords, normalizedQuery, minRating]);

  // 「何を食べるか思いつかない」時のための、絞り込んだ候補からのランダム
  // 選出。フィルターを変えても選出済みのおすすめは自動では消さない(まず
  // 目に入れてから絞り込みを変えたくなることもあるため) - 「もう一度」で
  // 都度その時点のresultsから選び直す。
  const handleRandomPick = () => {
    if (results.length === 0) return;
    setRandomPick(results[Math.floor(Math.random() * results.length)]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "献立をさがす", headerBackButtonDisplayMode: "minimal" }} />
      <View style={styles.container}>
        <TextInput
          testID="meal-search-input"
          style={styles.searchInput}
          placeholder="料理名で検索"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />

        {titleSuggestions.length > 0 ? (
          <View style={styles.suggestionList} testID="meal-search-suggestions">
            {titleSuggestions.map((title) => (
              <TouchableOpacity
                key={title}
                testID={`meal-search-suggestion-${title}`}
                style={styles.suggestionRow}
                onPress={() => setQuery(title)}
              >
                <Text>{title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.slotRow}>
          <TouchableOpacity
            testID="meal-search-slot-all"
            style={[styles.slotButton, selectedSlot === undefined && styles.slotButtonActive]}
            onPress={() => setSelectedSlot(undefined)}
          >
            <Text style={selectedSlot === undefined ? styles.slotButtonTextActive : undefined}>すべて</Text>
          </TouchableOpacity>
          {MEAL_SLOTS.map((slot) => (
            <TouchableOpacity
              key={slot}
              testID={`meal-search-slot-${slot}`}
              style={[styles.slotButton, slot === selectedSlot && styles.slotButtonActive]}
              onPress={() => setSelectedSlot(slot)}
            >
              <Text style={slot === selectedSlot ? styles.slotButtonTextActive : undefined}>
                {MEAL_SLOT_LABELS[slot]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.ratingFilterRow}>
          <Text style={styles.ratingFilterLabel}>評価</Text>
          <RatingStars rating={minRating} onChange={setMinRating} size={20} testIDPrefix="meal-search-min-rating" />
          <Text style={styles.ratingFilterHint}>{minRating !== null ? `${minRating}以上` : "すべて"}</Text>
        </View>

        {results.length > 0 ? (
          <TouchableOpacity testID="meal-search-random-button" style={styles.randomButton} onPress={handleRandomPick}>
            <Text style={styles.randomButtonText}>🎲 ランダムに選ぶ({results.length}件から)</Text>
          </TouchableOpacity>
        ) : null}

        {randomPick ? (
          <View style={styles.randomPickCard} testID="meal-search-random-pick">
            <Text style={styles.randomPickLabel}>今日はこれ！</Text>
            <Text style={styles.randomPickTitle}>{randomPick.title}</Text>
            <View style={styles.resultMetaRow}>
              <Text style={styles.randomPickMeta}>{formatMealDateSlotLabel(randomPick.mealDate, randomPick.slot)}</Text>
              <RatingStars rating={randomPick.rating} testIDPrefix="meal-search-random-pick-rating" size={13} />
            </View>
            <View style={styles.randomPickActions}>
              <TouchableOpacity testID="meal-search-random-dismiss" onPress={() => setRandomPick(null)}>
                <Text style={styles.randomPickDismissText}>閉じる</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="meal-search-random-reroll" onPress={handleRandomPick}>
                <Text style={styles.randomPickRerollText}>もう一度</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text>該当する献立がありません</Text>
          </View>
        ) : (
          <FlatList
            testID="meal-search-results"
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MealRow record={item} dateLabel={formatDateLabel(item.mealDate)} onPress={() => openEdit(item)} />
            )}
          />
        )}
      </View>

      <MealFormModal
        target={formTarget}
        calendars={calendars}
        onClose={closeForm}
        onSave={handleSaveEdit}
        onDelete={formTarget?.mode === "edit" ? handleDelete : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    gap: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  slotButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  slotButtonTextActive: {
    color: "#2f6fed",
    fontWeight: "600",
  },
  ratingFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingFilterLabel: {
    color: "#666",
    fontSize: 13,
  },
  ratingFilterHint: {
    color: "#999",
    fontSize: 12,
  },
  randomButton: {
    borderWidth: 1,
    borderColor: "#2f6fed",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  randomButtonText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  // 「今日はこれ！」のサプライズ演出 - 振り返りタブの「n年前の今日」カードと
  // 同じ暖色トーンで、通常の検索結果とは違う特別感を出す。
  randomPickCard: {
    backgroundColor: "#faeeda",
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  randomPickLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a15c00",
  },
  randomPickTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#633806",
  },
  randomPickMeta: {
    color: "#a15c00",
    fontSize: 12,
  },
  randomPickActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 6,
  },
  randomPickDismissText: {
    color: "#a15c00",
  },
  randomPickRerollText: {
    color: "#633806",
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
