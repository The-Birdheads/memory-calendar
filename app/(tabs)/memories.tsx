import { useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuthSession } from "../../src/features/auth/hooks";
import { useMyCalendars } from "../../src/features/calendars/hooks";
import {
  useComments,
  usePostComment,
  useReactions,
  useToggleReaction,
} from "../../src/features/communication/hooks";
import { EventCommentsSection } from "../../src/features/communication/components/EventCommentsSection";
import { EventReactionsBar } from "../../src/features/communication/components/EventReactionsBar";
import { useEventPhotos, useMemoriesTimeline } from "../../src/features/memories/hooks";
import { EventPhotosGallery } from "../../src/features/memories/components/EventPhotosGallery";
import { formatDateTime } from "../../src/shared/utils/formatDateTime";

export default function MemoriesScreen() {
  const { session } = useAuthSession();
  const { calendars } = useMyCalendars();
  const activeCalendarId = calendars[0]?.id ?? "";
  // 個人用カレンダーの予定にはスタンプ機能を出さない。
  const isPersonalCalendar = calendars[0]?.kind === "personal";

  const { entries } = useMemoriesTimeline(activeCalendarId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;

  const { photos } = useEventPhotos(selectedId ?? "");
  const { comments, refetch: refetchComments } = useComments(selectedId ?? "");
  const { postComment } = usePostComment();
  const { reactions, refetch: refetchReactions } = useReactions(selectedId ?? "");
  const { toggleReaction } = useToggleReaction();

  const myReaction = reactions.find((reaction) => reaction.userId === session?.user.id) ?? null;

  const handleSubmitComment = async (body: string) => {
    if (!selectedId) return;
    const success = await postComment(selectedId, body);
    if (success) await refetchComments();
  };

  const handleToggleReaction = async (stampType: string) => {
    if (!selectedId) return;
    const success = await toggleReaction(selectedId, stampType, myReaction);
    if (success) await refetchReactions();
  };

  if (selectedEntry) {
    return (
      <View style={styles.container}>
        <TouchableOpacity testID="memory-back-button" onPress={() => setSelectedId(null)}>
          <Text>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedEntry.title}</Text>
        <Text style={styles.meta}>{formatDateTime(selectedEntry.startAt)}</Text>
        <EventPhotosGallery photos={photos} />
        {isPersonalCalendar ? null : (
          <EventReactionsBar
            reactions={reactions}
            currentUserId={session?.user.id}
            onToggleReaction={handleToggleReaction}
          />
        )}
        <EventCommentsSection comments={comments} onSubmit={handleSubmitComment} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>思い出</Text>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text>思い出がありません</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`memory-item-${item.id}`}
              style={styles.item}
              onPress={() => setSelectedId(item.id)}
            >
              {item.thumbnailUrl ? (
                <Image
                  testID={`memory-thumbnail-${item.id}`}
                  source={{ uri: item.thumbnailUrl }}
                  style={styles.thumbnail}
                />
              ) : null}
              <Text>{item.title}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    padding: 12,
  },
  meta: {
    color: "#666",
    fontSize: 12,
    paddingHorizontal: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    flex: 1,
    padding: 8,
    alignItems: "center",
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
});
