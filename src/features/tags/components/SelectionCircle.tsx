import { StyleSheet, Text, TouchableOpacity } from "react-native";

export interface SelectionCircleProps {
  testID: string;
  isSelected: boolean;
  onPress: () => void;
}

/**
 * まとめてタグ付与/削除モード中に予定の左に出す、iOSのリマインダーの
 * ような白丸の選択チェック。未選択は空の輪、選択中はチェックマーク付きの
 * 塗りつぶし丸になる。
 */
export function SelectionCircle({ testID, isSelected, onPress }: SelectionCircleProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.circle, isSelected && styles.circleSelected]}
    >
      {isSelected ? <Text style={styles.check}>✓</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  circleSelected: {
    borderColor: "#2f6fed",
    backgroundColor: "#2f6fed",
  },
  check: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
