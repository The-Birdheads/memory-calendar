import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useCreateTag, useDeleteTag, useTagTree, useUpdateTag } from "../hooks";
import { EditTagForm } from "./EditTagForm";
import { DeleteTagConfirmModal } from "./DeleteTagConfirmModal";
import type { Tag, TagTreeNode, UpdateTagInput } from "../types";

function flattenTagTree(nodes: TagTreeNode[]): TagTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTagTree(node.children)]);
}

function blankTag(calendarId: string): Tag {
  return { id: "", calendarId, parentId: null, level: "major", name: "", color: "#2f6fed", createdAt: "" };
}

function renderTagRow(node: TagTreeNode, depth: number, onSelect: (tag: Tag) => void) {
  return (
    <View key={node.id}>
      <TouchableOpacity
        testID={`tag-management-tag-${node.id}`}
        style={[styles.tagRow, { paddingLeft: 16 + depth * 16 }]}
        onPress={() => onSelect(node)}
      >
        <View style={[styles.colorDot, { backgroundColor: node.color }]} />
        <Text>{node.name}</Text>
      </TouchableOpacity>
      {node.children.map((child) => renderTagRow(child, depth + 1, onSelect))}
    </View>
  );
}

export interface TagManagementModalProps {
  calendars: { id: string; name: string }[];
  initialCalendarId: string;
  onClose: () => void;
  onChange?: () => void;
}

type Mode = "list" | "create" | "edit";

export function TagManagementModal({ calendars, initialCalendarId, onClose, onChange }: TagManagementModalProps) {
  const [calendarId, setCalendarId] = useState(initialCalendarId);
  const [mode, setMode] = useState<Mode>("list");
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { tagTree, refetch } = useTagTree(calendarId);
  const { createTag } = useCreateTag();
  const { updateTag } = useUpdateTag();
  const { deleteTag } = useDeleteTag();

  const allTags = flattenTagTree(tagTree);
  const deleteTargetHasChildren = deleteTargetId
    ? allTags.some((tag) => tag.parentId === deleteTargetId)
    : false;

  const backToList = () => {
    setMode("list");
    setSelectedTag(null);
  };

  const handleSelectCalendar = (id: string) => {
    setCalendarId(id);
    backToList();
  };

  const handleSelectTag = (tag: Tag) => {
    setSelectedTag(tag);
    setMode("edit");
  };

  const handleSaveNew = async (input: UpdateTagInput) => {
    const success = await createTag({
      calendarId,
      name: input.name ?? "",
      color: input.color ?? "#2f6fed",
      level: input.level ?? "major",
      parentId: input.parentId ?? null,
    });
    if (success) {
      await refetch();
      onChange?.();
      backToList();
    }
  };

  const handleSaveEdit = async (input: UpdateTagInput) => {
    if (!selectedTag) return;
    const success = await updateTag(selectedTag.id, input);
    if (success) {
      await refetch();
      onChange?.();
      backToList();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const success = await deleteTag(deleteTargetId);
    setDeleteTargetId(null);
    if (success) {
      await refetch();
      onChange?.();
      backToList();
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        testID="tag-management-backdrop"
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.title}>タグを管理</Text>
              <TouchableOpacity testID="tag-management-close" onPress={onClose}>
                <Text style={styles.closeText}>閉じる</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>カレンダー</Text>
            <View style={styles.calendarSwitcher}>
              {calendars.map((calendar) => (
                <TouchableOpacity
                  key={calendar.id}
                  testID={`tag-management-calendar-${calendar.id}`}
                  onPress={() => handleSelectCalendar(calendar.id)}
                  style={[
                    styles.calendarChip,
                    calendar.id === calendarId && styles.calendarChipActive,
                  ]}
                >
                  <Text>{calendar.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === "list" ? (
              <View style={styles.listSection}>
                <Text style={styles.sectionLabel}>タグ一覧（タップで編集）</Text>
                {tagTree.length === 0 ? (
                  <Text style={styles.emptyText}>まだタグがありません</Text>
                ) : (
                  <View>{tagTree.map((node) => renderTagRow(node, 0, handleSelectTag))}</View>
                )}
                <TouchableOpacity
                  testID="tag-management-new-button"
                  style={styles.newButton}
                  onPress={() => setMode("create")}
                >
                  <Text style={styles.newButtonText}>＋ 新規</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formSection}>
                <TouchableOpacity testID="tag-management-back-to-list" onPress={backToList}>
                  <Text style={styles.backText}>← 一覧に戻る</Text>
                </TouchableOpacity>

                {mode === "create" ? (
                  <EditTagForm tag={blankTag(calendarId)} allTags={allTags} onSave={handleSaveNew} />
                ) : selectedTag ? (
                  <>
                    <EditTagForm tag={selectedTag} allTags={allTags} onSave={handleSaveEdit} />
                    <TouchableOpacity
                      testID="tag-management-delete-button"
                      onPress={() => setDeleteTargetId(selectedTag.id)}
                    >
                      <Text style={styles.deleteText}>このタグを削除</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>

      <DeleteTagConfirmModal
        visible={deleteTargetId !== null}
        hasChildren={deleteTargetHasChildren}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    width: "88%",
    maxHeight: "80%",
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  sectionLabel: {
    color: "#666",
    fontSize: 12,
    marginBottom: 6,
  },
  calendarSwitcher: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  calendarChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  calendarChipActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
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
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  newButton: {
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
  backText: {
    color: "#2f6fed",
  },
  deleteText: {
    color: "#d32f2f",
    textAlign: "center",
    paddingVertical: 8,
  },
});
