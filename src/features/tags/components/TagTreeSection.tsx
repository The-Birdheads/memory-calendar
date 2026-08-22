import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { TagLevel, TagTreeNode } from "../types";

export interface CreateTagFormValue {
  name: string;
  color: string;
  level: TagLevel;
  parentId?: string;
}

export interface TagTreeSectionProps {
  tagTree: TagTreeNode[];
  onCreateTag: (value: CreateTagFormValue) => void;
}

const LEVELS: TagLevel[] = ["major", "mid", "minor"];
const LEVEL_LABELS: Record<TagLevel, string> = { major: "大分類", mid: "中分類", minor: "小分類" };
const PARENT_LEVEL: Partial<Record<TagLevel, TagLevel>> = { mid: "major", minor: "mid" };

function flattenTags(nodes: TagTreeNode[]): TagTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTags(node.children)]);
}

function renderNode(node: TagTreeNode, depth: number) {
  return (
    <View key={node.id}>
      <View style={[styles.tagRow, { paddingLeft: 16 + depth * 16 }]} testID={`tag-item-${node.id}`}>
        <View style={[styles.colorDot, { backgroundColor: node.color }]} />
        <Text>{node.name}</Text>
      </View>
      {node.children.map((child) => renderNode(child, depth + 1))}
    </View>
  );
}

export function TagTreeSection({ tagTree, onCreateTag }: TagTreeSectionProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2f6fed");
  const [level, setLevel] = useState<TagLevel>("major");
  const [parentId, setParentId] = useState<string | undefined>(undefined);

  const allTags = flattenTags(tagTree);
  const eligibleParentLevel = PARENT_LEVEL[level];
  const eligibleParents = eligibleParentLevel
    ? allTags.filter((tag) => tag.level === eligibleParentLevel)
    : [];

  const handleLevelChange = (nextLevel: TagLevel) => {
    setLevel(nextLevel);
    setParentId(undefined);
  };

  const handleSubmit = () => {
    onCreateTag({ name, color, level, parentId: level === "major" ? undefined : parentId });
    setName("");
  };

  return (
    <View style={styles.container}>
      <View>{tagTree.map((node) => renderNode(node, 0))}</View>

      <TextInput
        testID="tag-name-input"
        style={styles.input}
        placeholder="タグ名"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        testID="tag-color-input"
        style={styles.input}
        placeholder="#RRGGBB"
        value={color}
        onChangeText={setColor}
      />

      <View style={styles.levelRow}>
        {LEVELS.map((l) => (
          <TouchableOpacity
            key={l}
            testID={`tag-level-${l}`}
            onPress={() => handleLevelChange(l)}
            style={[styles.levelButton, l === level && styles.levelButtonActive]}
          >
            <Text>{LEVEL_LABELS[l]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {eligibleParentLevel ? (
        <View style={styles.parentRow}>
          {eligibleParents.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              testID={`tag-parent-${tag.id}`}
              onPress={() => setParentId(tag.id)}
              style={[styles.parentButton, tag.id === parentId && styles.parentButtonActive]}
            >
              <Text>{tag.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TouchableOpacity testID="tag-create-submit" style={styles.submitButton} onPress={handleSubmit}>
        <Text>作成</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
  },
  levelRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
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
  submitButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
});
