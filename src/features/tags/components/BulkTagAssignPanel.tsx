import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { BulkTagSelectionMode } from "../hooks";
import type { TagTreeNode } from "../types";
import { TagPickerRow } from "./TagPickerRow";

export interface BulkTagAssignPanelProps {
  testIDPrefix: string;
  tagTree: TagTreeNode[];
  mode: BulkTagSelectionMode;
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onSwitchToRemoveMode: () => void;
  onSwitchToAssignMode: () => void;
}

/**
 * まとめてタグ付与/削除モードの上部パネル。振り返り(年表)・カレンダー
 * (一覧)どちらのタグアイコンからも同じ内容になる(要件の「タグアイコンを
 * 押下した時の操作の流れは振り返り画面と同様」)。「まとめて削除」ボタンは
 * 別アイコンではなく、この同じパネル内でのモード切り替えとして働く。
 */
export function BulkTagAssignPanel({
  testIDPrefix,
  tagTree,
  mode,
  selectedTagIds,
  onToggleTag,
  onSwitchToRemoveMode,
  onSwitchToAssignMode,
}: BulkTagAssignPanelProps) {
  return (
    <View testID={`${testIDPrefix}-panel`} style={styles.panel}>
      {mode === "assign" ? (
        <>
          <Text style={styles.heading}>まとめて付与したいタグを選択してください</Text>
          <TagPickerRow
            testIDPrefix={`${testIDPrefix}-tag-picker`}
            tagTree={tagTree}
            selectedTagIds={selectedTagIds}
            onToggle={onToggleTag}
            hideLabel
          />
          <TouchableOpacity
            testID={`${testIDPrefix}-switch-to-remove`}
            onPress={onSwitchToRemoveMode}
            style={styles.removeModeButton}
          >
            <Text style={styles.removeModeButtonText}>まとめて削除</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.heading}>選択した予定の全てのタグを削除します</Text>
          <TouchableOpacity testID={`${testIDPrefix}-switch-to-assign`} onPress={onSwitchToAssignMode}>
            <Text style={styles.backLink}>タグを選んで付与する場合はこちら</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    padding: 12,
    backgroundColor: "#f5f7fb",
    borderBottomWidth: 1,
    borderBottomColor: "#e3e6ec",
  },
  heading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  removeModeButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#fdeceb",
  },
  removeModeButtonText: {
    color: "#c0392b",
    fontSize: 13,
    fontWeight: "700",
  },
  backLink: {
    color: "#2f6fed",
    fontSize: 13,
  },
});
