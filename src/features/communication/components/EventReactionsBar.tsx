import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { EventReaction } from "../types";

const STAMP_OPTIONS = ["👍", "❤️", "😂", "😮", "😢"];

export interface EventReactionsBarProps {
  reactions: EventReaction[];
  onAddReaction: (stampType: string) => void;
}

export function EventReactionsBar({ reactions, onAddReaction }: EventReactionsBarProps) {
  const counts = reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.stampType] = (acc[reaction.stampType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        {Object.entries(counts).map(([stampType, count]) => (
          <View key={stampType} style={styles.summaryItem}>
            <Text testID={`event-reaction-summary-${stampType}`}>
              {stampType} {count}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.optionsRow}>
        {STAMP_OPTIONS.map((stampType) => (
          <TouchableOpacity
            key={stampType}
            testID={`event-reaction-add-${stampType}`}
            style={styles.optionButton}
            onPress={() => onAddReaction(stampType)}
          >
            <Text>{stampType}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 12,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryItem: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
