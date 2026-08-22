import { StyleSheet, Text, View } from "react-native";

import type { Tag } from "../types";

export interface EventTagBadgesProps {
  tags: Tag[];
}

export function EventTagBadges({ tags }: EventTagBadgesProps) {
  return (
    <View style={styles.container}>
      {tags.map((tag) => (
        <View key={tag.id} testID={`event-tag-badge-${tag.id}`} style={[styles.badge, { backgroundColor: tag.color }]}>
          <Text style={styles.label}>{tag.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    color: "#fff",
    fontSize: 12,
  },
});
