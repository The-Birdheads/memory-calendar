import { Image, StyleSheet, Text, View } from "react-native";

import { avatarColor, avatarInitial } from "../utils/avatar";

export interface UserAvatarProps {
  testID?: string;
  userId: string;
  displayName: string | null;
  /** 登録した画像のURL。無い間は表示名の頭文字を丸いアイコンで出す。 */
  avatarUrl: string | null;
  size?: number;
}

/** ユーザーのアイコン: 画像を登録していればその画像、そうでなければ表示名の頭文字。 */
export function UserAvatar({ testID, userId, displayName, avatarUrl, size = 24 }: UserAvatarProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      testID={testID}
      accessibilityLabel={displayName ?? undefined}
      style={[styles.circle, circle, !avatarUrl && { backgroundColor: avatarColor(userId) }]}
    >
      {avatarUrl ? (
        <Image testID={testID ? `${testID}-image` : undefined} source={{ uri: avatarUrl }} style={circle} />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.5) }]}>{avatarInitial(displayName)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initial: {
    color: "#fff",
    fontWeight: "700",
  },
});
