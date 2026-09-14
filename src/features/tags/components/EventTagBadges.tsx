import { StyleSheet, Text, View } from "react-native";

import type { Tag } from "../types";

export interface EventTagBadgesProps {
  tags: Tag[];
  /** タグの色が未設定の時に使う色。通常はその予定が属するカレンダーの色を
   * 渡す(「色未設定のタグはカレンダーの色で表示される」の実体)。 */
  fallbackColor?: string;
}

export function EventTagBadges({ tags, fallbackColor = "#999999" }: EventTagBadgesProps) {
  return (
    <View style={styles.container}>
      {tags.map((tag) => (
        <View
          key={tag.id}
          testID={`event-tag-badge-${tag.id}`}
          style={[styles.badge, { backgroundColor: tag.color ?? fallbackColor }]}
        >
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
