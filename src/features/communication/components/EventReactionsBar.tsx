import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { EventReaction } from "../types";

const STAMP_OPTIONS = ["👍", "❤️", "😂", "😮", "😢"];

export interface EventReactionsBarProps {
  reactions: EventReaction[];
  /** The signed-in user's id, used to highlight their own current reaction (if any). */
  currentUserId?: string;
  /**
   * Called with the pressed stamp type. A user has at most one active
   * reaction: pressing their current stamp again removes it, pressing a
   * different one switches to it.
   */
  onToggleReaction: (stampType: string) => void;
}

export function EventReactionsBar({ reactions, currentUserId, onToggleReaction }: EventReactionsBarProps) {
  const counts = reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.stampType] = (acc[reaction.stampType] ?? 0) + 1;
    return acc;
  }, {});

  const myStampType = reactions.find((reaction) => reaction.userId === currentUserId)?.stampType ?? null;

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
            style={[styles.optionButton, stampType === myStampType && styles.optionButtonSelected]}
            onPress={() => onToggleReaction(stampType)}
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionButtonSelected: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
});
