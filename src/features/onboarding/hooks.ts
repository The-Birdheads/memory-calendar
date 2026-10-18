import { useCallback, useEffect, useState } from "react";

import { hasCompletedOnboarding, markOnboardingCompleted } from "./onboardingStorage";

export interface UseOnboardingResult {
  /** 案内の画面を出すか。初回(まだ見終えていない)か、設定などから見直しを求められたとき。 */
  isVisible: boolean;
  /** 見直したいとき(個人設定の「使い方を見る」)に出す。 */
  show: () => void;
  /** 閉じる。見終えたことを記録し、次回からは初回の自動表示をしない。 */
  complete: () => void;
}

/**
 * 初回の案内(チュートリアル)の表示を管理する。ログインしたユーザーが、まだ案内を見終えて
 * いなければ自動で出し、閉じたら記録して以降は出さない。個人設定から、いつでも見直せる。
 */
export function useOnboarding(userId: string | undefined): UseOnboardingResult {
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isRequested, setIsRequested] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsFirstTime(false);
      return;
    }
    let cancelled = false;
    hasCompletedOnboarding(userId).then((completed) => {
      if (!cancelled) setIsFirstTime(!completed);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const show = useCallback(() => setIsRequested(true), []);

  const complete = useCallback(() => {
    setIsFirstTime(false);
    setIsRequested(false);
    if (userId) {
      void markOnboardingCompleted(userId);
    }
  }, [userId]);

  return { isVisible: isFirstTime || isRequested, show, complete };
}
