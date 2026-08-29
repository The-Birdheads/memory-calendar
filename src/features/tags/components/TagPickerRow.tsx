import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Tag } from "../types";

export interface TagPickerRowProps {
  testIDPrefix: string;
  availableTags: Tag[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
}

/**
 * Toggle-style tag chip picker shared by the event create and edit forms, so
 * both flows offer the same "select the calendar's tags for this event" UX.
 */
export function TagPickerRow({ testIDPrefix, availableTags, selectedTagIds, onToggle }: TagPickerRowProps) {
  if (availableTags.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>タグ</Text>
      <View style={styles.row}>
        {availableTags.map((tag) => {
          const selected = selectedTagIds.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              testID={`${testIDPrefix}-tag-${tag.id}`}
              style={[styles.chip, { borderColor: tag.color }, selected && { backgroundColor: tag.color }]}
              onPress={() => onToggle(tag.id)}
            >
              <Text style={selected ? styles.chipTextSelected : undefined}>{tag.name}</Text>
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
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
});
