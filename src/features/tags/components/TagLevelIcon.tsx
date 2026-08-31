import { StyleSheet, View } from "react-native";

import type { TagLevel } from "../types";

export interface TagLevelIconProps {
  level: TagLevel;
  color: string;
  size?: number;
  testID?: string;
}

/**
 * A small shape that indicates a tag's level (大分類/中分類/小分類) at a glance,
 * independent of its own color: a circle for 大分類, a square for 中分類, and a
 * diamond for 小分類. Two same-colored tags at different levels no longer look
 * identical.
 */
export function TagLevelIcon({ level, color, size = 10, testID }: TagLevelIconProps) {
  if (level === "mid") {
    return (
      <View
        testID={testID}
        style={[styles.base, { width: size, height: size, borderRadius: 2, backgroundColor: color }]}
      />
    );
  }

  if (level === "minor") {
    const diamondSize = size * 0.8;
    return (
      <View
        testID={testID}
        style={[
          styles.base,
          {
            width: diamondSize,
            height: diamondSize,
            backgroundColor: color,
            transform: [{ rotate: "45deg" }],
          },
        ]}
      />
    );
  }

  return (
    <View
      testID={testID}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 0,
  },
});
