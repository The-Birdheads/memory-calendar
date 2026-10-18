import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { PhotoUploadInput } from "../memories/types";

// 丸いアイコンとして小さく表示するだけなので、正方形に切り抜いたうえで小さく
// 縮小してから保存する(読み込みを軽くし、保存容量も抑える)。
const AVATAR_SIZE = 256;
const AVATAR_COMPRESS_QUALITY = 0.8;

/**
 * 写真ライブラリから画像を1枚選び、正方形に切り抜いて縮小した状態で返す
 * (権限が拒否された/選択をやめた場合は null)。
 */
export async function pickAvatarFromLibrary(): Promise<PhotoUploadInput | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri).resize({ width: AVATAR_SIZE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: AVATAR_COMPRESS_QUALITY, format: SaveFormat.JPEG });
  const response = await fetch(saved.uri);
  const data = await response.blob();

  return { fileName: "avatar.jpg", contentType: "image/jpeg", data };
}
