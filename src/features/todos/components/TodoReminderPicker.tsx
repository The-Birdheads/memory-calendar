import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import {
  ALL_DAY_OPTIONS,
  TIMED_OPTIONS,
  UNIT_LABELS,
  UNIT_OPTIONS,
  VALUE_OPTIONS,
  WheelColumn,
  formatCustomLabel,
} from "../../events/components/EventReminderPicker";
import { computeEventReminderAt } from "../../events/reminderCompute";
import type { EventReminderUnit } from "../../events/types";
import { formatDateTime } from "../../../shared/utils/formatDateTime";

export interface TodoReminderPickerProps {
  testIDPrefix: string;
  /** 紐づく予定が終日かどうか - 選択肢の出し分けは予定のリマインドと同じ基準。 */
  isAllDay: boolean;
  /** 紐づく予定の開始時刻 - 選択肢から実際の通知時刻を計算する基準。 */
  eventStartAt: string;
  /** ToDo自体は1件しかリマインドを持てない(`todos.reminder_at`)ので、
   * 予定のリマインドのような複数選択ではなく単一選択。nullは未設定。 */
  reminderAt: string | null;
  /** 選択された結果の絶対時刻を渡す。既に選ばれている選択肢を再度押すと
   * nullを渡す(解除)。 */
  onChange: (reminderAt: string | null) => void;
}

/**
 * 予定のリマインド(EventReminderPicker)と同じ選択肢・見た目を使う、ToDo用の
 * リマインド選択UI。予定側は「N件を自由に追加/削除できるリスト」だが、ToDo
 * 側は`reminder_at`1件だけの単一選択なので、押した選択肢がそのまま現在値を
 * 置き換える(既に選ばれているものをもう一度押すと解除)という単一選択の
 * 挙動にしている。ISO日時を直接入力させていた旧UIを置き換える(2026-09)。
 */
export function TodoReminderPicker({
  testIDPrefix,
  isAllDay,
  eventStartAt,
  reminderAt,
  onChange,
}: TodoReminderPickerProps) {
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [customValueDraft, setCustomValueDraft] = useState(10);
  const [customUnitDraft, setCustomUnitDraft] = useState<EventReminderUnit>("minute");

  const options = isAllDay ? ALL_DAY_OPTIONS : TIMED_OPTIONS;
  const optionValues = options.map((option) => computeEventReminderAt(option.kind, eventStartAt));
  // 選択中の値がプリセットのどれとも一致しない場合、カスタムで設定された
  // ものとみなす(具体的なN分/時間/日/週間の組み合わせまでは復元できない
  // ので、日時そのものを表示する)。
  const matchesCustomFallback = reminderAt !== null && !optionValues.includes(reminderAt);

  const handlePressOption = (candidate: string) => {
    onChange(reminderAt === candidate ? null : candidate);
  };

  const handleOpenCustomPicker = () => {
    setCustomValueDraft(10);
    setCustomUnitDraft("minute");
    setIsCustomPickerOpen(true);
  };

  const handleConfirmCustom = () => {
    onChange(computeEventReminderAt("custom", eventStartAt, { value: customValueDraft, unit: customUnitDraft }));
    setIsCustomPickerOpen(false);
  };

  return (
    <View style={styles.container}>
      {options.map((option, index) => {
        const candidate = optionValues[index];
        const checked = reminderAt === candidate;
        return (
          <TouchableOpacity
            key={option.kind}
            testID={`${testIDPrefix}-option-${option.kind}`}
            style={styles.row}
            onPress={() => handlePressOption(candidate)}
          >
            <Text>{option.label}</Text>
            {checked ? <Text testID={`${testIDPrefix}-option-${option.kind}-checked`}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}

      {matchesCustomFallback ? (
        <TouchableOpacity
          testID={`${testIDPrefix}-custom-current`}
          style={styles.row}
          onPress={() => onChange(null)}
        >
          <Text>{formatDateTime(reminderAt as string)}</Text>
          <Text testID={`${testIDPrefix}-custom-current-checked`}>✓</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity testID={`${testIDPrefix}-option-custom`} style={styles.row} onPress={handleOpenCustomPicker}>
        <Text>カスタム時刻...</Text>
      </TouchableOpacity>

      {isCustomPickerOpen ? (
        <View style={styles.customPickerContainer}>
          <Text style={styles.customPickerLabel}>通知を受け取る時間を設定してください</Text>
          <View style={styles.wheelRowContainer}>
            <WheelColumn
              testID={`${testIDPrefix}-custom-value-picker`}
              options={VALUE_OPTIONS}
              value={customValueDraft}
              onChange={setCustomValueDraft}
              renderLabel={(v) => String(v)}
            />
            <WheelColumn
              testID={`${testIDPrefix}-custom-unit-picker`}
              options={UNIT_OPTIONS}
              value={customUnitDraft}
              onChange={setCustomUnitDraft}
              renderLabel={(u) => UNIT_LABELS[u]}
            />
          </View>
          <TouchableOpacity
            testID={`${testIDPrefix}-custom-picker-confirm`}
            style={styles.customPickerConfirmButton}
            onPress={handleConfirmCustom}
          >
            <Text style={styles.customPickerConfirmText}>
              {formatCustomLabel(customValueDraft, customUnitDraft)}に設定
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  customPickerContainer: {
    gap: 8,
    alignItems: "center",
    paddingVertical: 8,
  },
  customPickerLabel: {
    color: "#666",
    fontSize: 12,
  },
  wheelRowContainer: {
    flexDirection: "row",
    gap: 24,
  },
  customPickerConfirmButton: {
    backgroundColor: "#2f6fed",
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  customPickerConfirmText: {
    color: "#fff",
    fontWeight: "700",
  },
});
