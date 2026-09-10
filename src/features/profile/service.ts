import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type { Profile, ProfileError } from "./types";

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
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

export function getProfileErrorMessageJa(error: ProfileError): string {
  switch (error.type) {
    case "NotFound":
      return "プロフィールが見つかりません";
    case "Forbidden":
      return "この操作を行う権限がありません";
    case "ValidationError":
      return "ユーザー名を入力してください";
  }
}
