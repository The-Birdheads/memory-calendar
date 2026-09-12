import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { CalendarLabel } from "../../calendars/components/CalendarLabel";
import type { Calendar } from "../../calendars/types";
import { Icon } from "../../../shared/components/Icon";

export interface EventCalendarPickerModalProps {
  visible: boolean;
  calendars: Calendar[];
  currentCalendarId: string;
  /** 選択中のカレンダーが元のカレンダーと異なる状態で✓が押されたときだけ呼ばれる。 */
  onConfirm: (calendar: Calendar) => void;
  onCancel: () => void;
}

/**
 * 予定の所属カレンダーを切り替えるための選択画面(モーダル)。行をタップして
 * 選択し(即座には切り替わらない)、右下の✓で確定する。確定は
 * `CalendarSwitchWarningModal` の表示を呼び出し元に委ねるだけで、実際の
 * 切り替えAPI呼び出しはしない(元と同じカレンダーのまま✓を押した場合は
 * 何も起きずそのまま閉じる)。
 */
export function EventCalendarPickerModal({
  visible,
  calendars,
  currentCalendarId,
  onConfirm,
  onCancel,
}: EventCalendarPickerModalProps) {
  const [selectedId, setSelectedId] = useState(currentCalendarId);

  useEffect(() => {
    if (visible) setSelectedId(currentCalendarId);
  }, [visible, currentCalendarId]);

  if (!visible) return null;

  const handleConfirm = () => {
    if (selectedId === currentCalendarId) {
      onCancel();
      return;
    }
    const calendar = calendars.find((c) => c.id === selectedId);
    if (calendar) onConfirm(calendar);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity testID="event-calendar-picker-backdrop" style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>カレンダーを選択</Text>
            <TouchableOpacity
              testID="event-calendar-picker-close"
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={16} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {calendars.map((calendar) => {
              const isSelected = calendar.id === selectedId;
              return (
                <TouchableOpacity
                  key={calendar.id}
                  testID={`event-calendar-picker-option-${calendar.id}`}
                  style={styles.row}
                  onPress={() => setSelectedId(calendar.id)}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.colorDot, { backgroundColor: calendar.color }]} />
                    <CalendarLabel calendar={calendar} textStyle={styles.rowName} />
                  </View>
                  {isSelected ? (
                    <Text testID={`event-calendar-picker-option-${calendar.id}-checked`} style={styles.checkMark}>
                      ✓
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            testID="event-calendar-picker-confirm"
            style={styles.confirmButton}
            onPress={handleConfirm}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.confirmButtonText}>✓</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    width: "85%",
    maxHeight: "70%",
    borderRadius: 12,
    padding: 20,
    backgroundColor: "#fff",
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rowName: {
    fontSize: 15,
  },
  checkMark: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f6fed",
  },
  confirmButton: {
    alignSelf: "flex-end",
    backgroundColor: "#2f6fed",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
