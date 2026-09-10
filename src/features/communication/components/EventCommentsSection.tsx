import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";
import { formatDateTime } from "../../../shared/utils/formatDateTime";
import type { EventComment } from "../types";

export interface EventCommentsSectionProps {
  comments: EventComment[];
  onSubmitComment: (body: string) => void;
  isSubmittingComment?: boolean;
  currentUserId?: string;
  onDeleteComment?: (commentId: string) => void;
  resolveAuthorName?: (userId: string | null) => string;
}

/**
 * The comment list + a single input row (text input, send button). Used to
 * be merged with a stamp/reaction picker (EventEngagementSection), but the
 * stamp feature was removed entirely (2026-09, not just hidden for personal
 * calendars) since comments alone covered the need - this is what's left,
 * renamed back to EventCommentsSection now that "engagement" (stamps+
 * comments) no longer describes it.
 */
export function EventCommentsSection({
  comments,
  onSubmitComment,
  isSubmittingComment,
  currentUserId,
  onDeleteComment,
  resolveAuthorName,
}: EventCommentsSectionProps) {
  const [body, setBody] = useState("");

  const handleSubmit = () => {
    onSubmitComment(body);
    setBody("");
  };

  return (
    <View style={styles.container} testID="event-comments-section">
      {comments.map((item) => (
        <View key={item.id} style={styles.commentRow} testID={`event-comment-${item.id}`}>
          <Text>{item.body}</Text>
          <View style={styles.commentMetaRow}>
            <Text style={styles.meta}>{resolveAuthorName ? resolveAuthorName(item.userId) : item.userId}</Text>
            <Text style={styles.meta}>{formatDateTime(item.createdAt)}</Text>
            {currentUserId && item.userId === currentUserId ? (
              <TouchableOpacity
                testID={`event-comment-delete-${item.id}`}
                onPress={() => onDeleteComment?.(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="trash" size={14} color="#d32f2f" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}

      <View style={styles.inputRow}>
        <TextInput
          testID="event-comment-input"
          style={styles.input}
          placeholder="コメントを入力"
          value={body}
          onChangeText={setBody}
        />
        <TouchableOpacity
          testID="event-comment-submit"
          style={styles.sendButton}
          onPress={handleSubmit}
          disabled={isSubmittingComment}
        >
          <Text style={styles.sendIcon}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  commentRow: {
    gap: 2,
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2f6fed",
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
