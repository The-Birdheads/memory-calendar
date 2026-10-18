import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface TimeKeypadProps {
  /** testID の接頭辞。各キーは `${testIDPrefix}-key-${ラベル}`、各段は `${testIDPrefix}-row-${段}`。 */
  testIDPrefix: string;
  doneTestID: string;
  cancelTestID: string;
  /** 数字キー(0-9)。 */
  onDigit: (digit: number) => void;
  /** 「00」「30」キー: 入力中の欄(時/分)にその二桁の値を入れる。 */
  onQuickValue: (value: number) => void;
  onDone: () => void;
  /** 入力途中の時刻を全て破棄して閉じる。 */
  onCancel: () => void;
}

type Key = { label: string; kind: "digit" | "value"; value: number };

const ROWS: Key[][] = [
  [7, 8, 9].map((n): Key => ({ label: String(n), kind: "digit", value: n })),
  [4, 5, 6].map((n): Key => ({ label: String(n), kind: "digit", value: n })),
  [1, 2, 3].map((n): Key => ({ label: String(n), kind: "digit", value: n })),
  [
    { label: "0", kind: "digit", value: 0 },
    { label: "00", kind: "value", value: 0 },
    { label: "30", kind: "value", value: 30 },
  ],
];

/**
 * 時刻入力用のアプリ独自のテンキー。システムのキーボードではなく、7 8 9 / 4 5 6 / 1 2 3 /
 * 0 00 30 の並びで、「00」「30」は入力中の欄に二桁をそのまま入れるショートカット。上に「キャンセル」(左)と「完了」(右)を置く。
 */
export function TimeKeypad({
  testIDPrefix,
  doneTestID,
  cancelTestID,
  onDigit,
  onQuickValue,
  onDone,
  onCancel,
}: TimeKeypadProps) {
  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity testID={cancelTestID} onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={doneTestID} onPress={onDone} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
          <Text style={styles.doneText}>完了</Text>
        </TouchableOpacity>
      </View>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} testID={`${testIDPrefix}-row-${rowIndex}`} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key.label}
              testID={`${testIDPrefix}-key-${key.label}`}
              style={styles.key}
              activeOpacity={0.5}
              onPress={() => (key.kind === "digit" ? onDigit(key.value) : onQuickValue(key.value))}
            >
              <Text style={styles.keyText}>{key.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#d0d0d5",
    borderRadius: 12,
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    color: "#666",
    fontSize: 16,
  },
  doneText: {
    color: "#2f6fed",
    fontSize: 16,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
  },
  key: {
    flex: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: "#d0d0d5",
  },
  keyText: {
    fontSize: 24,
    color: "#111",
  },
});
