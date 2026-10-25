import { useCallback, useEffect, useRef, useState } from "react";

import { subscribeToTableChanges } from "../../shared/api/realtime";
import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { revokeAppleAuthorizationIfNeeded } from "../auth/service";
import {
  deleteOwnAccount,
  getMyProfile,
  isHabitasInUse,
  removeOwnAvatarFiles,
  updateDisplayName,
  updateWeekStartsOn,
} from "./service";
import type { Profile, ProfileError } from "./types";

export interface UseMyProfileResult {
  profile: Profile | null;
  isLoading: boolean;
  error: ProfileError | null;
  refetch: () => Promise<void>;
}

export function useMyProfile(userId: string): UseMyProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ProfileError | null>(null);
  // 取得は、設定画面の変更・リアルタイムの通知などで重なることがある。古い取得の結果が、
  // 新しい取得の結果のあとに届いて上書きしないよう、最後に始めた取得の結果だけを使う。
  const latestRequestRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    if (!userId) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await getMyProfile(getSupabaseClient(), userId);
    if (requestId !== latestRequestRef.current) return;
    if (result.ok) {
      setProfile(result.value);
      setError(null);
    } else {
      // 通信の不調などで取り直しに失敗しても、直前に取得できたプロフィールは残す
      // (消すと、週の開始曜日などが初期値に戻って見えてしまう)。
      setError(result.error);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    // ユーザーが替わったら、前のユーザーのプロフィールは捨てる。
    setProfile(null);
    refetch();
  }, [userId, refetch]);

  // 個人設定(週の開始曜日・ユーザー名)は別画面/別のuseMyProfileインスタンス
  // から更新されることがあるため、同一プロフィール行の変更をリアルタイムで
  // 拾ってその場で反映する(2026-09、週開始曜日の切り替えがカレンダー画面に
  // 即時反映されなかったのを修正)。
  useEffect(() => {
    if (!userId) return;
    return subscribeToTableChanges(getSupabaseClient(), `my-profile-${userId}`, "profiles", refetch, `id=eq.${userId}`);
  }, [userId, refetch]);

  return { profile, isLoading, error, refetch };
}

export interface UseUpdateDisplayNameResult {
  updateDisplayName: (userId: string, displayName: string) => Promise<Profile | null>;
  isSubmitting: boolean;
  error: ProfileError | null;
}

export function useUpdateDisplayName(): UseUpdateDisplayNameResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  const runUpdateDisplayName = useCallback(async (userId: string, displayName: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateDisplayName(getSupabaseClient(), userId, displayName);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { updateDisplayName: runUpdateDisplayName, isSubmitting, error };
}

export interface UseUpdateWeekStartsOnResult {
  updateWeekStartsOn: (userId: string, weekStartsOn: 0 | 1) => Promise<Profile | null>;
  isSubmitting: boolean;
  error: ProfileError | null;
}

export function useUpdateWeekStartsOn(): UseUpdateWeekStartsOnResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  const runUpdateWeekStartsOn = useCallback(async (userId: string, weekStartsOn: 0 | 1) => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateWeekStartsOn(getSupabaseClient(), userId, weekStartsOn);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { updateWeekStartsOn: runUpdateWeekStartsOn, isSubmitting, error };
}

export interface UseDeleteAccountResult {
  deleteAccount: () => Promise<boolean>;
  /** 確認画面の文言の出し分け用。Habitas も使っているか(取得できなければ null) */
  checkHabitasInUse: () => Promise<boolean | null>;
  isSubmitting: boolean;
  error: ProfileError | null;
}

export function useDeleteAccount(): UseDeleteAccountResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  const runDeleteAccount = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    const client = getSupabaseClient();

    // Appleでサインインしたユーザーは、削除前にAppleのトークンも失効させる(Appleの確認画面が
    // 出る)。確認画面を閉じた場合は削除自体を中止する。失効に失敗しても削除は続行する。
    const revocation = await revokeAppleAuthorizationIfNeeded(client);
    if (revocation === "cancelled") {
      setIsSubmitting(false);
      return false;
    }

    await removeOwnAvatarFiles(client);

    const result = await deleteOwnAccount(client);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  const checkHabitasInUse = useCallback(() => isHabitasInUse(getSupabaseClient()), []);

  return { deleteAccount: runDeleteAccount, checkHabitasInUse, isSubmitting, error };
}
