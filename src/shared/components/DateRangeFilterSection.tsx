import { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { jstNow } from "../utils/formatDateTime";
import { DATE_PICKER_LOCALE } from "../utils/pickerLocale";

function todayDateKey(): string {
  return jstNow().toISOString().slice(0, 10);
}

export interface DateRangeFilterSectionProps {
  testIDPrefix: string;
  /** JST日付キー("YYYY-MM-DD")。両方nullなら絞り込みなし。 */
  startDate: string | null;
  endDate: string | null;
  onChange: (range: { startDate: string | null; endDate: string | null }) => void;
}

/**
 * 「期間」フィルター(開始日〜終了日)。ToDo/振り返り(年表)/献立(記録)タブの
 * 共通フィルターシートで使う(カレンダー画面は月送りで期間を選ぶため対象外)。
 * 「すべて」で両方nullに戻し、有効化すると今日を起点に開始日・終了日を
 * それぞれ個別のネイティブ日付ピッカーで選び直せる。
 */
export function DateRangeFilterSection({ testIDPrefix, startDate, endDate, onChange }: DateRangeFilterSectionProps) {
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);
  const isFiltering = startDate !== null || endDate !== null;

  const handleClear = () => {
    setActivePicker(null);
    onChange({ startDate: null, endDate: null });
  };

  const handleEnable = () => {
    const today = todayDateKey();
    onChange({ startDate: today, endDate: today });
  };

  const handlePickDate = (field: "start" | "end", dateKey: string) => {
    onChange(field === "start" ? { startDate: dateKey, endDate } : { startDate, endDate: dateKey });
  };

  const activeDateKey = (activePicker === "start" ? startDate : endDate) ?? todayDateKey();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          testID={`${testIDPrefix}-all`}
          onPress={handleClear}
          style={[styles.chip, !isFiltering && styles.chipActive]}
        >
          <Text style={!isFiltering ? styles.chipTextActive : styles.chipText}>すべて</Text>
        </TouchableOpacity>

        {isFiltering ? (
          <>
            <TouchableOpacity
              testID={`${testIDPrefix}-start-button`}
              style={[styles.chip, styles.chipActive]}
              onPress={() => setActivePicker("start")}
            >
              <Text style={styles.chipTextActive}>開始 {startDate ?? "未設定"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`${testIDPrefix}-end-button`}
              style={[styles.chip, styles.chipActive]}
              onPress={() => setActivePicker("end")}
            >
              <Text style={styles.chipTextActive}>終了 {endDate ?? "未設定"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity testID={`${testIDPrefix}-enable`} onPress={handleEnable} style={styles.chip}>
            <Text style={styles.chipText}>期間で絞り込む</Text>
          </TouchableOpacity>
        )}
      </View>

      {activePicker ? (
        <View style={styles.pickerContainer}>
          {Platform.OS === "web" ? (
            <TextInput
              testID={activePicker === "start" ? `${testIDPrefix}-start-picker` : `${testIDPrefix}-end-picker`}
              style={styles.input}
              placeholder="YYYY-MM-DD"
              onChangeText={(text) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                  handlePickDate(activePicker, text);
                }
              }}
            />
          ) : (
            <DateTimePicker
              testID={activePicker === "start" ? `${testIDPrefix}-start-picker` : `${testIDPrefix}-end-picker`}
              value={new Date(`${activeDateKey}T00:00:00.000Z`)}
              mode="date"
              locale={DATE_PICKER_LOCALE}
              onChange={(_event: unknown, selected?: Date) => {
                if (selected) {
                  handlePickDate(activePicker, selected.toISOString().slice(0, 10));
                }
              }}
            />
          )}
          <TouchableOpacity
            testID={`${testIDPrefix}-picker-done`}
            style={styles.pickerDoneButton}
            onPress={() => setActivePicker(null)}
          >
            <Text>完了</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 15,
    color: "#444",
  },
  chipTextActive: {
    fontSize: 15,
    color: "#0c447c",
    fontWeight: "700",
  },
  pickerContainer: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  pickerDoneButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
