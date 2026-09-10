import { useState, type ReactNode } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { FilterIcon } from "./FilterIcon";

export interface FilterButtonProps {
  /** Base testID - also prefixes the close/reset/active-dot testIDs. */
  testID: string;
  /** Whether to show the small active-indicator dot on the collapsed icon. */
  isActive: boolean;
  onReset: () => void;
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
export function FilterButton({ testID, isActive, onReset, children }: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TouchableOpacity testID={testID} style={styles.trigger} onPress={() => setIsOpen(true)}>
        <FilterIcon size={18} color="#444" />
        {isActive ? <View testID={`${testID}-active-dot`} style={styles.activeDot} /> : null}
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
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

              <TouchableOpacity
                testID={`${testID}-close`}
                style={styles.closeButton}
                onPress={() => setIsOpen(false)}
              >
                <Text style={styles.closeButtonText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
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
  activeDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e24b4a",
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
  closeButton: {
    alignItems: "center",
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: "#f2f3f5",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444",
  },
});
