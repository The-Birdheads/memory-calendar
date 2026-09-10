import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";

export interface DeleteEventConfirmModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteEventConfirmModal({ visible, onConfirm, onCancel }: DeleteEventConfirmModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity testID="delete-event-backdrop" style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>予定を削除しますか?</Text>
          <Text style={styles.warning}>
            この予定に紐づく思い出データ(写真・コメント)も削除されます
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              testID="delete-event-cancel-button"
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="delete-event-confirm-button"
              onPress={onConfirm}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="trash" size={20} color="#d32f2f" />
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
