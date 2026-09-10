import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { RatingStars } from "./RatingStars";
import type { MealSlot } from "../types";
import { CalendarLabel } from "../../calendars/components/CalendarLabel";
import { CalendarSwitchChip } from "../../calendars/components/CalendarSwitchChip";
import type { Calendar } from "../../calendars/types";
import { Icon } from "../../../shared/components/Icon";
import { RevealableTextField } from "../../../shared/components/RevealableTextField";
import { formatDateOnly, toJstDateKey } from "../../../shared/utils/formatDateTime";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

export interface MealFormValues {
  title: string;
  url: string;
  memo: string;
  /** "YYYY-MM-DD" */
  mealDate: string;
  slot: MealSlot;
  rating: number | null;
  calendarId: string;
}

export type MealFormTarget =
  | { mode: "create"; initialValues: MealFormValues }
  | { mode: "edit"; recordId: string; initialValues: MealFormValues };

export interface MealFormModalProps {
  /** null keeps the modal closed; set it to open in create or edit mode. */
  target: MealFormTarget | null;
  /**
   * The calendars the meal could belong to - shown so it's always clear
   * which calendar a new meal is about to be added to (edit shows the
   * record's own calendar, read-only; create shows a picker when there's
   * more than one to choose from).
   */
  calendars: Calendar[];
  onClose: () => void;
  onSave: (values: MealFormValues) => void;
  /** Required to show the delete button (only relevant in edit mode). */
  onDelete?: (recordId: string) => void;
}

/**
 * A native date picker hands back a real absolute instant (e.g. tapping
 * "9/4" on a JST device yields JST-midnight-Sept-4, i.e. 15:00 UTC on the
 * 3rd) - reading its JST calendar day (not a raw UTC slice) is what keeps
 * the date you pick and the date that gets saved/displayed in sync.
 */
function mealDateKeyFromPicked(date: Date): string {
  return toJstDateKey(date.toISOString());
}

/** Parses a "YYYY-MM-DD" mealDate into a Date for the picker (UTC midnight -
 * round-trips correctly through mealDateKeyFromPicked's JST-day read, same
 * as the web date-input fallback). */
function mealDateToPickerValue(mealDate: string): Date {
  return new Date(`${mealDate}T00:00:00.000Z`);
}

/**
 * The single shared "献立を追加/編集する" form - a full-screen-dim modal
 * card covering both create (target.mode === "create") and edit
 * (target.mode === "edit", which also shows a delete button with its own
 * confirmation) so the two flows don't duplicate the same half-dozen
 * fields. Mirrors EventDetailModal's "Modal + nullable target" shape: the
 * content only mounts while target is non-null, so its local field state
 * is always freshly seeded from target.initialValues on open (no reset
 * effect needed).
 */
export function MealFormModal({
  target,
  calendars,
  onClose,
  onSave,
  onDelete,
}: MealFormModalProps) {
  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {target !== null ? (
        <MealFormModalContent
          target={target}
          calendars={calendars}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </Modal>
  );
}

function MealFormModalContent({
  target,
  calendars,
  onClose,
  onSave,
  onDelete,
}: {
  target: MealFormTarget;
  calendars: Calendar[];
  onClose: () => void;
  onSave: (values: MealFormValues) => void;
  onDelete?: (recordId: string) => void;
}) {
  const [title, setTitle] = useState(target.initialValues.title);
  const [url, setUrl] = useState(target.initialValues.url);
  const [memo, setMemo] = useState(target.initialValues.memo);
  const [mealDate, setMealDate] = useState(() =>
    mealDateToPickerValue(target.initialValues.mealDate),
  );
  const [slot, setSlot] = useState(target.initialValues.slot);
  const [rating, setRating] = useState(target.initialValues.rating);
  const [calendarId, setCalendarId] = useState(target.initialValues.calendarId);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  const selectedCalendar =
    calendars.find((calendar) => calendar.id === calendarId) ?? null;

  const handleSave = () => {
    onSave({
      title,
      url,
      memo,
      mealDate: mealDateKeyFromPicked(mealDate),
      slot,
      rating,
      calendarId,
    });
  };

  const handleConfirmDelete = () => {
    if (target.mode === "edit") onDelete?.(target.recordId);
    setIsDeleteConfirmVisible(false);
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.keyboardAvoidingOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity
          testID="meal-form-backdrop"
          style={styles.modalBackdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
        <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={styles.modalCard}
        >
          <Text style={styles.modalTitle}>
            {target.mode === "create" ? "献立を追加" : "献立の詳細"}
          </Text>

          {target.mode === "create" && calendars.length > 1 ? (
            <View
              style={styles.calendarPickerField}
              testID="meal-form-calendar-picker"
            >
              <Text style={styles.dateFieldLabel}>カレンダー</Text>
              <View style={styles.calendarChipRow}>
                {calendars.map((calendar) => (
                  <CalendarSwitchChip
                    key={calendar.id}
                    testID={`meal-form-calendar-${calendar.id}`}
                    calendar={calendar}
                    isActive={calendar.id === calendarId}
                    onPress={() => setCalendarId(calendar.id)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.dateField} testID="meal-form-calendar-label">
              <Text style={styles.dateFieldLabel}>カレンダー</Text>
              {selectedCalendar ? (
                <CalendarLabel calendar={selectedCalendar} />
              ) : null}
            </View>
          )}

          <TextInput
            testID="meal-form-title-input"
            style={styles.input}
            placeholder="料理名"
            returnKeyType="done"
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.slotRow}>
            {MEAL_SLOTS.map((s) => (
              <TouchableOpacity
                key={s}
                testID={`meal-form-slot-${s}`}
                style={[
                  styles.slotButton,
                  s === slot && styles.slotButtonActive,
                ]}
                onPress={() => setSlot(s)}
              >
                <Text
                  style={s === slot ? styles.slotButtonTextActive : undefined}
                >
                  {MEAL_SLOT_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            testID="meal-form-date-button"
            style={styles.dateField}
            onPress={() => setIsDatePickerOpen(true)}
          >
            <Text style={styles.dateFieldLabel}>日付</Text>
            <Text>{formatDateOnly(mealDate.toISOString())}</Text>
          </TouchableOpacity>

          {isDatePickerOpen ? (
            <View style={styles.pickerContainer}>
              {Platform.OS === "web" ? (
                <TextInput
                  testID="meal-form-date-picker"
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  onChangeText={(text) => {
                    const parsed = new Date(`${text}T00:00:00.000Z`);
                    if (!Number.isNaN(parsed.getTime())) setMealDate(parsed);
                  }}
                />
              ) : (
                <DateTimePicker
                  testID="meal-form-date-picker"
                  value={mealDate}
                  mode="date"
                  onChange={(_event, selected) => {
                    if (selected) setMealDate(selected);
                  }}
                />
              )}
              <TouchableOpacity
                testID="meal-form-date-picker-done"
                style={styles.pickerDoneButton}
                onPress={() => setIsDatePickerOpen(false)}
              >
                <Text>完了</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.ratingRow}>
            <Text style={styles.dateFieldLabel}>評価</Text>
            <RatingStars
              rating={rating}
              onChange={setRating}
              size={22}
              testIDPrefix="meal-form-rating"
            />
          </View>

          <RevealableTextField
            testID="meal-form-url-input"
            addButtonTestID="meal-form-url-add"
            addLabel="URLを追加"
            style={styles.input}
            placeholder="URL"
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="done"
            value={url}
            onChangeText={setUrl}
          />
          <RevealableTextField
            testID="meal-form-memo-input"
            addButtonTestID="meal-form-memo-add"
            addLabel="メモを追加"
            style={styles.input}
            placeholder="メモ"
            multiline
            value={memo}
            onChangeText={setMemo}
          />

          <View style={styles.modalActions}>
            {target.mode === "edit" ? (
              <TouchableOpacity
                testID="meal-form-delete"
                onPress={() => setIsDeleteConfirmVisible(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="trash" size={18} color="#d32f2f" />
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <View style={styles.modalActionsRight}>
              <TouchableOpacity
                testID="meal-form-cancel"
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="meal-form-save"
                onPress={handleSave}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.saveLink}>✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
        </ScrollView>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      <Modal
        visible={isDeleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteConfirmVisible(false)}
      >
        <TouchableOpacity
          testID="meal-form-delete-backdrop"
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDeleteConfirmVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={styles.modalCard}
          >
            <Text style={styles.modalTitle}>
              {title || "この献立"}を削除しますか?
            </Text>
            <View style={styles.modalActionsRight}>
              <TouchableOpacity
                testID="meal-form-delete-cancel"
                onPress={() => setIsDeleteConfirmVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.cancelText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="meal-form-delete-confirm"
                onPress={handleConfirmDelete}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="trash" size={20} color="#d32f2f" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  // メインフォームは中身が長く(URL/メモ欄など)キーボードに隠れうるので、
  // KeyboardAvoidingViewで包む(2026-09追加)。中央寄せは中の
  // modalBackdropTouchable/modalScrollContent側で行うため、こちらは
  // 背景色とflex:1だけを持つ(justifyContent/alignItemsを持たせると、
  // 内側のTouchableOpacityが横幅いっぱいに広がらず、範囲外タップでの
  // クローズが効かなくなる)。
  keyboardAvoidingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalBackdropTouchable: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    borderRadius: 12,
    padding: 20,
    gap: 12,
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFieldLabel: {
    color: "#666",
  },
  calendarPickerField: {
    gap: 6,
  },
  calendarChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerContainer: {
    gap: 8,
    alignItems: "flex-end",
  },
  pickerDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotRow: {
    flexDirection: "row",
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
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalActionsRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  saveLink: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 16,
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
});
