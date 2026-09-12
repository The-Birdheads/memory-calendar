import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { BulkTagSelectionMode } from "../hooks";

export interface BulkSelectionActionBarProps {
  testIDPrefix: string;
  mode: BulkTagSelectionMode;
  selectedEventCount: number;
  /** assignモードで確認メッセージに使うタグ名一覧。removeモードでは使わない。 */
  selectedTagNames: string[];
  onClearSelection: () => void;
  /** 確認モーダルで「設定する」/「削除する」が押された後に呼ばれる。 */
  onConfirm: () => void;
}

/**
 * まとめてタグ付与/削除モード中、下部に固定表示する操作バー。「全選択解除」
 * と「選択完了」を持ち、「選択完了」は押しただけでは実行せず、まず
 * モードに応じた文言の確認モーダルを挟む。
 */
export function BulkSelectionActionBar({
  testIDPrefix,
  mode,
  selectedEventCount,
  selectedTagNames,
  onClearSelection,
  onConfirm,
}: BulkSelectionActionBarProps) {
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const canConfirm = selectedEventCount > 0 && (mode === "remove" || selectedTagNames.length > 0);
  const message =
    mode === "assign"
      ? `選択された予定にタグ「${selectedTagNames.join("、")}」を設定してよろしいですか？`
      : "選択された予定の全てのタグを削除してよろしいですか？";

  return (
    <>
      <View testID={`${testIDPrefix}-bar`} style={styles.bar}>
        <TouchableOpacity testID={`${testIDPrefix}-clear`} onPress={onClearSelection}>
          <Text style={styles.clearText}>全選択解除</Text>
        </TouchableOpacity>
        <Text style={styles.countText}>{selectedEventCount}件選択中</Text>
        <TouchableOpacity
          testID={`${testIDPrefix}-confirm`}
          disabled={!canConfirm}
          accessibilityState={{ disabled: !canConfirm }}
          onPress={() => setIsConfirmVisible(true)}
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
        >
          <Text style={styles.confirmButtonText}>選択完了</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View testID={`${testIDPrefix}-confirm-modal`} style={styles.modalCard}>
            <Text style={styles.modalMessage}>{message}</Text>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                testID={`${testIDPrefix}-confirm-cancel`}
                style={styles.modalButton}
                onPress={() => setIsConfirmVisible(false)}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`${testIDPrefix}-confirm-ok`}
                style={styles.modalButton}
                onPress={() => {
                  setIsConfirmVisible(false);
                  onConfirm();
                }}
              >
                <Text style={mode === "remove" ? styles.modalDestructiveText : styles.modalConfirmText}>
                  {mode === "remove" ? "削除する" : "設定する"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e3e6ec",
  },
  clearText: {
    color: "#666",
    fontSize: 14,
  },
  countText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#2f6fed",
  },
  confirmButtonDisabled: {
    backgroundColor: "#b7c6ea",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalCard: {
    width: "80%",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 20,
    gap: 20,
  },
  modalMessage: {
    fontSize: 15,
    color: "#222",
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  modalButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  modalCancelText: {
    color: "#666",
    fontSize: 15,
  },
  modalConfirmText: {
    color: "#2f6fed",
    fontSize: 15,
    fontWeight: "700",
  },
  modalDestructiveText: {
    color: "#c0392b",
    fontSize: 15,
    fontWeight: "700",
  },
});
