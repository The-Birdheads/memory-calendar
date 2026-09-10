import type { StyleProp, TextStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";
import type { Calendar } from "../types";

export interface CalendarLabelProps {
  calendar: Calendar;
  textStyle?: StyleProp<TextStyle>;
  iconSize?: number;
}

/** Renders a calendar's name, prefixed with a lock icon when it's the personal
 * calendar, so it reads as distinct (auto-created, not deletable, invite-only-blocked)
 * wherever calendars are listed. */
export function CalendarLabel({ calendar, textStyle, iconSize = 12 }: CalendarLabelProps) {
  return (
    <View style={styles.row}>
      {calendar.kind === "personal" ? (
        <Icon name="lock" size={iconSize} color="#666" testID={`calendar-lock-icon-${calendar.id}`} />
      ) : null}
      <Text style={textStyle}>{calendar.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
