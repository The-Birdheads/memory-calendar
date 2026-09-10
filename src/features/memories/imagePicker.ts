import * as ImagePicker from "expo-image-picker";

import type { PhotoUploadInput } from "./types";

function inferContentType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "heic":
      return "image/heic";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/**
 * Requests photo-library permission and lets the user pick a single image,
 * returning it ready to hand to attachPhoto (or null if permission was
 * denied or the picker was cancelled).
 */
export async function pickPhotoFromLibrary(): Promise<PhotoUploadInput | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
  const response = await fetch(asset.uri);
  const data = await response.blob();

  return { fileName, contentType: inferContentType(fileName), data };
}
