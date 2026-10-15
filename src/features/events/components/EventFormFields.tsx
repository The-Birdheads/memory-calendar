import { useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { RevealableTextField } from "../../../shared/components/RevealableTextField";
import { formatDateOnly, formatTime } from "../../../shared/utils/formatDateTime";
import { DATE_PICKER_LOCALE } from "../../../shared/utils/pickerLocale";
import { adjustEndForNewStart } from "../eventRangeAdjust";

export interface EventFormValue {
  title: string;
  isAllDay: boolean;
  start: Date;
  end: Date;
  location: string;
  url: string;
  memo: string;
}

export interface EventFormFieldsProps {
  testIDPrefix: string;
  value: EventFormValue;
  onChange: (patch: Partial<EventFormValue>) => void;
}

type PickerTarget = { which: "start" | "end"; part: "date" | "time" };

export function EventFormFields({ testIDPrefix, value, onChange }: EventFormFieldsProps) {
  const [activePicker, setActivePicker] = useState<PickerTarget | null>(null);

  // キーボードとピッカーは同時に出さない: ピッカーを開くときはキーボードを閉じ、
  // 文字入力欄にフォーカスが当たったときはピッカーを閉じる。
  const openPicker = (target: PickerTarget) => {
    Keyboard.dismiss();
    setActivePicker(target);
  };
  const closePicker = () => setActivePicker(null);

  const handlePicked = (which: "start" | "end", selected: Date) => {
    if (which === "end") {
      onChange({ end: selected });
      return;
    }
    const adjustedEnd = adjustEndForNewStart(selected, value.end, value.isAllDay);
    onChange(adjustedEnd === value.end ? { start: selected } : { start: selected, end: adjustedEnd });
  };

  const renderRow = (which: "start" | "end", label: string) => {
    const date = value[which];
    const isActive = (part: "date" | "time") => activePicker?.which === which && activePicker.part === part;
    return (
      <View style={styles.dateRow}>
        <Text style={[styles.dateFieldLabel, activePicker?.which === which && styles.dateFieldLabelActive]}>
          {label}
        </Text>
        <TouchableOpacity
          testID={`${testIDPrefix}-${which}-button`}
          style={[styles.dateField, styles.dateFieldDate, isActive("date") && styles.dateFieldActive]}
          onPress={() => openPicker({ which, part: "date" })}
        >
          <Text>{formatDateOnly(date.toISOString())}</Text>
        </TouchableOpacity>
        {value.isAllDay ? null : (
          <TouchableOpacity
            testID={`${testIDPrefix}-${which}-time-button`}
            style={[styles.dateField, isActive("time") && styles.dateFieldActive]}
            onPress={() => openPicker({ which, part: "time" })}
          >
            <Text>{formatTime(date.toISOString())}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const pickerTestID = activePicker
    ? `${testIDPrefix}-${activePicker.which}-${activePicker.part === "time" ? "time-" : ""}picker`
    : undefined;

  return (
    <>
      <TextInput
        testID={`${testIDPrefix}-title-input`}
        style={styles.input}
        placeholder="タイトル"
        value={value.title}
        onChangeText={(title) => onChange({ title })}
        onFocus={closePicker}
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

      {renderRow("start", "開始")}
      {renderRow("end", "終了")}

      {activePicker ? (
        <View style={styles.pickerContainer}>
          {Platform.OS === "web" ? (
            <TextInput
              testID={pickerTestID}
              style={styles.input}
              placeholder={value.isAllDay ? "YYYY-MM-DD" : "YYYY-MM-DDTHH:mm"}
              onChangeText={(text) => {
                const parsed = new Date(value.isAllDay ? `${text}T00:00:00.000Z` : `${text}:00.000Z`);
                if (!Number.isNaN(parsed.getTime())) {
                  handlePicked(activePicker.which, parsed);
                }
              }}
            />
          ) : (
            <DateTimePicker
              testID={pickerTestID}
              value={value[activePicker.which]}
              mode={activePicker.part}
              display={Platform.OS === "ios" ? (activePicker.part === "time" ? "spinner" : "inline") : "default"}
              locale={DATE_PICKER_LOCALE}
              onChange={(_event: unknown, selected?: Date) => {
                if (selected) {
                  handlePicked(activePicker.which, selected);
                }
              }}
            />
          )}
          <TouchableOpacity
            testID={`${testIDPrefix}-picker-done`}
            style={styles.pickerDoneButton}
            onPress={closePicker}
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
        onFocus={closePicker}
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
        onFocus={closePicker}
      />

      <RevealableTextField
        testID={`${testIDPrefix}-memo-input`}
        addButtonTestID={`${testIDPrefix}-memo-add`}
        addLabel="メモを追加"
        placeholder="メモ"
        multiline
        value={value.memo}
        onChangeText={(memo) => onChange({ memo })}
        onFocus={closePicker}
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
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateField: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFieldDate: {
    flex: 1,
  },
  dateFieldActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  dateFieldLabel: {
    width: 32,
    color: "#666",
  },
  dateFieldLabelActive: {
    color: "#0c447c",
    fontWeight: "700",
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
