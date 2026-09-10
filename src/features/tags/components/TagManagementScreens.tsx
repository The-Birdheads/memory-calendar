import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useMyCalendars } from "../../calendars/hooks";
import { useCreateTag, useDeleteTag, useTagTree, useUpdateTag } from "../hooks";
import { flattenTagTree } from "../tagTree";
import { EditTagForm } from "./EditTagForm";
import { DeleteTagConfirmModal } from "./DeleteTagConfirmModal";
import { TagLevelIcon } from "./TagLevelIcon";
import { Icon } from "../../../shared/components/Icon";
import { PersonalOnlyBadge } from "../../../shared/components/PersonalOnlyBadge";
import type { Tag, TagTreeNode, UpdateTagInput } from "../types";

/** タグ管理まわりの各画面 - すべて中身のみ(Modal/ヘッダー/戻るボタンを持た
 * ない)。ナビゲーションは SettingsHubModal が持つ単一の画面スタックに委ねる。 */

function blankTag(): Tag {
  return { id: "", parentId: null, level: "major", name: "", color: "#2f6fed", createdAt: "" };
}

function renderTagRow(node: TagTreeNode, depth: number, onSelect: (tag: Tag) => void) {
  return (
    <View key={node.id}>
      <TouchableOpacity
        testID={`tag-management-tag-${node.id}`}
        style={[styles.tagRow, { paddingLeft: 16 + depth * 16 }]}
        onPress={() => onSelect(node)}
      >
        <TagLevelIcon testID={`tag-management-tag-icon-${node.id}`} level={node.level} color={node.color} />
        <Text>{node.name}</Text>
      </TouchableOpacity>
      {node.children.map((child) => renderTagRow(child, depth + 1, onSelect))}
    </View>
  );
}

export interface TagListScreenProps {
  onSelectTag: (tag: Tag) => void;
  onStartCreate: () => void;
}

export function TagListScreen({ onSelectTag, onStartCreate }: TagListScreenProps) {
  const { tagTree } = useTagTree();

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.listSection}>
        <PersonalOnlyBadge />
        <Text style={styles.sectionLabel}>タグ一覧（タップで編集）</Text>
        {tagTree.length === 0 ? (
          <Text style={styles.emptyText}>まだタグがありません</Text>
        ) : (
          <View>{tagTree.map((node) => renderTagRow(node, 0, onSelectTag))}</View>
        )}
        <TouchableOpacity testID="tag-management-new-button" style={styles.newButton} onPress={onStartCreate}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={styles.newButtonText}>新規</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export interface TagFormScreenProps {
  /** null なら新規作成、指定されていれば既存タグの編集。 */
  tagId: string | null;
  onChange?: () => void;
  onSaved: () => void;
}

export function TagFormScreen({ tagId, onChange, onSaved }: TagFormScreenProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { tagTree, refetch } = useTagTree();
  const { calendars } = useMyCalendars();
  const { createTag } = useCreateTag();
  const { updateTag } = useUpdateTag();
  const { deleteTag } = useDeleteTag();

  const allTags = flattenTagTree(tagTree);
  const selectedTag = tagId ? (allTags.find((tag) => tag.id === tagId) ?? null) : null;
  const deleteTargetHasChildren = deleteTargetId
    ? allTags.some((tag) => tag.parentId === deleteTargetId)
    : false;

  const handleSave = async (input: UpdateTagInput) => {
    const success = tagId
      ? await updateTag(tagId, input)
      : await createTag({
          name: input.name ?? "",
          color: input.color ?? "#2f6fed",
          level: input.level ?? "major",
          parentId: input.parentId ?? null,
        });
    if (success) {
      await refetch();
      onChange?.();
      onSaved();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const success = await deleteTag(deleteTargetId);
    setDeleteTargetId(null);
    if (success) {
      await refetch();
      onChange?.();
      onSaved();
    }
  };

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.formSection}>
          <EditTagForm tag={selectedTag ?? blankTag()} allTags={allTags} calendars={calendars} onSave={handleSave} />
          {tagId && selectedTag ? (
            <TouchableOpacity testID="tag-management-delete-button" onPress={() => setDeleteTargetId(selectedTag.id)}>
              <Text style={styles.deleteText}>このタグを削除</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <DeleteTagConfirmModal
        visible={deleteTargetId !== null}
        hasChildren={deleteTargetHasChildren}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: "#666",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  listSection: {
    gap: 8,
  },
  emptyText: {
    color: "#999",
    paddingVertical: 8,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#2f6fed",
  },
  newButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  formSection: {
    gap: 12,
  },
  deleteText: {
    color: "#d32f2f",
    textAlign: "center",
    paddingVertical: 8,
  },
});
