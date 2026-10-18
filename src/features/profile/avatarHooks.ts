import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { getAvatarUrls, removeMyAvatar, uploadMyAvatar } from "./service";
import type { Profile, ProfileError } from "./types";
import type { PhotoUploadInput } from "../memories/types";

// 署名付きURL(1時間有効)の使い回し。一覧の行ごとに同じ人のアイコンを何度も
// 署名し直さないよう、画面をまたいでこのモジュール内で覚えておく。期限の少し前に
// 切れたものとして扱い、表示中にURLが失効しないようにする。
const URL_LIFETIME_MS = 50 * 60 * 1000;
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export function clearAvatarUrlCache(): void {
  urlCache.clear();
}

function readCached(paths: string[], now: number): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const path of paths) {
    const hit = urlCache.get(path);
    if (hit && hit.expiresAt > now) {
      resolved[path] = hit.url;
    }
  }
  return resolved;
}

/** アイコン画像の保存先パス → 表示用URL。まだ署名していないパスだけをまとめて問い合わせる。 */
export function useAvatarUrls(paths: string[]): Record<string, string> {
  const uniquePaths = Array.from(new Set(paths)).sort();
  const key = uniquePaths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>(() => readCached(uniquePaths, Date.now()));

  useEffect(() => {
    const wanted = key === "" ? [] : key.split("|");
    if (wanted.length === 0) {
      setUrls({});
      return;
    }

    const now = Date.now();
    const cached = readCached(wanted, now);
    setUrls(cached);

    const missing = wanted.filter((path) => !(path in cached));
    if (missing.length === 0) return;

    let cancelled = false;
    getAvatarUrls(getSupabaseClient(), missing).then((result) => {
      if (!result.ok) return;
      const expiresAt = Date.now() + URL_LIFETIME_MS;
      for (const [path, url] of Object.entries(result.value)) {
        urlCache.set(path, { url, expiresAt });
      }
      if (!cancelled) {
        setUrls(readCached(wanted, Date.now()));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return urls;
}

export interface UseUploadMyAvatarResult {
  uploadAvatar: (userId: string, photo: PhotoUploadInput, previousPath: string | null) => Promise<Profile | null>;
  isSubmitting: boolean;
  error: ProfileError | null;
}

export function useUploadMyAvatar(): UseUploadMyAvatarResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  const run = useCallback(async (userId: string, photo: PhotoUploadInput, previousPath: string | null) => {
    setIsSubmitting(true);
    setError(null);
    const result = await uploadMyAvatar(getSupabaseClient(), userId, photo, previousPath);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { uploadAvatar: run, isSubmitting, error };
}

export interface UseRemoveMyAvatarResult {
  removeAvatar: (userId: string, previousPath: string | null) => Promise<Profile | null>;
  isSubmitting: boolean;
  error: ProfileError | null;
}

export function useRemoveMyAvatar(): UseRemoveMyAvatarResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  const run = useCallback(async (userId: string, previousPath: string | null) => {
    setIsSubmitting(true);
    setError(null);
    const result = await removeMyAvatar(getSupabaseClient(), userId, previousPath);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { removeAvatar: run, isSubmitting, error };
}
