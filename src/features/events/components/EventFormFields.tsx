import { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { formatDateTime } from "../../../shared/utils/formatDateTime";

export interface EventFormValue {
  title: string;
  isAllDay: boolean;
  start: Date;
  end: Date;
  location: string;
  url: string;
  categoryColor: string;
}

export const CATEGORY_COLORS: { name: string; hex: string }[] = [
  { name: "blue", hex: "#2f6fed" },
  { name: "red", hex: "#e53935" },
  { name: "green", hex: "#43a047" },
  { name: "orange", hex: "#fb8c00" },
  { name: "purple", hex: "#8e24aa" },
];

function formatFieldLabel(date: Date): string {
  return formatDateTime(date.toISOString());
}

export interface EventFormFieldsProps {
  testIDPrefix: string;
  value: EventFormValue;
  onChange: (patch: Partial<EventFormValue>) => void;
}

export function EventFormFields({ testIDPrefix, value, onChange }: EventFormFieldsProps) {
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(null);

  return (
    <>
      <TextInput
        testID={`${testIDPrefix}-title-input`}
        style={styles.input}
        placeholder="タイトル"
        value={value.title}
        onChangeText={(title) => onChange({ title })}
      />

      <TouchableOpacity
        testID={`${testIDPrefix}-allday-toggle`}
        style={styles.alldayRow}
        onPress={() => onChange({ isAllDay: !value.isAllDay })}
      >
        <Text>終日</Text>
        {value.isAllDay ? <Text testID={`${testIDPrefix}-allday-checked`}>✓</Text> : null}
      </TouchableOpacity>

      <TouchableOpacity
        testID={`${testIDPrefix}-start-button`}
        style={styles.dateField}
        onPress={() => setActivePicker("start")}
      >
        <Text style={styles.dateFieldLabel}>開始</Text>
        <Text>{formatFieldLabel(value.start)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID={`${testIDPrefix}-end-button`}
        style={styles.dateField}
        onPress={() => setActivePicker("end")}
      >
        <Text style={styles.dateFieldLabel}>終了</Text>
        <Text>{formatFieldLabel(value.end)}</Text>
      </TouchableOpacity>

      {activePicker ? (
        <View style={styles.pickerContainer}>
          {Platform.OS === "web" ? (
            <TextInput
              testID={activePicker === "start" ? `${testIDPrefix}-start-picker` : `${testIDPrefix}-end-picker`}
              style={styles.input}
              placeholder={value.isAllDay ? "YYYY-MM-DD" : "YYYY-MM-DDTHH:mm"}
              onChangeText={(text) => {
                const parsed = new Date(value.isAllDay ? `${text}T00:00:00.000Z` : `${text}:00.000Z`);
                if (!Number.isNaN(parsed.getTime())) {
                  onChange(activePicker === "start" ? { start: parsed } : { end: parsed });
                }
              }}
            />
          ) : (
            <DateTimePicker
              testID={activePicker === "start" ? `${testIDPrefix}-start-picker` : `${testIDPrefix}-end-picker`}
              value={activePicker === "start" ? value.start : value.end}
              mode={value.isAllDay ? "date" : "datetime"}
              onChange={(_event: unknown, selected?: Date) => {
                if (selected) {
                  onChange(activePicker === "start" ? { start: selected } : { end: selected });
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

      <TextInput
        testID={`${testIDPrefix}-location-input`}
        style={styles.input}
        placeholder="場所"
        value={value.location}
        onChangeText={(location) => onChange({ location })}
      />

      <TextInput
        testID={`${testIDPrefix}-url-input`}
        style={styles.input}
        placeholder="URL"
        autoCapitalize="none"
        keyboardType="url"
        value={value.url}
        onChangeText={(url) => onChange({ url })}
      />

      <View style={styles.colorRow}>
        {CATEGORY_COLORS.map((color) => (
          <TouchableOpacity
            key={color.name}
            testID={`${testIDPrefix}-color-${color.name}`}
            style={[
              styles.colorSwatch,
              { backgroundColor: color.hex },
              value.categoryColor === color.hex && styles.colorSwatchSelected,
            ]}
            onPress={() => onChange({ categoryColor: color.hex })}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
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
  dateField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFieldLabel: {
    color: "#666",
  },
  pickerContainer: {
    gap: 8,
    alignItems: "flex-end",
  },
  pickerDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: "#333",
  },
});
