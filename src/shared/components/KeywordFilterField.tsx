import { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";

export interface KeywordFilterFieldProps {
  testID: string;
  /** 現在反映済みのキーワード。シートを開くたびにここから始める。 */
  appliedValue: string;
  /** 入力中の(まだ絞り込みに反映していない)値を親に伝える。親の再描画は起こさない前提(refに入れる等)。 */
  onDraftChange: (value: string) => void;
}

/**
 * 絞り込みシート内のキーワード入力欄。入力中の文字は**この部品の中だけ**の
 * stateで持ち、親(画面)には再描画を起こさず値だけ渡す。画面側のstateを
 * 1文字ごとに更新すると、ヘッダー(絞り込みシート)ごと作り直されて日本語入力の
 * 変換中の文字が確定されてしまうため。絞り込みの反映は「絞り込み」ボタンで行う。
 */
export function KeywordFilterField({ testID, appliedValue, onDraftChange }: KeywordFilterFieldProps) {
  const [text, setText] = useState(appliedValue);

  // シートを開いた時点の下書きを反映済みの値に揃える(閉じる/再度開くで
  // 前回の未反映の入力が残らないように)。
  useEffect(() => {
    onDraftChange(appliedValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TextInput
      testID={testID}
      style={styles.input}
      placeholder="タイトルで検索"
      value={text}
      onChangeText={(next) => {
        setText(next);
        onDraftChange(next);
      }}
      returnKeyType="done"
      clearButtonMode="while-editing"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
});
