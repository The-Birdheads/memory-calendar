import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "../../../shared/components/Icon";
import type { EventPhotoWithUrl } from "../hooks";

export interface EventPhotosGalleryProps {
  photos: EventPhotoWithUrl[];
  /** 現在のユーザーID。指定すると自分の写真にだけ削除ボタンが出る。 */
  currentUserId?: string;
  /** 写真をタップしてサムネイルに選ぶ(誰の写真でもカレンダーメンバーなら選べる、共有の設定)。 */
  onSelectThumbnail?: (photo: EventPhotoWithUrl) => void;
  /** 自分の写真を削除する。 */
  onDeleteOwnPhoto?: (photo: EventPhotoWithUrl) => void;
}

export function EventPhotosGallery({
  photos,
  currentUserId,
  onSelectThumbnail,
  onDeleteOwnPhoto,
}: EventPhotosGalleryProps) {
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
        <TouchableOpacity
          key={photo.id}
          testID={`event-photo-${photo.id}`}
          style={styles.photoWrapper}
          activeOpacity={onSelectThumbnail ? 0.7 : 1}
          disabled={!onSelectThumbnail}
          onPress={() => onSelectThumbnail?.(photo)}
        >
          <Image
            testID={`event-photo-${photo.id}-image`}
            source={{ uri: photo.url as string }}
            style={styles.thumbnail}
          />
          {photo.isThumbnail ? (
            <View testID={`event-photo-${photo.id}-thumbnail-badge`} style={styles.thumbnailBadge}>
              <Icon name="checklist" size={12} color="#fff" />
            </View>
          ) : null}
          {onDeleteOwnPhoto && photo.uploadedBy === currentUserId ? (
            <TouchableOpacity
              testID={`event-photo-${photo.id}-delete`}
              style={styles.deleteBadge}
              onPress={() => onDeleteOwnPhoto(photo)}
            >
              <Icon name="close" size={12} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
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
  photoWrapper: {
    width: 80,
    height: 80,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  thumbnailBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#2f6fed",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#d32f2f",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});
