import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { RatingStars } from "./RatingStars";
import type { MealRecord, MealSlot } from "../types";
import { Icon } from "../../../shared/components/Icon";

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

export interface MealRowProps {
  record: MealRecord;
  onPress: () => void;
  /**
   * 献立タブの一覧は日付見出しの下に並ぶので行自体に日付は出さないが、
   * 献立をさがす画面の検索結果は日付がバラバラなまま並ぶため、日付見出しで
   * まとめる代わりに行の中に短い日付ラベル(例: "2026/09/01")を添える。
   */
  dateLabel?: string;
}

/** 献立1件分の行 - 献立タブ(予定/記録パネル)と献立をさがす画面の検索結果、
 * どちらも同じ見た目・同じ「タップで編集」の挙動にするための共通部品。 */
export function MealRow({ record, onPress, dateLabel }: MealRowProps) {
  return (
    <TouchableOpacity testID={`meal-item-${record.id}`} style={styles.mealRow} onPress={onPress}>
      <View style={styles.mealRowSlotChip}>
        <Text style={styles.mealRowSlotText}>{MEAL_SLOT_LABELS[record.slot]}</Text>
      </View>
      <View style={styles.mealRowInfo}>
        <Text style={styles.mealRowTitle} numberOfLines={1}>
          {record.title}
        </Text>
        <View style={styles.mealRowMetaRow}>
          {dateLabel ? <Text style={styles.mealRowDateLabel}>{dateLabel}</Text> : null}
          <RatingStars rating={record.rating} testIDPrefix={`meal-item-rating-${record.id}`} size={12} />
          {record.url ? <Icon testID={`meal-url-icon-${record.id}`} name="link" size={12} color="#2f6fed" /> : null}
          {record.memo ? <Icon testID={`meal-memo-icon-${record.id}`} name="note" size={12} color="#666" /> : null}
        </View>
      </View>
      <Icon name="chevron-right" size={14} color="#ccc" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  mealRowSlotChip: {
    backgroundColor: "#f2f3f5",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mealRowSlotText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#666",
  },
  mealRowInfo: {
    flex: 1,
    gap: 3,
  },
  mealRowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  mealRowMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mealRowDateLabel: {
    fontSize: 12,
    color: "#999",
  },
});
