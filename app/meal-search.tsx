import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { useMealRecords } from "../src/features/meals/hooks";
import type { MealSlot } from "../src/features/meals/types";
import { Icon } from "../src/shared/components/Icon";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

const MAX_SUGGESTIONS = 5;

/** "YYYY-MM-DD" (already a plain date, no time) + the slot label, e.g. "2026/9/1 昼食". */
function formatMealDateSlotLabel(mealDate: string, slot: MealSlot): string {
  return `${mealDate.replace(/-/g, "/")} ${MEAL_SLOT_LABELS[slot]}`;
}

export default function MealSearchScreen() {
  const { calendarId } = useLocalSearchParams<{ calendarId?: string }>();
  const activeCalendarId = calendarId ?? "";

  const [selectedSlot, setSelectedSlot] = useState<MealSlot | undefined>(undefined);
  const filter = selectedSlot ? { slot: selectedSlot } : undefined;
  const { mealRecords } = useMealRecords(activeCalendarId, filter);

  const [query, setQuery] = useState("");

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
    if (!normalizedQuery) return mealRecords;
    return mealRecords.filter((record) => record.title.toLowerCase().includes(normalizedQuery));
  }, [mealRecords, normalizedQuery]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "献立を検索", headerBackButtonDisplayMode: "minimal" }} />
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
              <View style={styles.resultRow} testID={`meal-search-result-${item.id}`}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <View style={styles.resultMetaRow}>
                  <Text style={styles.meta}>{formatMealDateSlotLabel(item.mealDate, item.slot)}</Text>
                  {item.url ? (
                    <Icon testID={`meal-search-result-url-icon-${item.id}`} name="link" size={12} color="#2f6fed" />
                  ) : null}
                  {item.memo ? (
                    <Icon testID={`meal-search-result-memo-icon-${item.id}`} name="note" size={12} color="#666" />
                  ) : null}
                </View>
              </View>
            )}
          />
        )}
      </View>
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resultRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
    gap: 2,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
});
