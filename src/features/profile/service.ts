import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { PhotoUploadInput } from "../memories/types";
import type { Profile, ProfileError } from "./types";

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  week_starts_on: number;
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    weekStartsOn: row.week_starts_on === 1 ? 1 : 0,
  };
}

function mapProfileError(error: PostgrestError): ProfileError {
  if (error.code === "PGRST116") {
    return { type: "NotFound" };
  }
  return { type: "Forbidden" };
}

export async function getMyProfile(client: SupabaseClient, userId: string): Promise<Result<Profile, ProfileError>> {
  const { data, error } = await client.from("profiles").select().eq("id", userId).single();

  if (error || !data) {
    return err(mapProfileError(error as PostgrestError));
  }

  return ok(mapProfileRow(data as ProfileRow));
}

export async function updateDisplayName(
  client: SupabaseClient,
  userId: string,
  displayName: string
): Promise<Result<Profile, ProfileError>> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return err({ type: "ValidationError", field: "displayName" });
  }

  const { data, error } = await client
    .from("profiles")
    .update({ display_name: trimmed })
    .eq("id", userId)
    .select()
    .single();

  if (error || !data) {
    return err(mapProfileError(error as PostgrestError));
  }

  return ok(mapProfileRow(data as ProfileRow));
}

export async function updateWeekStartsOn(
  client: SupabaseClient,
  userId: string,
  weekStartsOn: 0 | 1
): Promise<Result<Profile, ProfileError>> {
  const { data, error } = await client
    .from("profiles")
    .update({ week_starts_on: weekStartsOn })
    .eq("id", userId)
    .select()
    .single();

  if (error || !data) {
    return err(mapProfileError(error as PostgrestError));
  }

  return ok(mapProfileRow(data as ProfileRow));
}

const AVATAR_BUCKET = "avatars";
const AVATAR_URL_TTL_SECONDS = 3600;

async function saveAvatarPath(
  client: SupabaseClient,
  userId: string,
  avatarPath: string | null
): Promise<Result<Profile, ProfileError>> {
  const { data, error } = await client
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("id", userId)
    .select()
    .single();

  if (error || !data) {
    return err(mapProfileError(error as PostgrestError));
  }

  return ok(mapProfileRow(data as ProfileRow));
}

/**
 * アイコン画像を登録する。自分のフォルダ(`{userId}/...`)にアップロードし、プロフィールに
 * 保存先を記録したあとで、前の画像を消す(新しい方が確実に保存できてから消すので、途中で
 * 失敗しても今のアイコンは残る)。
 */
export async function uploadMyAvatar(
  client: SupabaseClient,
  userId: string,
  photo: PhotoUploadInput,
  previousPath: string | null
): Promise<Result<Profile, ProfileError>> {
  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(path, photo.data, { contentType: photo.contentType });

  if (uploadError) {
    return err({ type: "Forbidden" });
  }

  const saved = await saveAvatarPath(client, userId, path);
  if (!saved.ok) {
    await client.storage.from(AVATAR_BUCKET).remove([path]);
    return saved;
  }

  if (previousPath) {
    await client.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  return saved;
}

/** アイコン画像を外して、表示名の頭文字に戻す。 */
export async function removeMyAvatar(
  client: SupabaseClient,
  userId: string,
  previousPath: string | null
): Promise<Result<Profile, ProfileError>> {
  const saved = await saveAvatarPath(client, userId, null);
  if (!saved.ok) {
    return saved;
  }

  if (previousPath) {
    await client.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  return saved;
}

/** アイコン画像の保存先パス → 表示用の署名付きURL。署名できなかったものは含めない。 */
export async function getAvatarUrls(
  client: SupabaseClient,
  paths: string[]
): Promise<Result<Record<string, string>, ProfileError>> {
  if (paths.length === 0) {
    return ok({});
  }

  const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUrls(paths, AVATAR_URL_TTL_SECONDS);

  if (error || !data) {
    return err({ type: "Forbidden" });
  }

  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (entry.path && entry.signedUrl) {
      urls[entry.path] = entry.signedUrl;
    }
  }
  return ok(urls);
}

/**
 * アカウント削除の前に、自分のアイコン画像のファイルを消す(アカウントを消すとフォルダの
 * 持ち主が分からなくなり、画像だけが残ってしまうため)。失敗しても例外は投げない -
 * 画像が消せなくてもアカウントの削除は必ずできるようにしておく。
 */
export async function removeOwnAvatarFiles(client: SupabaseClient): Promise<void> {
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;

    const { data: files } = await client.storage.from(AVATAR_BUCKET).list(user.id);
    if (!files || files.length === 0) return;

    await client.storage.from(AVATAR_BUCKET).remove(files.map((file) => `${user.id}/${file.name}`));
  } catch {
    // 画像が消せなくてもアカウント削除は続ける。
  }
}

/**
 * このアカウントが Habitas も使っているか。
 * true: 使っている(削除してもアカウント自体は残る) / false: 使っていない(アカウントごと削除される) /
 * null: 取得できなかった。
 */
export async function isHabitasInUse(client: SupabaseClient): Promise<boolean | null> {
  try {
    const { data, error } = await client.rpc("get_account_usage");
    if (error || !Array.isArray(data)) return null;
    return data.includes("habitas");
  } catch {
    return null;
  }
}

export async function deleteOwnAccount(client: SupabaseClient): Promise<Result<void, ProfileError>> {
  const { error } = await client.rpc("delete_own_account");

  if (error) {
    return err({ type: "DeleteFailed" });
  }

  return ok(undefined);
}

export function getProfileErrorMessageJa(error: ProfileError): string {
  switch (error.type) {
    case "NotFound":
      return "プロフィールが見つかりません";
    case "Forbidden":
      return "この操作を行う権限がありません";
    case "ValidationError":
      return "ユーザー名を入力してください";
    case "DeleteFailed":
      return "アカウントの削除に失敗しました。時間をおいて再度お試しください";
  }
}
