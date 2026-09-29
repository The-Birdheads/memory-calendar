import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ColorSwatchPicker } from "../../../shared/components/ColorSwatchPicker";
import { Icon } from "../../../shared/components/Icon";
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
  /** 保存処理が実行中かどうか。連打で同じタグが複数作られるのを防ぐため、
   * 実行中は保存ボタンを無効化する(新規作成時のみ - 編集時は下記の通り)。 */
  isSubmitting?: boolean;
  /**
   * 既存タグの編集かどうか(false=新規作成)。編集時は名前を鉛筆アイコンでの
   * インライン編集にし、分類・親タグ・色は選択した瞬間にそれぞれ保存する
   * (決定用の✓ボタンは表示しない)。新規作成時はタグ自体がまだ存在しない
   * ため、従来通り全項目を入力してから1回の「作成」で保存する。
   */
  isEditing?: boolean;
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

export function EditTagForm({ tag, allTags, calendars, onSave, isSubmitting, isEditing }: EditTagFormProps) {
  const [name, setName] = useState(tag.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(tag.name);
  const [level, setLevel] = useState<TagLevel>(tag.level);
  const [parentId, setParentId] = useState<string | null>(tag.parentId);
  const [majorColor, setMajorColor] = useState<string | null>(tag.level === "major" ? tag.color : TAG_COLORS[0].hex);
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
  // 親(中分類なら大分類、小分類なら中分類)の色を自動で薄めた色にする。親の
  // 色が未設定の場合は薄める元の色が無いため、そのまま未設定を引き継ぐ
  // (`??`だと親のcolorが明示的にnullの時もmajorColorへフォールバックして
  // しまうため、parentTagの有無で分岐する)。
  const baseColorForChild = parentTag ? parentTag.color : majorColor;
  const computedColor =
    level === "major"
      ? majorColor
      : baseColorForChild !== null
        ? lightenHexColor(baseColorForChild, AUTO_SHADE_AMOUNT)
        : null;

  const handleLevelChange = (nextLevel: TagLevel) => {
    if (nextLevel !== "major" && eligibleParentsFor(nextLevel, allTags, tag.id).length === 0) {
      return;
    }
    setLevel(nextLevel);
    setParentId(null);
    setGrandparentId(null);
    // 大分類への変更は親タグ不要でその場で状態が確定するので即保存する。
    // 中分類/小分類への変更は親タグを選ぶまで未確定のまま(下のparent選択で保存)。
    if (isEditing && nextLevel === "major") {
      onSave({ level: "major", parentId: null, color: majorColor });
    }
  };

  const handleSelectGrandparent = (nextGrandparentId: string) => {
    setGrandparentId(nextGrandparentId);
    setParentId(null);
  };

  const handleSelectParent = (newParentId: string) => {
    setParentId(newParentId);
    if (isEditing) {
      const newParentTag = allTags.find((candidate) => candidate.id === newParentId);
      const newColor =
        newParentTag && newParentTag.color !== null ? lightenHexColor(newParentTag.color, AUTO_SHADE_AMOUNT) : null;
      onSave({ level, parentId: newParentId, color: newColor });
    }
  };

  const handleSelectMajorColor = (hex: string | null) => {
    setMajorColor(hex);
    if (isEditing) {
      onSave({ color: hex });
    }
  };

  const handleStartEditName = () => {
    setNameDraft(name);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
  };

  const handleConfirmEditName = () => {
    setName(nameDraft);
    setIsEditingName(false);
    onSave({ name: nameDraft });
  };

  const handleSave = () => {
    if (isSubmitting) return;
    onSave({ name, color: computedColor, level, parentId: level === "major" ? null : parentId });
  };

  return (
    <View style={styles.container}>
      {isEditing ? (
        isEditingName ? (
          <View style={styles.nameRow}>
            <TextInput
              testID="edit-tag-name-input"
              style={[styles.input, styles.nameInput]}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
            />
            <TouchableOpacity
              testID="edit-tag-name-confirm"
              onPress={handleConfirmEditName}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.confirmCheck}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="edit-tag-name-cancel"
              onPress={handleCancelEditName}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text testID="edit-tag-name-display" style={styles.nameDisplay}>
              {name}
            </Text>
            <TouchableOpacity
              testID="edit-tag-name-edit"
              onPress={handleStartEditName}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="edit" size={16} color="#2f6fed" />
            </TouchableOpacity>
          </View>
        )
      ) : (
        <TextInput testID="edit-tag-name-input" style={styles.input} value={name} onChangeText={setName} />
      )}

      {level === "major" ? (
        <ColorSwatchPicker
          testIDPrefix="edit-tag-color"
          selected={majorColor}
          onSelect={handleSelectMajorColor}
          usageByColor={usageByColor}
          allowUnset
        />
      ) : (
        <View style={styles.parentTagRow}>
          <Text style={styles.parentTagLabel}>親タグ</Text>
          {parentTag ? (
            <View
              testID="edit-tag-parent-tag-badge"
              style={[styles.parentTagBadge, { backgroundColor: parentTag.color ?? "#999999" }]}
            >
              <Text style={styles.parentTagBadgeText}>{parentTag.name}</Text>
            </View>
          ) : (
            <Text testID="edit-tag-parent-tag-unselected" style={styles.parentTagUnselected}>
              未選択
            </Text>
          )}
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
          <View testID="edit-tag-grandparent-row" style={styles.parentRow}>
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
            <View testID="edit-tag-parent-row" style={styles.parentRow}>
              {midChildrenOfGrandparent.map((mid) => (
                <TouchableOpacity
                  key={mid.id}
                  testID={`edit-tag-parent-${mid.id}`}
                  onPress={() => handleSelectParent(mid.id)}
                  style={[styles.parentButton, mid.id === parentId && styles.parentButtonActive]}
                >
                  <Text>{mid.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </>
      ) : eligibleParentLevel ? (
        <View testID="edit-tag-parent-row" style={styles.parentRow}>
          {eligibleParents.map((candidate) => (
            <TouchableOpacity
              key={candidate.id}
              testID={`edit-tag-parent-${candidate.id}`}
              onPress={() => handleSelectParent(candidate.id)}
              style={[styles.parentButton, candidate.id === parentId && styles.parentButtonActive]}
            >
              <Text>{candidate.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {isEditing ? null : (
        <TouchableOpacity
          testID="edit-tag-save-button"
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
          disabled={isSubmitting}
          onPress={handleSave}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.saveButtonText}>✓</Text>
        </TouchableOpacity>
      )}
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameInput: {
    flex: 1,
  },
  nameDisplay: {
    flex: 1,
    fontSize: 15,
  },
  confirmCheck: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f6fed",
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  parentTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  parentTagLabel: {
    color: "#666",
    fontSize: 12,
  },
  parentTagBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  parentTagBadgeText: {
    color: "#fff",
    fontSize: 12,
  },
  parentTagUnselected: {
    color: "#999",
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
    flexWrap: "wrap",
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
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2f6fed",
  },
});
