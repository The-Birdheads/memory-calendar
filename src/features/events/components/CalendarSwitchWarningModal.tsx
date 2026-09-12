import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { buildCalendarSwitchWarningMessages } from "../calendarSwitchWarning";
import type { CalendarKind } from "../../calendars/types";

export interface CalendarSwitchWarningModalProps {
  visible: boolean;
  fromKind: CalendarKind;
  fromName: string;
  toKind: CalendarKind;
  toName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * カレンダー切り替えの実行直前に出す確認モーダル。切り替え方向に応じて
 * 「共有されてしまう項目」「元のカレンダーのメンバーが見られなくなる」の
 * どちらか/両方を `buildCalendarSwitchWarningMessages` で組み立てて表示する。
 * OKを押すと実際の切り替え(呼び出し元がupdateEventを実行)、キャンセルで
 * カレンダー選択に戻る(選択自体は取り消さない - 呼び出し元次第)。
 */
export function CalendarSwitchWarningModal({
  visible,
  fromKind,
  fromName,
  toKind,
  toName,
  onConfirm,
  onCancel,
}: CalendarSwitchWarningModalProps) {
  if (!visible) return null;

  const messages = buildCalendarSwitchWarningMessages({ fromKind, fromName, toKind, toName });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        testID="event-calendar-switch-warning-backdrop"
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>カレンダーを変更しますか?</Text>
          {messages.map((message, index) => (
            <Text key={index} testID={`event-calendar-switch-warning-message-${index}`} style={styles.warning}>
              {message}
            </Text>
          ))}
          <View style={styles.actions}>
            <TouchableOpacity
              testID="event-calendar-switch-warning-cancel"
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="event-calendar-switch-warning-confirm"
              onPress={onConfirm}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.confirmText}>OK</Text>
            </TouchableOpacity>
          </View>
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
    borderRadius: 12,
    padding: 20,
    backgroundColor: "#fff",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  warning: {
    color: "#444",
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2f6fed",
  },
});
