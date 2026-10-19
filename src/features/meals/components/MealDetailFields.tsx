import { useState, type ReactNode } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { MEAL_SLOT_ICONS, MEAL_SLOT_LABELS } from "./MealRow";
import { RatingStars } from "./RatingStars";
import { mealDateKeyFromPicked, mealDateToPickerValue } from "../mealDate";
import type { MealSlot } from "../types";
import { CalendarLabel } from "../../calendars/components/CalendarLabel";
import { CalendarSwitchChip } from "../../calendars/components/CalendarSwitchChip";
import type { Calendar } from "../../calendars/types";
import { Icon } from "../../../shared/components/Icon";
import { formatDateOnly } from "../../../shared/utils/formatDateTime";
import { DATE_PICKER_LOCALE } from "../../../shared/utils/pickerLocale";
import type { MealFormValues } from "./MealFormModal";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

type FieldKey = "calendar" | "title" | "slot" | "date" | "rating" | "url" | "memo";

export interface MealDetailFieldsProps {
  initialValues: MealFormValues;
  calendars: Calendar[];
  /** その項目だけを保存する。成功(true)したら編集を閉じ、失敗(false)なら開いたままにする。 */
  onUpdateField: (patch: Partial<MealFormValues>) => Promise<boolean>;
  /** 保存処理が実行中かどうか(実行中は✓を押せない)。 */
  isSaving?: boolean;
}

interface FieldRowProps {
  field: FieldKey;
  label: string;
  display: ReactNode;
  editor: ReactNode;
  isEditing: boolean;
  /** false なら鉛筆を出さない(読み取り専用の項目)。 */
  editable?: boolean;
  canConfirm?: boolean;
  isSaving?: boolean;
  onStartEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 項目名 + 平文表示 + 鉛筆。鉛筆を押すとその項目だけが編集状態になり、✓(保存)/✕(取り消し)が出る。 */
function FieldRow({
  field,
  label,
  display,
  editor,
  isEditing,
  editable = true,
  canConfirm = true,
  isSaving,
  onStartEdit,
  onConfirm,
  onCancel,
}: FieldRowProps) {
  const confirmDisabled = !canConfirm || !!isSaving;
  return (
    <View style={styles.field} testID={`meal-detail-${field}`}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {isEditing ? (
        <View key="editor" style={styles.editorBlock}>
          {editor}
          <View style={styles.editorActions}>
            <TouchableOpacity
              testID={`meal-detail-${field}-cancel`}
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`meal-detail-${field}-confirm`}
              onPress={onConfirm}
              disabled={confirmDisabled}
              accessibilityState={{ disabled: confirmDisabled }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.confirmCheck, confirmDisabled && styles.confirmCheckDisabled]}>✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View key="display" style={styles.displayRow}>
          <View style={styles.displayValue}>{display}</View>
          {editable ? (
            <TouchableOpacity
              testID={`meal-detail-${field}-edit`}
              onPress={onStartEdit}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="edit" size={18} color="#2f6fed" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

function PlainText({ value }: { value: string }) {
  return value ? <Text style={styles.valueText}>{value}</Text> : <Text style={styles.unsetText}>未設定</Text>;
}

/**
 * 献立の詳細(編集モード)の中身。アプリ全体(タグ編集・カレンダー設定など)と
 * 同じく、各項目を「項目名 + 平文表示 + 鉛筆アイコン」で見せ、鉛筆を押した項目
 * だけを編集状態にして、項目単位の✓(その場で保存)/✕(取り消し)で確定する。
 * 編集中の項目は同時に1つだけ(別の項目の鉛筆を押すと、編集中の入力は破棄)。
 */
export function MealDetailFields({ initialValues, calendars, onUpdateField, isSaving }: MealDetailFieldsProps) {
  const [values, setValues] = useState(initialValues);
  const [editingField, setEditingField] = useState<FieldKey | null>(null);

  const [calendarDraft, setCalendarDraft] = useState(initialValues.calendarId);
  const [titleDraft, setTitleDraft] = useState(initialValues.title);
  const [slotDraft, setSlotDraft] = useState<MealSlot>(initialValues.slot);
  const [dateDraft, setDateDraft] = useState(() => mealDateToPickerValue(initialValues.mealDate));
  const [ratingDraft, setRatingDraft] = useState<number | null>(initialValues.rating);
  const [urlDraft, setUrlDraft] = useState(initialValues.url);
  const [memoDraft, setMemoDraft] = useState(initialValues.memo);

  const startEdit = (field: FieldKey) => {
    // 開き直すたびに、いま保存されている値から編集を始める。
    setCalendarDraft(values.calendarId);
    setTitleDraft(values.title);
    setSlotDraft(values.slot);
    setDateDraft(mealDateToPickerValue(values.mealDate));
    setRatingDraft(values.rating);
    setUrlDraft(values.url);
    setMemoDraft(values.memo);
    setEditingField(field);
  };
  const cancelEdit = () => setEditingField(null);

  const confirmEdit = async (patch: Partial<MealFormValues>) => {
    if (isSaving) return;
    const success = await onUpdateField(patch);
    if (success) {
      setValues((prev) => ({ ...prev, ...patch }));
      setEditingField(null);
    }
  };

  const selectedCalendar = calendars.find((calendar) => calendar.id === values.calendarId) ?? null;
  const editableCalendar = calendars.length > 1;
  const rowProps = (field: FieldKey) => ({
    field,
    isEditing: editingField === field,
    isSaving,
    onStartEdit: () => startEdit(field),
    onCancel: cancelEdit,
  });

  return (
    <View style={styles.container}>
      <FieldRow
        {...rowProps("calendar")}
        label="カレンダー"
        editable={editableCalendar}
        display={selectedCalendar ? <CalendarLabel calendar={selectedCalendar} textStyle={styles.valueText} /> : <PlainText value="" />}
        editor={
          <View style={styles.calendarChipRow} testID="meal-form-calendar-picker">
            {calendars.map((calendar) => (
              <CalendarSwitchChip
                key={calendar.id}
                testID={`meal-form-calendar-${calendar.id}`}
                calendar={calendar}
                isActive={calendar.id === calendarDraft}
                onPress={() => setCalendarDraft(calendar.id)}
              />
            ))}
          </View>
        }
        onConfirm={() => confirmEdit({ calendarId: calendarDraft })}
      />

      <FieldRow
        {...rowProps("title")}
        label="料理名"
        display={<PlainText value={values.title} />}
        editor={
          <TextInput
            testID="meal-form-title-input"
            style={styles.input}
            placeholder="料理名"
            returnKeyType="done"
            autoFocus
            value={titleDraft}
            onChangeText={setTitleDraft}
          />
        }
        canConfirm={titleDraft.trim().length > 0}
        onConfirm={() => confirmEdit({ title: titleDraft.trim() })}
      />

      <FieldRow
        {...rowProps("slot")}
        label="食事"
        display={
          <View style={styles.slotDisplay}>
            <Icon name={MEAL_SLOT_ICONS[values.slot]} size={18} color="#444" />
            <Text style={styles.valueText}>{MEAL_SLOT_LABELS[values.slot]}</Text>
          </View>
        }
        editor={
          <View style={styles.slotRow}>
            {MEAL_SLOTS.map((s) => (
              <TouchableOpacity
                key={s}
                testID={`meal-form-slot-${s}`}
                style={[styles.slotButton, s === slotDraft && styles.slotButtonActive]}
                onPress={() => setSlotDraft(s)}
              >
                <Icon name={MEAL_SLOT_ICONS[s]} size={16} color={s === slotDraft ? "#2f6fed" : "#666"} />
                <Text style={s === slotDraft ? styles.slotButtonTextActive : styles.slotButtonText}>
                  {MEAL_SLOT_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        onConfirm={() => confirmEdit({ slot: slotDraft })}
      />

      <FieldRow
        {...rowProps("date")}
        label="日付"
        display={<PlainText value={formatDateOnly(mealDateToPickerValue(values.mealDate).toISOString())} />}
        editor={
          <View testID="meal-form-date-picker-container" style={styles.pickerContainer}>
            {Platform.OS === "web" ? (
              <TextInput
                testID="meal-form-date-picker"
                style={styles.input}
                placeholder="YYYY-MM-DD"
                onChangeText={(text) => {
                  const parsed = new Date(`${text}T00:00:00.000Z`);
                  if (!Number.isNaN(parsed.getTime())) setDateDraft(parsed);
                }}
              />
            ) : (
              <DateTimePicker
                testID="meal-form-date-picker"
                value={dateDraft}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                locale={DATE_PICKER_LOCALE}
                onChange={(_event, selected) => {
                  if (selected) setDateDraft(selected);
                }}
              />
            )}
          </View>
        }
        onConfirm={() => confirmEdit({ mealDate: mealDateKeyFromPicked(dateDraft) })}
      />

      <FieldRow
        {...rowProps("rating")}
        label="評価"
        display={
          values.rating === null ? (
            <PlainText value="" />
          ) : (
            <RatingStars rating={values.rating} size={20} testIDPrefix="meal-form-detail-rating" />
          )
        }
        editor={<RatingStars rating={ratingDraft} onChange={setRatingDraft} size={24} testIDPrefix="meal-form-rating" />}
        onConfirm={() => confirmEdit({ rating: ratingDraft })}
      />

      <FieldRow
        {...rowProps("url")}
        label="URL"
        display={<PlainText value={values.url} />}
        editor={
          <TextInput
            testID="meal-form-url-input"
            style={styles.input}
            placeholder="URL"
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="done"
            autoFocus
            value={urlDraft}
            onChangeText={setUrlDraft}
          />
        }
        onConfirm={() => confirmEdit({ url: urlDraft.trim() })}
      />

      <FieldRow
        {...rowProps("memo")}
        label="メモ"
        display={<PlainText value={values.memo} />}
        editor={
          <TextInput
            testID="meal-form-memo-input"
            style={[styles.input, styles.memoInput]}
            placeholder="メモ"
            multiline
            autoFocus
            value={memoDraft}
            onChangeText={setMemoDraft}
          />
        }
        onConfirm={() => confirmEdit({ memo: memoDraft })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  // 幅を親の100%に固定する。開いたカレンダー(inlineのネイティブピッカー)の固有幅が
  // 行の幅に残って、閉じたあとに鉛筆が枠の外へはみ出さないようにする。
  field: {
    gap: 4,
    width: "100%",
  },
  fieldLabel: {
    color: "#666",
    fontSize: 12,
  },
  displayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // 鉛筆は内容のすぐ右に置く(右端揃えにしない)。内容が長いときだけ縮めて、
  // 鉛筆が枠の外へ押し出されないようにする。
  displayValue: {
    flexShrink: 1,
  },
  valueText: {
    fontSize: 16,
    color: "#222",
  },
  unsetText: {
    fontSize: 16,
    color: "#aaa",
  },
  slotDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editorBlock: {
    gap: 8,
  },
  editorActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 20,
  },
  confirmCheck: {
    color: "#2f6fed",
    fontSize: 22,
    fontWeight: "700",
  },
  confirmCheckDisabled: {
    opacity: 0.35,
  },
  cancelText: {
    color: "#666",
    fontSize: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  memoInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  calendarChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  slotButtonText: {
    color: "#444",
  },
  slotButtonTextActive: {
    color: "#2f6fed",
    fontWeight: "600",
  },
  pickerContainer: {
    width: "100%",
    overflow: "hidden",
  },
});
