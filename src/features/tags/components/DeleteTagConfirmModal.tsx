import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";

export interface DeleteTagConfirmModalProps {
  visible: boolean;
  hasChildren?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteTagConfirmModal({
  visible,
  hasChildren,
  onConfirm,
  onCancel,
}: DeleteTagConfirmModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity testID="delete-tag-backdrop" style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>タグを削除しますか?</Text>
          <Text style={styles.warning}>
            {hasChildren
              ? "配下の中分類・小分類タグと、それらが設定された予定への紐付けも削除されます"
              : "このタグが設定された予定への紐付けも削除されます"}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              testID="delete-tag-cancel-button"
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="delete-tag-confirm-button"
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
