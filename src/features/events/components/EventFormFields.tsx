import { useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { Icon } from "../../../shared/components/Icon";
import { RevealableTextField } from "../../../shared/components/RevealableTextField";
import { formatDateOnly } from "../../../shared/utils/formatDateTime";
import { DATE_PICKER_LOCALE } from "../../../shared/utils/pickerLocale";
import { adjustEndForNewStart, jstHourMinute, withJstTime } from "../eventRangeAdjust";
import { applyTimeDigit, applyTimeValue, type TimeField } from "../timeDigits";
import { TimeFieldBox } from "./TimeFieldBox";
import { TimeKeypad } from "./TimeKeypad";

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

type TimeDraft = { hour: number; minute: number };
type Which = "start" | "end";

export function EventFormFields({ testIDPrefix, value, onChange }: EventFormFieldsProps) {
  const [activePicker, setActivePicker] = useState<PickerTarget | null>(null);
  // 時刻はテンキーで入力している途中の値(時・分だけ)を開始・終了それぞれ一旦ここに持ち、
  // 「完了」を押したときに開始・終了をまとめてフォームへ反映する(入力している間に終了時刻の
  // 自動補正が走って値が動き回らないように)。「キャンセル」で全て破棄する。日付(カレンダー)は
  // タップ=選択確定なので即時反映。日付が後から変わっても時刻だけを当てられるよう、日付は持たない。
  const [timeDrafts, setTimeDrafts] = useState<Partial<Record<Which, TimeDraft>>>({});
  // 時刻を入力中の欄(時/分)と、二桁目待ちの十の位。
  const [timeEntry, setTimeEntry] = useState<{ field: TimeField; buffer: string }>({ field: "hour", buffer: "" });

  // キーボードとピッカーは同時に出さない: ピッカーを開くときはキーボードを閉じ、
  // 文字入力欄にフォーカスが当たったときはピッカー(と入力途中の時刻)を閉じる。
  const openPicker = (target: PickerTarget) => {
    Keyboard.dismiss();
    setActivePicker(target);
  };
  const closePicker = () => {
    setTimeDrafts({});
    setActivePicker(null);
  };

  const currentTime = (which: Which): TimeDraft => timeDrafts[which] ?? jstHourMinute(value[which]);

  // 時刻欄をタップすると、その欄(時/分)を編集状態にして、アプリ独自のテンキーを出す。
  const selectTimeField = (which: Which, field: TimeField) => {
    Keyboard.dismiss();
    setActivePicker({ which, part: "time" });
    setTimeEntry({ field, buffer: "" });
  };

  // 入力途中の時刻(開始・終了)をまとめてフォームへ反映する。開始を入力した場合は、
  // 開始が終了より後ろになったとき終了を自動で補正する(終了も入力した場合は、
  // 入力どおりの終了が開始より前のときだけ補正する)。
  const commitTimeDrafts = () => {
    const { start: startDraft, end: endDraft } = timeDrafts;
    if (!startDraft && !endDraft) return;

    const patch: Partial<EventFormValue> = {};
    let newStart = value.start;
    let newEnd = value.end;
    if (startDraft) {
      newStart = withJstTime(value.start, startDraft.hour, startDraft.minute);
      patch.start = newStart;
    }
    if (endDraft) {
      newEnd = withJstTime(value.end, endDraft.hour, endDraft.minute);
    }
    if (startDraft) {
      newEnd = adjustEndForNewStart(newStart, newEnd, value.isAllDay);
    }
    if (newEnd !== value.end) {
      patch.end = newEnd;
    }
    onChange(patch);
  };

  const confirmPicker = () => {
    commitTimeDrafts();
    closePicker();
  };

  const setDraft = (which: Which, next: TimeDraft) => setTimeDrafts((prev) => ({ ...prev, [which]: next }));

  // 開始の分を入力し終えたら、続けて終了の時を入力できるよう終了の時へ移る。
  const moveOnAfterMinute = (which: Which) => {
    if (which === "start") {
      setActivePicker({ which: "end", part: "time" });
      setTimeEntry({ field: "hour", buffer: "" });
    } else {
      setTimeEntry({ field: "minute", buffer: "" });
    }
  };

  // 時/分の欄に値が入った後の進み方: 入力途中(二桁目待ち)ならそのまま、時が終わったら分へ、
  // 分が終わったら(開始なら終了の時へ、終了ならそのまま)。
  const advanceAfter = (which: Which, result: { done: boolean; buffer: string }) => {
    if (!result.done) {
      setTimeEntry({ field: timeEntry.field, buffer: result.buffer });
    } else if (timeEntry.field === "hour") {
      setTimeEntry({ field: "minute", buffer: "" });
    } else {
      moveOnAfterMinute(which);
    }
  };

  const setCurrentField = (which: Which, fieldValue: number) => {
    const current = currentTime(which);
    setDraft(which, timeEntry.field === "hour" ? { ...current, hour: fieldValue } : { ...current, minute: fieldValue });
  };

  const handleDigit = (which: Which, digit: number) => {
    const result = applyTimeDigit(timeEntry.field, timeEntry.buffer, digit);
    if (!result) return;
    setCurrentField(which, result.value);
    advanceAfter(which, result);
  };

  // 「00」「30」キー: 入力中の欄に二桁をそのまま入れる。その欄にあり得ない値(時の「30」)は、
  // 何も変えず、欄も移動しない。
  const handleQuickValue = (which: Which, quickValue: number) => {
    const result = applyTimeValue(timeEntry.field, quickValue);
    if (!result) return;
    setCurrentField(which, result.value);
    advanceAfter(which, result);
  };

  const handlePicked = (which: Which, selected: Date) => {
    if (which === "end") {
      onChange({ end: selected });
      return;
    }
    const adjustedEnd = adjustEndForNewStart(selected, value.end, value.isAllDay);
    onChange(adjustedEnd === value.end ? { start: selected } : { start: selected, end: adjustedEnd });
  };

  const renderColumn = (which: "start" | "end", label: string) => {
    const date = value[which];
    const isDateActive = activePicker?.which === which && activePicker.part === "date";
    const isTimeActive = activePicker?.which === which && activePicker.part === "time";
    const { hour, minute } = currentTime(which);
    return (
      <View style={styles.dateColumn}>
        <Text style={[styles.dateFieldLabel, activePicker?.which === which && styles.dateFieldLabelActive]}>
          {label}
        </Text>
        <TouchableOpacity
          testID={`${testIDPrefix}-${which}-button`}
          style={[styles.dateField, isDateActive && styles.dateFieldActive]}
          onPress={() => openPicker({ which, part: "date" })}
        >
          <Text>{formatDateOnly(date.toISOString())}</Text>
        </TouchableOpacity>
        {value.isAllDay ? null : (
          <TimeFieldBox
            testIDPrefix={`${testIDPrefix}-${which}-time`}
            hour={hour}
            minute={minute}
            activeField={isTimeActive ? timeEntry.field : null}
            onSelectField={(field) => selectTimeField(which, field)}
          />
        )}
      </View>
    );
  };

  const pickerTestID = activePicker ? `${testIDPrefix}-${activePicker.which}-picker` : undefined;

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

      <View style={styles.dateRow}>
        {renderColumn("start", "開始")}
        <Icon name="chevron-right" size={14} color="#999" />
        {renderColumn("end", "終了")}
      </View>

      {activePicker?.part === "time" ? (
        <TimeKeypad
          testIDPrefix={`${testIDPrefix}-keypad`}
          doneTestID={`${testIDPrefix}-picker-done`}
          onDigit={(digit) => handleDigit(activePicker.which, digit)}
          onQuickValue={(quickValue) => handleQuickValue(activePicker.which, quickValue)}
          cancelTestID={`${testIDPrefix}-picker-cancel`}
          onDone={confirmPicker}
          onCancel={closePicker}
        />
      ) : null}

      {activePicker?.part === "date" ? (
        <View style={styles.pickerContainer}>
          {Platform.OS === "web" ? (
            <TextInput
              testID={pickerTestID}
              style={styles.input}
              placeholder="YYYY-MM-DD"
              onChangeText={(text) => {
                const parsed = new Date(`${text}T00:00:00.000Z`);
                if (!Number.isNaN(parsed.getTime())) {
                  handlePicked(activePicker.which, parsed);
                }
              }}
            />
          ) : (
            <DateTimePicker
              testID={pickerTestID}
              value={value[activePicker.which]}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
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
            onPress={confirmPicker}
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
  dateColumn: {
    flex: 1,
    gap: 6,
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
  dateFieldActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  dateFieldLabel: {
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
