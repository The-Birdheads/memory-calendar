import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useMyCalendars } from "../../src/features/calendars/hooks";
import { usePastEventsByTag } from "../../src/features/history/hooks";
import { useTagTree } from "../../src/features/tags/hooks";
import { flattenVisibleTagTree, getAncestorChainIds } from "../../src/features/tags/tagTree";
import type { TagTreeNode } from "../../src/features/tags/types";
import { formatDateTime } from "../../src/shared/utils/formatDateTime";

function flattenTags(nodes: TagTreeNode[]): TagTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTags(node.children)]);
}

export default function HistoryScreen() {
  const { calendars } = useMyCalendars();
  const activeCalendarId = calendars[0]?.id ?? "";

  const { tagTree } = useTagTree(activeCalendarId);
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(undefined);
  const { events } = usePastEventsByTag(activeCalendarId, selectedTagId);

  // 大分類 → 中分類 → 小分類 の順にドリルダウンして選択肢を表示する。
  const allTagsFlat = useMemo(() => flattenTags(tagTree), [tagTree]);
  const expandedTagIds = useMemo(
    () => getAncestorChainIds(selectedTagId, allTagsFlat),
    [selectedTagId, allTagsFlat]
  );
  const visibleTags = useMemo(
    () => flattenVisibleTagTree(tagTree, expandedTagIds),
    [tagTree, expandedTagIds]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>振り返り</Text>

      <ScrollView horizontal style={styles.filterList}>
        <TouchableOpacity
          testID="history-tag-filter-all"
          onPress={() => setSelectedTagId(undefined)}
          style={[styles.filterChip, selectedTagId === undefined && styles.filterChipActive]}
        >
          <Text>すべて</Text>
        </TouchableOpacity>
        {visibleTags.map((tag) => (
          <TouchableOpacity
            key={tag.id}
            testID={`history-tag-filter-${tag.id}`}
            onPress={() => setSelectedTagId(tag.id)}
            style={[styles.filterChip, selectedTagId === tag.id && styles.filterChipActive]}
          >
            <Text>{tag.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text>該当する予定がありません</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.eventRow} testID={`history-event-${item.id}`}>
              <Text>{item.title}</Text>
              <Text style={styles.meta}>{formatDateTime(item.startAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    padding: 12,
  },
  filterList: {
    flexGrow: 0,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  filterChipActive: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
});
