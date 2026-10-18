import { StyleSheet, Text, TouchableOpacity } from "react-native";

import type { TimeField } from "../timeDigits";

export interface TimeFieldBoxProps {
  /** testID の接頭辞。枠は `${testIDPrefix}-button`、時は `-hour`、分は `-minute`。 */
  testIDPrefix: string;
  hour: number;
  minute: number;
  /** 編集中の欄(枠自体が編集中でなければ null)。 */
  activeField: TimeField | null;
  onSelectField: (field: TimeField) => void;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * 時刻の表示欄(時 : 分)。入力はアプリ独自のテンキー(TimeKeypad)で行い、この欄は
 * 「どちらの欄を編集中か」の表示と選択だけを受け持つ。編集中の欄の数字は濃く、下線を引く。
 */
export function TimeFieldBox({ testIDPrefix, hour, minute, activeField, onSelectField }: TimeFieldBoxProps) {
  const renderField = (field: TimeField, value: number) => {
    const isActive = activeField === field;
    return (
      <TouchableOpacity
        testID={`${testIDPrefix}-${field}`}
        onPress={() => onSelectField(field)}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      >
        <Text
          testID={`${testIDPrefix}-${field}-text`}
          style={[styles.digits, isActive ? styles.digitsActive : styles.digitsInactive]}
        >
          {pad2(value)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <TouchableOpacity
      testID={`${testIDPrefix}-button`}
      style={[styles.box, activeField !== null && styles.boxActive]}
      activeOpacity={0.8}
      onPress={() => onSelectField("hour")}
    >
      {renderField("hour", hour)}
      <Text style={styles.colon}>:</Text>
      {renderField("minute", minute)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  boxActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  digits: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 20,
    paddingBottom: 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  digitsActive: {
    color: "#111",
    borderBottomColor: "#2f6fed",
  },
  digitsInactive: {
    color: "#999",
  },
  colon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },
});
