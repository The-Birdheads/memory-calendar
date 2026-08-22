import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { ReminderTargetsInput } from "../types";

export interface ReminderTargetsPickerProps {
  memberUserIds: string[];
  value: ReminderTargetsInput;
  onChange: (value: ReminderTargetsInput) => void;
}

export function ReminderTargetsPicker({ memberUserIds, value, onChange }: ReminderTargetsPickerProps) {
  const isAll = value === "all";

  const toggleMember = (userId: string) => {
    if (isAll) {
      onChange([userId]);
      return;
    }
    const current = value as string[];
    if (current.includes(userId)) {
      onChange(current.filter((id) => id !== userId));
    } else {
      onChange([...current, userId]);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity testID="reminder-target-all" style={styles.row} onPress={() => onChange("all")}>
        <Text>すべてのメンバー</Text>
        {isAll ? <Text testID="reminder-target-all-checked">✓</Text> : null}
      </TouchableOpacity>
      {memberUserIds.map((userId) => {
        const checked = !isAll && (value as string[]).includes(userId);
        return (
          <TouchableOpacity
            key={userId}
            testID={`reminder-target-member-${userId}`}
            style={styles.row}
            onPress={() => toggleMember(userId)}
          >
            <Text>{userId}</Text>
            {checked ? <Text testID={`reminder-target-member-${userId}-checked`}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
