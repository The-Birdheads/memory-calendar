import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>タグを削除しますか?</Text>
          <Text style={styles.warning}>
            {hasChildren
              ? "配下の中分類・小分類タグと、それらが設定された予定への紐付けも削除されます"
              : "このタグが設定された予定への紐付けも削除されます"}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity testID="delete-tag-cancel-button" onPress={onCancel}>
              <Text>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="delete-tag-confirm-button" onPress={onConfirm}>
              <Text style={styles.confirmText}>削除する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
});
