import { Image, StyleSheet, Text, View } from "react-native";

import type { EventPhotoWithUrl } from "../hooks";

export interface EventPhotosGalleryProps {
  photos: EventPhotoWithUrl[];
}

export function EventPhotosGallery({ photos }: EventPhotosGalleryProps) {
  const displayablePhotos = photos.filter((photo) => photo.url !== null);

  if (displayablePhotos.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text>写真はまだありません</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {displayablePhotos.map((photo) => (
        <Image
          key={photo.id}
          testID={`event-photo-${photo.id}`}
          source={{ uri: photo.url as string }}
          style={styles.thumbnail}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});
