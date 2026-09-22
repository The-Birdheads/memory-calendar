import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { flattenVisibleTagTree } from "../tagTree";
import type { TagTreeNode } from "../types";

export interface TagPickerRowProps {
  testIDPrefix: string;
  tagTree: TagTreeNode[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  /** Omits the picker's own 「タグ」 label - for embedding under a caller-supplied heading that already says so. */
  hideLabel?: boolean;
}

/**
 * Toggle-style tag chip picker shared by the event create and edit forms.
 * Only 大分類 (major) tags are shown at first; selecting one reveals its
 * 中分類 children, and selecting one of those reveals its 小分類 children,
 * so the picker drills down one level at a time instead of dumping every
 * tag in the calendar into one flat list.
 */
export function TagPickerRow({ testIDPrefix, tagTree, selectedTagIds, onToggle, hideLabel }: TagPickerRowProps) {
  const visibleTags = flattenVisibleTagTree(tagTree, selectedTagIds);

  if (visibleTags.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {hideLabel ? null : <Text style={styles.label}>タグ</Text>}
      <View style={styles.row}>
        {visibleTags.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              testID={`${testIDPrefix}-tag-${tag.id}`}
              style={[
                styles.chip,
                { backgroundColor: tag.color ?? "#999999", borderColor: tag.color ?? "#999999" },
                selected && styles.chipSelected,
              ]}
              onPress={() => onToggle(tag.id)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {selected ? (
                <Text testID={`${testIDPrefix}-tag-${tag.id}-check`} style={styles.check}>
                  ✓{" "}
                </Text>
              ) : null}
              <Text style={styles.chipText}>{tag.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 6,
  },
  label: {
    color: "#666",
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  // カレンダー/すべて・未設定の絞り込みチップ(CalendarSwitchChip、history.tsx
  // のfilterChip)と同じ大きさ・角丸に揃える - 選択時はborderWidthが1→2に
  // 太くなる分だけpaddingを1px減らし、見た目の外形サイズを変えない。
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    borderWidth: 2,
    borderColor: "#222",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipText: {
    color: "#fff",
    fontSize: 15,
  },
  check: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
