import { useCallback, useEffect, useState } from "react";

import { hasCompletedOnboarding } from "../onboarding/onboardingStorage";
import { getLastSeenReleaseVersion, markReleaseNotesSeen } from "./releaseNotesStorage";
import { LATEST_RELEASE_VERSION } from "./releases";

/**
 * この日より前に作られたアカウントは、リリースノートの機能より前から使っている既存ユーザーとして扱う。
 * (初回の案内=チュートリアルも同じ版で入るため、「案内を見終えた人」だけでは、更新してきた
 * 既存ユーザーを判別できない。)
 */
export const EXISTING_ACCOUNT_CUTOFF = "2026-10-19T00:00:00Z";

/** 別のモーダル(初回の案内など)が閉じたあと、リリースノートを出すまでの待ち(iOS は、閉じる動きの最中に別のモーダルを開けないことがある)。 */
export const RELEASE_NOTES_OPEN_DELAY_MS = 600;

export interface UseReleaseNotesParams {
  userId: string | undefined;
  /** アカウントの作成日時(ISO 文字列)。 */
  accountCreatedAt: string | undefined;
  /** 初回の案内など、ほかのモーダルが出ている間は true(その間は自動では出さない)。 */
  isBlocked: boolean;
}

export interface UseReleaseNotesResult {
  isVisible: boolean;
  /** 見直したいとき(個人設定の「更新内容を見る」)に出す。 */
  show: () => void;
  /** 閉じる。最新のバージョンまで見たことを記録する。 */
  close: () => void;
}

function isExistingAccount(accountCreatedAt: string | undefined): boolean {
  if (!accountCreatedAt) return false;
  const created = new Date(accountCreatedAt).getTime();
  return !Number.isNaN(created) && created < new Date(EXISTING_ACCOUNT_CUTOFF).getTime();
}

/**
 * リリースノートの表示を管理する。アプリを使ったことがある人(初回の案内を見終えている人、または
 * 以前からのアカウント)が、まだ見ていないバージョンのリリースノートがあれば自動で出し、
 * 閉じたら記録して以降は出さない。初めて使う人には出さない(その人は、案内を見る時点で最新の
 * ものを見たことにする)。個人設定から、いつでも見直せる。
 */
export function useReleaseNotes({ userId, accountCreatedAt, isBlocked }: UseReleaseNotesParams): UseReleaseNotesResult {
  const [isPending, setIsPending] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [isDelayElapsed, setIsDelayElapsed] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsPending(false);
      return;
    }
    let cancelled = false;
    Promise.all([hasCompletedOnboarding(userId), getLastSeenReleaseVersion(userId)]).then(([completed, lastSeen]) => {
      if (cancelled) return;
      if (lastSeen === LATEST_RELEASE_VERSION || lastSeen === "unknown") {
        setIsPending(false);
      } else if (completed || isExistingAccount(accountCreatedAt)) {
        setIsPending(true);
      } else {
        // 初めて使う人: 知らせる「新機能」は無いので、最新まで見たことにする。
        setIsPending(false);
        void markReleaseNotesSeen(userId, LATEST_RELEASE_VERSION);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, accountCreatedAt]);

  useEffect(() => {
    if (isBlocked) {
      setIsDelayElapsed(false);
      return;
    }
    const timer = setTimeout(() => setIsDelayElapsed(true), RELEASE_NOTES_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isBlocked]);

  const show = useCallback(() => setIsRequested(true), []);

  const close = useCallback(() => {
    setIsPending(false);
    setIsRequested(false);
    if (userId) {
      void markReleaseNotesSeen(userId, LATEST_RELEASE_VERSION);
    }
  }, [userId]);

  return { isVisible: isRequested || (isPending && !isBlocked && isDelayElapsed), show, close };
}
