import { StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon";

/** Marks a screen/section as visible only to the caller (e.g. ToDo, tags) -
 * shared screens intentionally show nothing, so this badge calls out the
 * exception rather than labeling every screen. */
export function PersonalOnlyBadge() {
  return (
    <View style={styles.badge}>
      <Icon testID="personal-only-badge-lock-icon" name="lock" size={11} color="#666" />
      <Text style={styles.text}>個人用</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#f2f3f5",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    color: "#666",
  },
});
