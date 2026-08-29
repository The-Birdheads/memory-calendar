import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import type { EventComment } from "../types";

export interface EventCommentsSectionProps {
  comments: EventComment[];
  onSubmit: (body: string) => void;
  isSubmitting?: boolean;
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
  resolveAuthorName?: (userId: string) => string;
}

export function EventCommentsSection({
  comments,
  onSubmit,
  isSubmitting,
  currentUserId,
  onDelete,
  resolveAuthorName,
}: EventCommentsSectionProps) {
  const [body, setBody] = useState("");

  const handleSubmit = () => {
    onSubmit(body);
    setBody("");
  };

  return (
    <View style={styles.container}>
      {comments.map((item) => (
        <View key={item.id} style={styles.commentRow} testID={`event-comment-${item.id}`}>
          <Text>{item.body}</Text>
          <Text style={styles.meta}>{resolveAuthorName ? resolveAuthorName(item.userId) : item.userId}</Text>
          <Text style={styles.meta}>{item.createdAt}</Text>
          {currentUserId && item.userId === currentUserId ? (
            <TouchableOpacity
              testID={`event-comment-delete-${item.id}`}
              onPress={() => onDelete?.(item.id)}
            >
              <Text style={styles.deleteText}>削除</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      <TextInput
        testID="event-comment-input"
        style={styles.input}
        placeholder="コメントを入力"
        value={body}
        onChangeText={setBody}
      />
      <TouchableOpacity
        testID="event-comment-submit"
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text>投稿</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  commentRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
  deleteText: {
    color: "#d32f2f",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
  },
  submitButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
});
