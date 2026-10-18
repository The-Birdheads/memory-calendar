import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { UserAvatar } from "../../../shared/components/UserAvatar";
import { useAvatarUrls } from "../../profile/avatarHooks";
import type { AssigneeAvatarsPerson } from "./AssigneeAvatars";

export interface AssigneePickerProps {
  testIDPrefix: string;
  /** 候補: 共有カレンダーに所属しているアカウント。 */
  members: AssigneeAvatarsPerson[];
  selectedIds: string[];
  currentUserId: string | null;
  onToggle: (userId: string) => void;
}

/** 予定の対象者(任意・複数可)を、カレンダーのメンバーから選ぶ。 */
export function AssigneePicker({ testIDPrefix, members, selectedIds, currentUserId, onToggle }: AssigneePickerProps) {
  const urls = useAvatarUrls(members.flatMap((member) => (member.avatarPath ? [member.avatarPath] : [])));

  return (
    <View testID={`${testIDPrefix}-section`} style={styles.container}>
      <Text style={styles.label}>対象者(任意)</Text>
      <View style={styles.chips}>
        {members.map((member) => {
          const selected = selectedIds.includes(member.userId);
          const name = member.displayName ?? (member.userId === currentUserId ? "自分" : "メンバー");
          return (
            <TouchableOpacity
              key={member.userId}
              testID={`${testIDPrefix}-member-${member.userId}`}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onToggle(member.userId)}
            >
              <UserAvatar
                testID={`${testIDPrefix}-member-${member.userId}-avatar`}
                userId={member.userId}
                displayName={member.displayName}
                avatarUrl={member.avatarPath ? (urls[member.avatarPath] ?? null) : null}
                size={22}
              />
              <Text style={[styles.name, selected && styles.nameSelected]}>{name}</Text>
              {selected ? (
                <Text testID={`${testIDPrefix}-member-${member.userId}-checked`} style={styles.check}>
                  ✓
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    backgroundColor: "#fff",
  },
  chipSelected: {
    borderColor: "#2f6fed",
    backgroundColor: "#e8f0fe",
  },
  name: {
    color: "#444",
  },
  nameSelected: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  check: {
    color: "#2f6fed",
    fontWeight: "700",
  },
});
