import { useState } from "react";
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useCalendarMembers, useCreateInvite } from "../hooks";

export interface InviteScreenProps {
  calendarId: string;
  currentUserId?: string;
}

/** 招待コードの発行・共有・メンバー一覧 - 中身のみ(Modal/ヘッダーなし)。
 * SettingsHubModal の画面スタックから "invite" として表示される。 */
export function InviteScreen({ calendarId, currentUserId }: InviteScreenProps) {
  const { members } = useCalendarMembers(calendarId);
  const { createInvite } = useCreateInvite();
  const [code, setCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    const invite = await createInvite(calendarId);
    if (invite) setCode(invite.code);
  };

  const handleShare = async () => {
    if (!code) return;
    await Share.share({
      message: `カレンダーへの招待コード「${code}」を教えてください。アプリの「招待コードで参加」から入力すると参加できます。`,
    });
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text testID="invite-flow-description" style={styles.description}>
          招待コードを発行して相手に伝えると、このカレンダーに参加できます。
        </Text>

        {code ? (
          <>
            <View style={styles.codeBox}>
              <Text testID="invite-flow-code" style={styles.codeText}>
                {code}
              </Text>
            </View>
            <TouchableOpacity testID="invite-flow-share" style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>共有する</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity testID="invite-flow-generate" style={styles.generateButton} onPress={handleGenerate}>
            <Text style={styles.generateButtonText}>招待コードを発行</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>参加中のメンバー</Text>
        {members.map((member) => (
          <Text key={member.userId} style={styles.memberRow}>
            {member.displayName ?? (member.userId === currentUserId ? "自分" : "メンバー")}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  description: {
    color: "#666",
    fontSize: 13,
  },
  codeBox: {
    alignSelf: "flex-start",
    backgroundColor: "#f2f3f5",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  codeText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1,
  },
  generateButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2f6fed",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  generateButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  shareButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#2f6fed",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: {
    color: "#2f6fed",
    fontWeight: "700",
  },
  sectionLabel: {
    color: "#666",
    fontSize: 12,
    marginTop: 8,
  },
  memberRow: {
    fontSize: 14,
    paddingVertical: 2,
  },
});
