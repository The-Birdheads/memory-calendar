import { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { RevealableTextField } from "../../../shared/components/RevealableTextField";
import { formatDateOnly, formatDateTime } from "../../../shared/utils/formatDateTime";

export interface EventFormValue {
  title: string;
  isAllDay: boolean;
  start: Date;
  end: Date;
  location: string;
  url: string;
}

function formatFieldLabel(date: Date, isAllDay: boolean): string {
  return isAllDay ? formatDateOnly(date.toISOString()) : formatDateTime(date.toISOString());
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
        activeOpacity={0.7}
        onPress={() => onChange({ isAllDay: !value.isAllDay })}
      >
        <Text>終日</Text>
        <View
          testID={`${testIDPrefix}-allday-switch`}
          style={[styles.switchTrack, value.isAllDay && styles.switchTrackOn]}
        >
          <View style={[styles.switchThumb, value.isAllDay && styles.switchThumbOn]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        testID={`${testIDPrefix}-start-button`}
        style={styles.dateField}
        onPress={() => setActivePicker("start")}
      >
        <Text style={styles.dateFieldLabel}>開始</Text>
        <Text>{formatFieldLabel(value.start, value.isAllDay)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID={`${testIDPrefix}-end-button`}
        style={styles.dateField}
        onPress={() => setActivePicker("end")}
      >
        <Text style={styles.dateFieldLabel}>終了</Text>
        <Text>{formatFieldLabel(value.end, value.isAllDay)}</Text>
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

      <RevealableTextField
        testID={`${testIDPrefix}-location-input`}
        addButtonTestID={`${testIDPrefix}-location-add`}
        addLabel="場所を追加"
        placeholder="場所"
        value={value.location}
        onChangeText={(location) => onChange({ location })}
      />

      <RevealableTextField
        testID={`${testIDPrefix}-url-input`}
        addButtonTestID={`${testIDPrefix}-url-add`}
        addLabel="URLを追加"
        placeholder="URL"
        autoCapitalize="none"
        keyboardType="url"
        value={value.url}
        onChangeText={(url) => onChange({ url })}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  switchTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#d8d8dc",
    padding: 2,
    justifyContent: "center",
  },
  switchTrackOn: {
    backgroundColor: "#2f6fed",
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  switchThumbOn: {
    transform: [{ translateX: 18 }],
  },
  dateField: {
    backgroundColor: "#fff",
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
});
