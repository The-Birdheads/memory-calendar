import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type {
  EventReminder,
  EventReminderCustomOffset,
  EventReminderKind,
  EventReminderUnit,
} from "../types";

export interface ReminderOption {
  kind: Exclude<EventReminderKind, "custom">;
  label: string;
}

// ToDoのリマインド(TodoReminderPicker)も同じ選択肢・ラベル・カスタム
// ピッカーを再利用するので、このファイルの外からも参照できるよう export する。
export const ALL_DAY_OPTIONS: ReminderOption[] = [
  { kind: "on_day", label: "当日" },
  { kind: "day_before_1", label: "1日前" },
  { kind: "day_before_2", label: "2日前" },
];

export const TIMED_OPTIONS: ReminderOption[] = [
  { kind: "at_start", label: "開始時" },
  { kind: "before_10m", label: "10分前" },
  { kind: "before_1h", label: "1時間前" },
];

export const UNIT_LABELS: Record<EventReminderUnit, string> = {
  minute: "分",
  hour: "時間",
  day: "日",
  week: "週間",
};

export const UNIT_OPTIONS: EventReminderUnit[] = ["minute", "hour", "day", "week"];
// TimeTree等の参考実装同様、値は分/時間/日/週間の単位に関わらず一律1〜24。
export const VALUE_OPTIONS: number[] = Array.from({ length: 24 }, (_, i) => i + 1);

export function formatCustomLabel(value: number, unit: EventReminderUnit): string {
  return `${value}${UNIT_LABELS[unit]}前`;
}

export interface EventReminderPickerProps {
  testIDPrefix: string;
  isAllDay: boolean;
  /** The current user's own reminders for this event (personal - never other members'). */
  reminders: EventReminder[];
  onAdd: (kind: EventReminderKind, custom?: EventReminderCustomOffset) => void;
  /** Removes one specific reminder - a whole EventReminder (not just its
   * kind) is required because several "custom" reminders can coexist. */
  onRemove: (reminder: EventReminder) => void;
}

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 3;

interface WheelColumnProps<T> {
  testID: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  renderLabel: (value: T) => string;
}

/** A scrollable "wheel" column of options - slide to browse, tap a row to
 * jump straight to it. Used for both the number and the unit columns of the
 * custom-reminder picker. */
export function WheelColumn<T>({ testID, options, value, onChange, renderLabel }: WheelColumnProps<T>) {
  return (
    <ScrollView
      testID={testID}
      style={styles.wheelColumn}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
    >
      {options.map((option, index) => {
        const selected = option === value;
        return (
          <TouchableOpacity
            key={index}
            testID={`${testID}-option-${String(option)}`}
            style={styles.wheelRow}
            onPress={() => onChange(option)}
          >
            <Text style={selected ? styles.wheelOptionSelected : styles.wheelOption}>{renderLabel(option)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function EventReminderPicker({
  testIDPrefix,
  isAllDay,
  reminders,
  onAdd,
  onRemove,
}: EventReminderPickerProps) {
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [customValueDraft, setCustomValueDraft] = useState(10);
  const [customUnitDraft, setCustomUnitDraft] = useState<EventReminderUnit>("minute");

  const options = isAllDay ? ALL_DAY_OPTIONS : TIMED_OPTIONS;
  const customReminders = reminders.filter((reminder) => reminder.kind === "custom");

  const handlePressOption = (kind: Exclude<EventReminderKind, "custom">) => {
    const existing = reminders.find((reminder) => reminder.kind === kind);
    if (existing) {
      onRemove(existing);
    } else {
      onAdd(kind);
    }
  };

  const handleOpenCustomPicker = () => {
    setCustomValueDraft(10);
    setCustomUnitDraft("minute");
    setIsCustomPickerOpen(true);
  };

  const handleConfirmCustom = () => {
    onAdd("custom", { value: customValueDraft, unit: customUnitDraft });
    setIsCustomPickerOpen(false);
  };

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const checked = reminders.some((reminder) => reminder.kind === option.kind);
        return (
          <TouchableOpacity
            key={option.kind}
            testID={`${testIDPrefix}-option-${option.kind}`}
            style={styles.row}
            onPress={() => handlePressOption(option.kind)}
          >
            <Text>{option.label}</Text>
            {checked ? <Text testID={`${testIDPrefix}-option-${option.kind}-checked`}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}

      {customReminders.map((reminder) => (
        <TouchableOpacity
          key={reminder.id}
          testID={`${testIDPrefix}-custom-${reminder.id}`}
          style={styles.row}
          onPress={() => onRemove(reminder)}
        >
          <Text>{formatCustomLabel(reminder.customValue as number, reminder.customUnit as EventReminderUnit)}</Text>
          <Text testID={`${testIDPrefix}-custom-${reminder.id}-checked`}>✓</Text>
        </TouchableOpacity>
      ))}

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
            <Text style={styles.customPickerConfirmText}>確認</Text>
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
  wheelColumn: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    width: 80,
  },
  wheelRow: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelOption: {
    color: "#999",
    fontSize: 16,
  },
  wheelOptionSelected: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 18,
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
