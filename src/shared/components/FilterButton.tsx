import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { FilterIcon } from "./FilterIcon";

export interface FilterButtonProps {
  /** Base testID - also prefixes the close/reset/apply/active-indicator testIDs. */
  testID: string;
  /** Whether to show the small active-indicator dot on the collapsed icon. */
  isActive: boolean;
  onReset: () => void;
  /**
   * 指定すると、シート下部の「閉じる」の左に「絞り込み」ボタンが出る。押すと
   * このコールバックを呼んでシートを閉じる。入力のたびに絞り込みが走ると
   * 日本語の変換が途切れるキーワード入力のように、「確定してから一括で
   * 反映したい」フィルターがある時に使う(未指定ならボタン自体を出さない)。
   */
  onApply?: () => void;
  /** The filter controls to show inside the sheet (e.g. FilterSection blocks). */
  children: ReactNode;
}

/**
 * A single common "絞り込み" (filter) entry point, shared by any screen that
 * lets the user narrow things down by calendar/tag/period/etc. Collapsed, it
 * is just one icon (so it costs no vertical space when not in use); tapping
 * it opens a bottom sheet with whatever filter controls the caller passes in
 * as children - this component only owns the trigger/sheet chrome
 * (open/close, reset link, active indicator), not any particular filter's
 * own selection logic, so each screen stays free to offer only the
 * dimensions (calendar/tag/period/...) that make sense for it.
 */
export function FilterButton({ testID, isActive, onReset, onApply, children }: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TouchableOpacity testID={testID} style={styles.trigger} onPress={() => setIsOpen(true)}>
        {/* 絞り込み中は青の塗りつぶし+白いアイコンにして、効いていることが
            一目で分かるようにする(小さな赤い点だと気づきにくかった)。 */}
        <View
          testID={isActive ? `${testID}-active-indicator` : undefined}
          style={[styles.iconBox, isActive && styles.iconBoxActive]}
        >
          <FilterIcon size={18} color={isActive ? "#fff" : "#444"} />
        </View>
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        {/* キーワード入力欄などでキーボードが開いても、下端に張り付いたシートが
            キーボードの下に隠れないよう持ち上げる。 */}
        <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity
            testID={`${testID}-overlay`}
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          >
            {/* Swallows the press so tapping the sheet itself doesn't bubble up
                to the overlay's onPress (which would close it) - only tapping
                outside the sheet should close it. */}
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.sheet}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>絞り込み</Text>
                  <TouchableOpacity testID={`${testID}-reset`} onPress={onReset}>
                    <Text style={styles.resetLink}>リセット</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.sheetBody}>{children}</ScrollView>

                <View style={styles.footer}>
                  {onApply ? (
                    <TouchableOpacity
                      testID={`${testID}-apply`}
                      style={[styles.footerButton, styles.applyButton]}
                      onPress={() => {
                        onApply();
                        setIsOpen(false);
                      }}
                    >
                      <Text style={styles.applyButtonText}>絞り込み</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    testID={`${testID}-close`}
                    style={[styles.footerButton, styles.closeButton]}
                    onPress={() => setIsOpen(false)}
                  >
                    <Text style={styles.closeButtonText}>閉じる</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export interface FilterSectionProps {
  title: string;
  children: ReactNode;
}

/** A titled group of filter controls inside a FilterButton's sheet (e.g. "カレンダー", "タグ", "期間"). */
export function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    padding: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxActive: {
    backgroundColor: "#2f6fed",
  },
  keyboardAvoider: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  resetLink: {
    color: "#2f6fed",
    fontWeight: "700",
    fontSize: 14,
  },
  sheetBody: {
    paddingHorizontal: 20,
  },
  section: {
    paddingTop: 14,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#f2f3f5",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    marginBottom: 8,
  },
  sectionContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 8,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  footerButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
  },
  applyButton: {
    backgroundColor: "#2f6fed",
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    backgroundColor: "#f2f3f5",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
  },
});
