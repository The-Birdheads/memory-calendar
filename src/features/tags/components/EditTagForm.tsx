import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { lightenHexColor } from "../../../shared/utils/color";
import type { Tag, TagLevel, UpdateTagInput } from "../types";

export interface EditTagFormProps {
  tag: Tag;
  allTags: Tag[];
  onSave: (input: UpdateTagInput) => void;
}

export const TAG_COLORS: { name: string; hex: string }[] = [
  { name: "blue", hex: "#2f6fed" },
  { name: "red", hex: "#e53935" },
  { name: "green", hex: "#43a047" },
  { name: "orange", hex: "#fb8c00" },
  { name: "purple", hex: "#8e24aa" },
  { name: "teal", hex: "#00897b" },
  { name: "pink", hex: "#d81b60" },
];

// How much lighter each level gets, blended toward white, relative to its own parent's color.
const AUTO_SHADE_AMOUNT = 0.35;

const LEVELS: TagLevel[] = ["major", "mid", "minor"];
const LEVEL_LABELS: Record<TagLevel, string> = { major: "大分類", mid: "中分類", minor: "小分類" };
const PARENT_LEVEL: Partial<Record<TagLevel, TagLevel>> = { mid: "major", minor: "mid" };

function eligibleParentsFor(level: TagLevel, allTags: Tag[], excludeId: string): Tag[] {
  const parentLevel = PARENT_LEVEL[level];
  if (!parentLevel) return [];
  return allTags.filter((candidate) => candidate.level === parentLevel && candidate.id !== excludeId);
}

export function EditTagForm({ tag, allTags, onSave }: EditTagFormProps) {
  const [name, setName] = useState(tag.name);
  const [level, setLevel] = useState<TagLevel>(tag.level);
  const [parentId, setParentId] = useState<string | null>(tag.parentId);
  const [majorColor, setMajorColor] = useState(tag.level === "major" ? tag.color : TAG_COLORS[0].hex);

  const eligibleParentLevel = PARENT_LEVEL[level];
  const eligibleParents = eligibleParentsFor(level, allTags, tag.id);
  const parentTag = parentId ? allTags.find((candidate) => candidate.id === parentId) : undefined;
  const computedColor =
    level === "major" ? majorColor : lightenHexColor(parentTag?.color ?? majorColor, AUTO_SHADE_AMOUNT);

  const handleLevelChange = (nextLevel: TagLevel) => {
    if (nextLevel !== "major" && eligibleParentsFor(nextLevel, allTags, tag.id).length === 0) {
      return;
    }
    setLevel(nextLevel);
    setParentId(null);
  };

  const handleSave = () => {
    onSave({ name, color: computedColor, level, parentId: level === "major" ? null : parentId });
  };

  return (
    <View style={styles.container}>
      <TextInput testID="edit-tag-name-input" style={styles.input} value={name} onChangeText={setName} />

      {level === "major" ? (
        <View style={styles.colorRow}>
          {TAG_COLORS.map((color) => (
            <TouchableOpacity
              key={color.name}
              testID={`edit-tag-color-${color.name}`}
              style={[
                styles.colorSwatch,
                { backgroundColor: color.hex },
                majorColor === color.hex && styles.colorSwatchSelected,
              ]}
              onPress={() => setMajorColor(color.hex)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.autoColorRow}>
          <View
            testID="edit-tag-color-preview"
            style={[styles.colorSwatch, { backgroundColor: computedColor }]}
          />
          <Text style={styles.autoColorLabel}>親タグの色から自動設定されます</Text>
        </View>
      )}

      <View style={styles.levelRow}>
        {LEVELS.map((l) => {
          const isDisabled = l !== "major" && eligibleParentsFor(l, allTags, tag.id).length === 0;
          return (
            <TouchableOpacity
              key={l}
              testID={`edit-tag-level-${l}`}
              disabled={isDisabled}
              onPress={() => handleLevelChange(l)}
              style={[
                styles.levelButton,
                l === level && styles.levelButtonActive,
                isDisabled && styles.levelButtonDisabled,
              ]}
            >
              <Text style={isDisabled ? styles.levelButtonTextDisabled : undefined}>{LEVEL_LABELS[l]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {eligibleParentLevel ? (
        <View style={styles.parentRow}>
          {eligibleParents.map((candidate) => (
            <TouchableOpacity
              key={candidate.id}
              testID={`edit-tag-parent-${candidate.id}`}
              onPress={() => setParentId(candidate.id)}
              style={[styles.parentButton, candidate.id === parentId && styles.parentButtonActive]}
            >
              <Text>{candidate.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TouchableOpacity testID="edit-tag-save-button" style={styles.saveButton} onPress={handleSave}>
        <Text>保存</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: "#333",
  },
  autoColorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  autoColorLabel: {
    color: "#666",
    fontSize: 12,
  },
  levelRow: {
    flexDirection: "row",
    gap: 8,
  },
  levelButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  levelButtonDisabled: {
    opacity: 0.4,
  },
  levelButtonTextDisabled: {
    color: "#999",
  },
  parentRow: {
    flexDirection: "row",
    gap: 8,
  },
  parentButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  parentButtonActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  saveButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
