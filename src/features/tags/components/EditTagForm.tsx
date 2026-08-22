import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { Tag, TagLevel, UpdateTagInput } from "../types";

export interface EditTagFormProps {
  tag: Tag;
  allTags: Tag[];
  onSave: (input: UpdateTagInput) => void;
}

const LEVELS: TagLevel[] = ["major", "mid", "minor"];
const LEVEL_LABELS: Record<TagLevel, string> = { major: "大分類", mid: "中分類", minor: "小分類" };
const PARENT_LEVEL: Partial<Record<TagLevel, TagLevel>> = { mid: "major", minor: "mid" };

export function EditTagForm({ tag, allTags, onSave }: EditTagFormProps) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [level, setLevel] = useState<TagLevel>(tag.level);
  const [parentId, setParentId] = useState<string | null>(tag.parentId);

  const eligibleParentLevel = PARENT_LEVEL[level];
  const eligibleParents = eligibleParentLevel
    ? allTags.filter((candidate) => candidate.level === eligibleParentLevel && candidate.id !== tag.id)
    : [];

  const handleLevelChange = (nextLevel: TagLevel) => {
    setLevel(nextLevel);
    setParentId(null);
  };

  const handleSave = () => {
    onSave({ name, color, level, parentId: level === "major" ? null : parentId });
  };

  return (
    <View style={styles.container}>
      <TextInput
        testID="edit-tag-name-input"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        testID="edit-tag-color-input"
        style={styles.input}
        value={color}
        onChangeText={setColor}
      />

      <View style={styles.levelRow}>
        {LEVELS.map((l) => (
          <TouchableOpacity
            key={l}
            testID={`edit-tag-level-${l}`}
            onPress={() => handleLevelChange(l)}
            style={[styles.levelButton, l === level && styles.levelButtonActive]}
          >
            <Text>{LEVEL_LABELS[l]}</Text>
          </TouchableOpacity>
        ))}
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
