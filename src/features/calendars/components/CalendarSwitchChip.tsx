import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { CalendarLabel } from "./CalendarLabel";
import type { Calendar } from "../types";

export interface CalendarSwitchChipProps {
  calendar: Calendar;
  isActive: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * A single calendar toggle chip, shared by every screen that offers the
 * "default all calendars selected, tap to show/hide" multi-select switcher
 * (calendar/todos/history/memories - see .kiro/steering/ui.md #7). Kept as
 * one component so the chip's look stays in sync everywhere instead of
 * drifting screen by screen.
 */
export function CalendarSwitchChip({ calendar, isActive, onPress, testID }: CalendarSwitchChipProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.chip, isActive && styles.chipActive]}
    >
      {isActive ? (
        <Text testID={testID ? `${testID}-check` : undefined} style={styles.check}>
          ✓
        </Text>
      ) : null}
      <CalendarLabel
        calendar={calendar}
        iconSize={14}
        textStyle={[styles.label, isActive && styles.labelActive]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderWidth: 2,
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  check: {
    color: "#0c447c",
    fontWeight: "700",
    fontSize: 15,
  },
  label: {
    fontSize: 15,
  },
  labelActive: {
    color: "#0c447c",
    fontWeight: "700",
  },
});
