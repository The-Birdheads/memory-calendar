import { useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Tabs, router } from "expo-router";

import { useMyCalendars } from "../../src/features/calendars/hooks";
import { Icon } from "../../src/shared/components/Icon";
import {
  useCreateMealRecord,
  useDeleteMealRecord,
  useMealRecords,
  useUpdateMealRecord,
} from "../../src/features/meals/hooks";
import type { MealRecord, MealSlot } from "../../src/features/meals/types";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMealDateLabel(date: Date): string {
  return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

/** "YYYY-MM-DD" (already a plain date, no time) + the slot label, e.g. "2026/9/1 昼食". */
function formatMealDateSlotLabel(mealDate: string, slot: MealSlot): string {
  return `${mealDate.replace(/-/g, "/")} ${MEAL_SLOT_LABELS[slot]}`;
}

interface MealRecordRowProps {
  mealRecord: MealRecord;
  onSave: (mealRecordId: string, title: string, url: string, memo: string) => void;
  onDelete: (mealRecordId: string) => void;
}

function MealRecordRow({ mealRecord, onSave, onDelete }: MealRecordRowProps) {
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [title, setTitle] = useState(mealRecord.title);
  const [url, setUrl] = useState(mealRecord.url ?? "");
  const [memo, setMemo] = useState(mealRecord.memo ?? "");

  const openDetailModal = () => {
    setTitle(mealRecord.title);
    setUrl(mealRecord.url ?? "");
    setMemo(mealRecord.memo ?? "");
    setIsDetailModalVisible(true);
  };

  const handleSave = () => {
    onSave(mealRecord.id, title, url, memo);
    setIsDetailModalVisible(false);
  };

  return (
    <View style={styles.mealRow} testID={`meal-item-${mealRecord.id}`}>
      <View style={styles.mealMainRow}>
        <View style={styles.mealInfo}>
          <Text style={styles.mealTitle}>{mealRecord.title}</Text>
          <View style={styles.mealMetaRow}>
            <Text style={styles.meta}>{formatMealDateSlotLabel(mealRecord.mealDate, mealRecord.slot)}</Text>
            {mealRecord.url ? (
              <Icon testID={`meal-url-icon-${mealRecord.id}`} name="link" size={12} color="#2f6fed" />
            ) : null}
            {mealRecord.memo ? (
              <Icon testID={`meal-memo-icon-${mealRecord.id}`} name="note" size={12} color="#666" />
            ) : null}
          </View>
        </View>
        <TouchableOpacity testID={`meal-details-${mealRecord.id}`} onPress={openDetailModal}>
          <Text style={styles.editText}>詳細</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`meal-delete-${mealRecord.id}`} onPress={() => onDelete(mealRecord.id)}>
          <Text style={styles.deleteText}>削除</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isDetailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>献立の詳細</Text>
              <Text style={styles.modalMeta}>{formatMealDateSlotLabel(mealRecord.mealDate, mealRecord.slot)}</Text>
              <TextInput
                testID={`meal-edit-title-input-${mealRecord.id}`}
                style={styles.input}
                placeholder="料理名"
                returnKeyType="done"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                testID={`meal-edit-url-input-${mealRecord.id}`}
                style={styles.input}
                placeholder="URL"
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
                value={url}
                onChangeText={setUrl}
              />
              <TextInput
                testID={`meal-edit-memo-input-${mealRecord.id}`}
                style={styles.input}
                placeholder="メモ"
                multiline
                value={memo}
                onChangeText={setMemo}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  testID={`meal-edit-cancel-${mealRecord.id}`}
                  onPress={() => setIsDetailModalVisible(false)}
                >
                  <Text>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`meal-edit-save-${mealRecord.id}`} onPress={handleSave}>
                  <Text style={styles.saveLink}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

export default function MealsScreen() {
  const { calendars } = useMyCalendars();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const activeCalendarId = selectedCalendarId ?? calendars[0]?.id ?? "";

  const { mealRecords, refetch } = useMealRecords(activeCalendarId);
  const { createMealRecord } = useCreateMealRecord();
  const { updateMealRecord } = useUpdateMealRecord();
  const { deleteMealRecord } = useDeleteMealRecord();

  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [newMealDate, setNewMealDate] = useState(() => new Date());
  const [newSlot, setNewSlot] = useState<MealSlot>("breakfast");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isPastCollapsed, setIsPastCollapsed] = useState(true);
  const [isFutureCollapsed, setIsFutureCollapsed] = useState(false);

  const today = todayDateString();
  const pastRecords = mealRecords.filter((record) => record.mealDate < today);
  const futureRecords = mealRecords.filter((record) => record.mealDate >= today);

  const handleSave = async (mealRecordId: string, title: string, url: string, memo: string) => {
    const success = await updateMealRecord(mealRecordId, {
      title,
      url: url || null,
      memo: memo || null,
    });
    if (success) await refetch();
  };

  const handleDelete = async (mealRecordId: string) => {
    const success = await deleteMealRecord(mealRecordId);
    if (success) await refetch();
  };

  const handleCreate = async () => {
    const success = await createMealRecord({
      calendarId: activeCalendarId,
      mealDate: newMealDate.toISOString().slice(0, 10),
      slot: newSlot,
      title: newTitle,
      url: newUrl || undefined,
      memo: newMemo || undefined,
    });
    if (success) {
      setNewTitle("");
      setNewUrl("");
      setNewMemo("");
      setNewMealDate(new Date());
      await refetch();
    }
  };

  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              testID="meals-search-button"
              style={styles.headerSearchButton}
              onPress={() => router.push({ pathname: "/meal-search", params: { calendarId: activeCalendarId } })}
            >
              <Icon name="search" size={20} color="#2f6fed" />
            </TouchableOpacity>
          ),
        }}
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.switcher}>
        {calendars.map((calendar) => (
          <TouchableOpacity
            key={calendar.id}
            testID={`meals-calendar-switch-${calendar.id}`}
            onPress={() => setSelectedCalendarId(calendar.id)}
            style={[
              styles.switchButton,
              calendar.id === activeCalendarId && styles.switchButtonActive,
            ]}
          >
            <Text>{calendar.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.createCard}>
        <Text style={styles.createCardTitle}>献立を記録</Text>
        <TextInput
          testID="meal-create-title-input"
          style={styles.input}
          placeholder="料理名"
          returnKeyType="done"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <TextInput
          testID="meal-create-url-input"
          style={styles.input}
          placeholder="URL"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="done"
          value={newUrl}
          onChangeText={setNewUrl}
        />
        <TextInput
          testID="meal-create-memo-input"
          style={styles.input}
          placeholder="メモ"
          multiline
          value={newMemo}
          onChangeText={setNewMemo}
        />

        <TouchableOpacity
          testID="meal-create-date-button"
          style={styles.dateField}
          onPress={() => setIsDatePickerOpen(true)}
        >
          <Text style={styles.dateFieldLabel}>日付</Text>
          <Text>{formatMealDateLabel(newMealDate)}</Text>
        </TouchableOpacity>

        {isDatePickerOpen ? (
          <View style={styles.pickerContainer}>
            {Platform.OS === "web" ? (
              <TextInput
                testID="meal-create-date-picker"
                style={styles.input}
                placeholder="YYYY-MM-DD"
                onChangeText={(text) => {
                  const parsed = new Date(`${text}T00:00:00.000Z`);
                  if (!Number.isNaN(parsed.getTime())) setNewMealDate(parsed);
                }}
              />
            ) : (
              <DateTimePicker
                testID="meal-create-date-picker"
                value={newMealDate}
                mode="date"
                onChange={(_event, selected) => {
                  if (selected) setNewMealDate(selected);
                }}
              />
            )}
            <TouchableOpacity
              testID="meal-create-date-picker-done"
              style={styles.pickerDoneButton}
              onPress={() => setIsDatePickerOpen(false)}
            >
              <Text>完了</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.slotRow}>
          {MEAL_SLOTS.map((slot) => (
            <TouchableOpacity
              key={slot}
              testID={`meal-create-slot-${slot}`}
              style={[styles.slotButton, slot === newSlot && styles.slotButtonActive]}
              onPress={() => setNewSlot(slot)}
            >
              <Text style={slot === newSlot && styles.slotButtonTextActive}>{MEAL_SLOT_LABELS[slot]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity testID="meal-create-submit" style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.createButtonText}>記録を追加</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        testID="meals-past-toggle"
        style={styles.sectionHeader}
        onPress={() => setIsPastCollapsed((prev) => !prev)}
      >
        <Icon name={isPastCollapsed ? "chevron-right" : "chevron-down"} size={13} color="#666" />
        <Text style={styles.sectionTitle}>食べたもの ({pastRecords.length})</Text>
      </TouchableOpacity>
      {!isPastCollapsed ? (
        pastRecords.length === 0 ? (
          <Text style={styles.sectionEmptyText}>記録がありません</Text>
        ) : (
          pastRecords.map((record) => (
            <MealRecordRow key={record.id} mealRecord={record} onSave={handleSave} onDelete={handleDelete} />
          ))
        )
      ) : null}

      <TouchableOpacity
        testID="meals-future-toggle"
        style={styles.sectionHeader}
        onPress={() => setIsFutureCollapsed((prev) => !prev)}
      >
        <Icon name={isFutureCollapsed ? "chevron-right" : "chevron-down"} size={13} color="#666" />
        <Text style={styles.sectionTitle}>食べる予定 ({futureRecords.length})</Text>
      </TouchableOpacity>
      {!isFutureCollapsed ? (
        futureRecords.length === 0 ? (
          <Text style={styles.sectionEmptyText}>予定がありません</Text>
        ) : (
          futureRecords.map((record) => (
            <MealRecordRow key={record.id} mealRecord={record} onSave={handleSave} onDelete={handleDelete} />
          ))
        )
      ) : null}
      </ScrollView>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  headerSearchButton: {
    marginRight: 12,
  },
  switcher: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  switchButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionEmptyText: {
    color: "#999",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  mealRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  mealMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mealInfo: {
    flex: 1,
    gap: 2,
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  mealMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  deleteText: {
    color: "#d32f2f",
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
  createCard: {
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  createCardTitle: {
    fontSize: 15,
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
  pickerContainer: {
    gap: 8,
    alignItems: "flex-end",
  },
  pickerDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  createButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2f6fed",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
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
  modalMeta: {
    color: "#666",
    fontSize: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  saveLink: {
    color: "#2f6fed",
    fontWeight: "700",
  },
});
