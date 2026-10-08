import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";

export interface ReorderMoveButtonsProps {
  upTestID: string;
  downTestID: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * 並べ替えモードで選択中のToDo行に出す「1つ上へ/1つ下へ」ボタン。先頭では
 * 上へ、末尾では下へが押せない(グレーアウト)。
 */
export function ReorderMoveButtons({
  upTestID,
  downTestID,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: ReorderMoveButtonsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        testID={upTestID}
        style={[styles.button, !canMoveUp && styles.buttonDisabled]}
        disabled={!canMoveUp}
        accessibilityState={{ disabled: !canMoveUp }}
        accessibilityLabel="1つ上へ"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={onMoveUp}
      >
        <Icon name="chevron-down" size={16} color="#2f6fed" style={styles.upIcon} />
      </TouchableOpacity>
      <TouchableOpacity
        testID={downTestID}
        style={[styles.button, !canMoveDown && styles.buttonDisabled]}
        disabled={!canMoveDown}
        accessibilityState={{ disabled: !canMoveDown }}
        accessibilityLabel="1つ下へ"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={onMoveDown}
      >
        <Icon name="chevron-down" size={16} color="#2f6fed" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e8f0fe",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  // chevron-down を180度回して「上向き」にする(アイコン画像を増やさない)。
  upIcon: {
    transform: [{ rotate: "180deg" }],
  },
});
