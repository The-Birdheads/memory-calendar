import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ColorSwatchPicker } from "../../../shared/components/ColorSwatchPicker";
import { COLOR_PALETTE } from "../../../shared/constants/colorPalette";
import { lightenHexColor } from "../../../shared/utils/color";
import { findColorUsage, type ColorUsageEntry } from "../../../shared/utils/colorUsage";
import type { Calendar } from "../../calendars/types";
import type { Tag, TagLevel, UpdateTagInput } from "../types";

export interface EditTagFormProps {
  tag: Tag;
  allTags: Tag[];
  /** 大分類の色選択で、既に他のカレンダー/タグが使っている色を教えるために使う。 */
  calendars: Calendar[];
  onSave: (input: UpdateTagInput) => void;
}

export const TAG_COLORS = COLOR_PALETTE;

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

export function EditTagForm({ tag, allTags, calendars, onSave }: EditTagFormProps) {
  const [name, setName] = useState(tag.name);
  const [level, setLevel] = useState<TagLevel>(tag.level);
  const [parentId, setParentId] = useState<string | null>(tag.parentId);
  const [majorColor, setMajorColor] = useState(tag.level === "major" ? tag.color : TAG_COLORS[0].hex);
  const usageByColor = useMemo<Record<string, ColorUsageEntry>>(
    () =>
      Object.fromEntries(
        COLOR_PALETTE.map((color) => [
          color.hex,
          findColorUsage(color.hex, calendars, allTags, { excludeTagId: tag.id }),
        ])
      ),
    [calendars, allTags, tag.id]
  );
  // For a 小分類 (minor) tag, the parent (中分類) is chosen in two steps: first
  // pick its 大分類, then pick one of that 大分類's 中分類 children as the
  // actual parent. grandparentId tracks the first step.
  const [grandparentId, setGrandparentId] = useState<string | null>(() => {
    if (tag.level !== "minor" || !tag.parentId) return null;
    return allTags.find((candidate) => candidate.id === tag.parentId)?.parentId ?? null;
  });

  const eligibleParentLevel = PARENT_LEVEL[level];
  const eligibleParents = eligibleParentsFor(level, allTags, tag.id);
  const majorTags = allTags.filter((candidate) => candidate.level === "major");
  const midChildrenOfGrandparent = grandparentId
    ? allTags.filter(
        (candidate) => candidate.level === "mid" && candidate.parentId === grandparentId && candidate.id !== tag.id
      )
    : [];
  const parentTag = parentId ? allTags.find((candidate) => candidate.id === parentId) : undefined;
  const computedColor =
    level === "major" ? majorColor : lightenHexColor(parentTag?.color ?? majorColor, AUTO_SHADE_AMOUNT);

  const handleLevelChange = (nextLevel: TagLevel) => {
    if (nextLevel !== "major" && eligibleParentsFor(nextLevel, allTags, tag.id).length === 0) {
      return;
    }
    setLevel(nextLevel);
    setParentId(null);
    setGrandparentId(null);
  };

  const handleSelectGrandparent = (nextGrandparentId: string) => {
    setGrandparentId(nextGrandparentId);
    setParentId(null);
  };

  const handleSave = () => {
    onSave({ name, color: computedColor, level, parentId: level === "major" ? null : parentId });
  };

  return (
    <View style={styles.container}>
      <TextInput testID="edit-tag-name-input" style={styles.input} value={name} onChangeText={setName} />

      {level === "major" ? (
        <ColorSwatchPicker
          testIDPrefix="edit-tag-color"
          selected={majorColor}
          onSelect={setMajorColor}
          usageByColor={usageByColor}
        />
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

      {level === "minor" ? (
        <>
          <View style={styles.parentRow}>
            {majorTags.map((major) => (
              <TouchableOpacity
                key={major.id}
                testID={`edit-tag-grandparent-${major.id}`}
                onPress={() => handleSelectGrandparent(major.id)}
                style={[styles.parentButton, major.id === grandparentId && styles.parentButtonActive]}
              >
                <Text>{major.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {grandparentId ? (
            <View style={styles.parentRow}>
              {midChildrenOfGrandparent.map((mid) => (
                <TouchableOpacity
                  key={mid.id}
                  testID={`edit-tag-parent-${mid.id}`}
                  onPress={() => setParentId(mid.id)}
                  style={[styles.parentButton, mid.id === parentId && styles.parentButtonActive]}
                >
                  <Text>{mid.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </>
      ) : eligibleParentLevel ? (
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

      <TouchableOpacity
        testID="edit-tag-save-button"
        style={styles.saveButton}
        onPress={handleSave}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.saveButtonText}>✓</Text>
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
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
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
  saveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f6fed",
  },
});
