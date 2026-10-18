import { StyleSheet, Text, View } from "react-native";

import { UserAvatar } from "../../../shared/components/UserAvatar";
import { useAvatarUrls } from "../../profile/avatarHooks";

export interface AssigneeAvatarsPerson {
  userId: string;
  displayName: string | null;
  avatarPath: string | null;
}

export interface AssigneeAvatarsProps {
  testID?: string;
  assignees: AssigneeAvatarsPerson[];
  size?: number;
  /** これを超える分は「+N」にまとめる。 */
  maxVisible?: number;
}

/** 予定の対象者のアイコンを、少し重ねて横に並べる(予定一覧の行などに添える小さな表示)。 */
export function AssigneeAvatars({ testID, assignees, size = 20, maxVisible = 3 }: AssigneeAvatarsProps) {
  const urls = useAvatarUrls(assignees.flatMap((assignee) => (assignee.avatarPath ? [assignee.avatarPath] : [])));

  if (assignees.length === 0) {
    return null;
  }

  const visible = assignees.slice(0, maxVisible);
  const hiddenCount = assignees.length - visible.length;

  return (
    <View testID={testID} style={styles.row}>
      {visible.map((assignee, index) => (
        <View key={assignee.userId} style={[styles.item, index > 0 && { marginLeft: -size / 4 }]}>
          <UserAvatar
            testID={testID ? `${testID}-${assignee.userId}` : undefined}
            userId={assignee.userId}
            displayName={assignee.displayName}
            avatarUrl={assignee.avatarPath ? (urls[assignee.avatarPath] ?? null) : null}
            size={size}
          />
        </View>
      ))}
      {hiddenCount > 0 ? <Text style={styles.more}>+{hiddenCount}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  item: {
    borderWidth: 1.5,
    borderColor: "#fff",
    borderRadius: 999,
  },
  more: {
    marginLeft: 4,
    fontSize: 11,
    color: "#666",
  },
});
