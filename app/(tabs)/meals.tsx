import { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useMyCalendars } from "../../src/features/calendars/hooks";
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

interface MealRecordRowProps {
  mealRecord: MealRecord;
  onSave: (mealRecordId: string, title: string) => void;
  onDelete: (mealRecordId: string) => void;
}

function MealRecordRow({ mealRecord, onSave, onDelete }: MealRecordRowProps) {
  const [title, setTitle] = useState(mealRecord.title);

  return (
    <View style={styles.mealRow} testID={`meal-item-${mealRecord.id}`}>
      <View style={styles.mealMainRow}>
        <TextInput
          testID={`meal-title-input-${mealRecord.id}`}
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
        />
        <TouchableOpacity
          testID={`meal-save-${mealRecord.id}`}
          onPress={() => onSave(mealRecord.id, title)}
        >
          <Text>保存</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`meal-delete-${mealRecord.id}`} onPress={() => onDelete(mealRecord.id)}>
          <Text style={styles.deleteText}>削除</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.meta}>{mealRecord.mealDate}</Text>
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
  const [newMealDate, setNewMealDate] = useState("");
  const [newSlot, setNewSlot] = useState<MealSlot>("breakfast");

  const today = todayDateString();
  const pastRecords = mealRecords.filter((record) => record.mealDate < today);
  const futureRecords = mealRecords.filter((record) => record.mealDate >= today);

  const handleSave = async (mealRecordId: string, title: string) => {
    const success = await updateMealRecord(mealRecordId, { title });
    if (success) await refetch();
  };

  const handleDelete = async (mealRecordId: string) => {
    const success = await deleteMealRecord(mealRecordId);
    if (success) await refetch();
  };

  const handleCreate = async () => {
    const success = await createMealRecord({
      calendarId: activeCalendarId,
      mealDate: newMealDate,
      slot: newSlot,
      title: newTitle,
    });
    if (success) {
      setNewTitle("");
      setNewMealDate("");
      await refetch();
    }
  };

  const renderItem = ({ item }: { item: MealRecord }) => (
    <MealRecordRow mealRecord={item} onSave={handleSave} onDelete={handleDelete} />
  );

  return (
    <View style={styles.container}>
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

      <View style={styles.createForm}>
        <TextInput
          testID="meal-create-title-input"
          style={styles.input}
          placeholder="料理名"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <TextInput
          testID="meal-create-date-input"
          style={styles.input}
          placeholder="日付(YYYY-MM-DD)"
          value={newMealDate}
          onChangeText={setNewMealDate}
        />
        <View style={styles.slotRow}>
          {MEAL_SLOTS.map((slot) => (
            <TouchableOpacity
              key={slot}
              testID={`meal-create-slot-${slot}`}
              style={[styles.slotButton, slot === newSlot && styles.slotButtonActive]}
              onPress={() => setNewSlot(slot)}
            >
              <Text>{MEAL_SLOT_LABELS[slot]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity testID="meal-create-submit" style={styles.createButton} onPress={handleCreate}>
          <Text>記録を追加</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>食べたもの</Text>
      <FlatList data={pastRecords} keyExtractor={(item) => item.id} renderItem={renderItem} />

      <Text style={styles.sectionTitle}>食べる予定</Text>
      <FlatList data={futureRecords} keyExtractor={(item) => item.id} renderItem={renderItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 8,
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
  titleInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteText: {
    color: "#d32f2f",
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
  createForm: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotRow: {
    flexDirection: "row",
    gap: 8,
  },
  slotButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  slotButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  createButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
