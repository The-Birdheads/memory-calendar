import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLOR_PALETTE } from "../constants/colorPalette";
import { formatColorUsageMessage, hasColorUsage, type ColorUsageEntry } from "../utils/colorUsage";

export interface ColorSwatchPickerProps {
  testIDPrefix: string;
  selected: string;
  onSelect: (hex: string) => void;
  /** 色ごとの使用状況(呼び出し側が`findColorUsage`で組み立てる)。キーは
   * パレットのhex値。 */
  usageByColor: Record<string, ColorUsageEntry>;
}

/**
 * タグ(大分類)・カレンダーの色選択で共有する色スウォッチ行。既に他の
 * カレンダー/タグが使っている色には小さな点マークを付け、その色を選ぶと
 * 「この色は共有カレンダー「〇〇」で使用中です」のような説明文を出す
 * (2026-09追加)。選択自体をブロックはしない - あくまで参考情報で、
 * 気づいた上でも同じ色を選び直せる。
 */
export function ColorSwatchPicker({ testIDPrefix, selected, onSelect, usageByColor }: ColorSwatchPickerProps) {
  const selectedUsage = usageByColor[selected];
  const message = selectedUsage ? formatColorUsageMessage(selectedUsage) : null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {COLOR_PALETTE.map((color) => {
          const usage = usageByColor[color.hex];
          const isUsed = usage ? hasColorUsage(usage) : false;
          return (
            <TouchableOpacity
              key={color.name}
              testID={`${testIDPrefix}-${color.name}`}
              style={[
                styles.swatch,
                { backgroundColor: color.hex },
                selected === color.hex && styles.swatchSelected,
              ]}
              onPress={() => onSelect(color.hex)}
            >
              {isUsed ? <View testID={`${testIDPrefix}-${color.name}-used-mark`} style={styles.usedMark} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {message ? (
        <Text testID={`${testIDPrefix}-usage-message`} style={styles.usageMessage}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: {
    borderColor: "#333",
  },
  usedMark: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#666",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  usageMessage: {
    color: "#666",
    fontSize: 12,
    backgroundColor: "#f2f3f5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
