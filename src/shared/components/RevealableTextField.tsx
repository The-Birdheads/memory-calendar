import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from "react-native";

import { Icon } from "./Icon";

export interface RevealableTextFieldProps {
  /** testID of the TextInput once it's revealed (kept stable across "no
   * value yet"/"already has a value" so existing value-assertions in tests
   * don't have to know which state the field started in). */
  testID: string;
  /** testID of the "+ ○○を追加" button shown while the field is empty. */
  addButtonTestID: string;
  /** e.g. "場所を追加", "URLを追加", "メモを追加". */
  addLabel: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  returnKeyType?: TextInputProps["returnKeyType"];
  multiline?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * 場所・URL・メモのような必須ではない入力項目を、値が無い間は
 * 「+ ○○を追加」ボタンとして折りたたんでおき、タップすると入力欄が現れる
 * 形にする共通部品。空欄の入力欄がフォームにいくつも並ぶと、「埋めるべき
 * 項目」なのか「意図的に空けている」のか一覧性だけでは直感的に判断しづらい
 * - ボタンにしておけば「追加できる項目」であることが一目でわかる(2026-09)。
 * 既に値がある場合(編集時など)は最初から入力欄を表示する。一度ボタンを
 * 押して入力欄を出したら、その場では(空に戻しても)入力欄のまま維持する
 * - フォームを保存/再度開き直すと、その時点の値の有無で再判定される。
 */
export function RevealableTextField({
  testID,
  addButtonTestID,
  addLabel,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  returnKeyType,
  multiline,
  style,
}: RevealableTextFieldProps) {
  // 既に値がある(編集時など)なら最初から表示するが、それ自体はユーザーが
  // 今まさに追加ボタンを押したわけではないので、フォーカスは奪わない。
  const [manuallyRevealed, setManuallyRevealed] = useState(false);
  const isRevealed = manuallyRevealed || value !== "";

  if (!isRevealed) {
    return (
      <TouchableOpacity
        testID={addButtonTestID}
        style={styles.addButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => setManuallyRevealed(true)}
      >
        <Icon name="plus" size={12} color="#2f6fed" />
        <Text style={styles.addButtonText}>{addLabel}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TextInput
      testID={testID}
      style={[styles.input, style]}
      placeholder={placeholder}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      returnKeyType={returnKeyType}
      multiline={multiline}
      value={value}
      onChangeText={onChangeText}
      autoFocus={manuallyRevealed}
    />
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  addButtonText: {
    color: "#2f6fed",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
