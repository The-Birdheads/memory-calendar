import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";

const BASE_WARNING =
  "個人用カレンダーの予定・写真・コメント・ToDo・タグはすべて削除されます。参加中の共有カレンダーからは退出し、自分が唯一のメンバーの場合はそのカレンダーごと削除されます。";

/**
 * 警告文。Habitas と同じアカウントを共有しているため、Habitas も使っているかで出し分ける。
 * - habitasInUse = true: Memory Calendar のデータだけ削除され、アカウント自体は残る
 * - habitasInUse = false: アカウントごと削除される
 * - habitasInUse = null/undefined(取得できなかった): どちらにもなり得ることを伝える
 */
export function getDeleteAccountWarning(habitasInUse?: boolean | null): string {
  if (habitasInUse === true) {
    return `${BASE_WARNING}このアカウントはまいにちコンパス（旧Habitas）でも使われているため、アカウント自体とまいにちコンパス（旧Habitas）のデータは削除されません。この操作は取り消せません。`;
  }
  if (habitasInUse === false) {
    return `${BASE_WARNING}アカウント自体も削除されます。この操作は取り消せません。`;
  }
  return `${BASE_WARNING}まいにちコンパス（旧Habitas）でもこのアカウントを使っている場合、アカウント自体とまいにちコンパス（旧Habitas）のデータは削除されません。この操作は取り消せません。`;
}

export interface DeleteAccountConfirmModalProps {
  visible: boolean;
  /** Habitas も使っているか。取得できなかった・未指定のときは汎用の文言になる */
  habitasInUse?: boolean | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteAccountConfirmModal({
  visible,
  habitasInUse,
  onConfirm,
  onCancel,
}: DeleteAccountConfirmModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity testID="delete-account-backdrop" style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <Text style={styles.title}>アカウントを削除しますか?</Text>
          <Text testID="delete-account-warning" style={styles.warning}>
            {getDeleteAccountWarning(habitasInUse)}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              testID="delete-account-cancel-button"
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="delete-account-confirm-button"
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
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
});
