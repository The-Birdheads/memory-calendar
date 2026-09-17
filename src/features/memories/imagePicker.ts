import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { PhotoUploadInput } from "./types";

// 写真ライブラリの元画像はスマホのカメラ解像度そのまま(数千px・数MB)の
// ことが多いが、思い出タイムラインのグリッドでは小さくしか表示しない
// (history.tsx参照)。読み込みを軽くするため、長辺がこれを超える場合だけ
// アップロード前に縮小する(2026-09、読み込み速度の改善)。
const MAX_UPLOAD_DIMENSION = 1600;
const RESIZE_COMPRESS_QUALITY = 0.8;

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

function withJpegExtension(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./]+$/, "");
  return `${withoutExtension}.jpg`;
}

/**
 * 長辺がMAX_UPLOAD_DIMENSIONを超える場合だけ縮小して保存し直し、その
 * ファイルのuriを返す(超えない場合は元のuriをそのまま返す - 小さい画像を
 * わざわざ拡大/再エンコードしない)。幅または高さが不明(0)な時は安全側に
 * 倒って縮小しない。
 */
async function resizeIfNeeded(uri: string, width: number, height: number): Promise<string | null> {
  const longestSide = Math.max(width, height);
  if (longestSide === 0 || longestSide <= MAX_UPLOAD_DIMENSION) {
    return uri;
  }

  const isLandscape = width >= height;
  const context = ImageManipulator.manipulate(uri).resize(
    isLandscape ? { width: MAX_UPLOAD_DIMENSION } : { height: MAX_UPLOAD_DIMENSION }
  );
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: RESIZE_COMPRESS_QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
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
  const originalFileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
  const resizedUri = await resizeIfNeeded(asset.uri, asset.width, asset.height);
  const wasResized = resizedUri !== null && resizedUri !== asset.uri;
  const fileName = wasResized ? withJpegExtension(originalFileName) : originalFileName;
  const response = await fetch(resizedUri ?? asset.uri);
  const data = await response.blob();

  return { fileName, contentType: wasResized ? "image/jpeg" : inferContentType(fileName), data };
}
