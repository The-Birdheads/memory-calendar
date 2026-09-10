import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";

export interface LeaveOrDeleteCalendarConfirmModalProps {
  visible: boolean;
  /** true when the caller is the calendar's only member, so confirming deletes
   * the whole calendar (and cascades to its events) instead of just leaving it. */
  willDeleteEntirely: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LeaveOrDeleteCalendarConfirmModal({
  visible,
  willDeleteEntirely,
  onConfirm,
  onCancel,
}: LeaveOrDeleteCalendarConfirmModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        testID="leave-or-delete-calendar-backdrop"
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>
            {willDeleteEntirely ? "カレンダーを削除しますか?" : "このカレンダーから抜けますか?"}
          </Text>
          <Text style={styles.warning}>
            {willDeleteEntirely
              ? "あなたが唯一のメンバーのため、このカレンダーとすべての予定データが完全に削除されます"
              : "他のメンバーは引き続きこのカレンダーを利用できます"}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              testID="leave-or-delete-calendar-cancel-button"
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="leave-or-delete-calendar-confirm-button"
              onPress={onConfirm}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {willDeleteEntirely ? (
                <Icon name="trash" size={20} color="#d32f2f" />
              ) : (
                <Text style={styles.confirmText}>抜ける</Text>
              )}
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
    width: "80%",
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
    color: "#d32f2f",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  confirmText: {
    color: "#d32f2f",
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
});
