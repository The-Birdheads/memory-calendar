import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import type { WeekStartsOn } from "../events/monthGrid";
import type { Profile } from "./types";

// 週の開始曜日は、プロフィールを取得するまでわからない。取得前(起動直後や通信の不調のとき)に
// 日曜始まりで描いてしまわないよう、最後に取得できた設定を、この端末の中にユーザーごとに覚えておく。
function storageKey(userId: string): string {
  return `profile.weekStartsOn.v1.${userId}`;
}

/** 最後に取得できた週の開始曜日。覚えていない・読めないときは null。 */
export async function readCachedWeekStartsOn(userId: string): Promise<WeekStartsOn | null> {
  try {
    const value = await AsyncStorage.getItem(storageKey(userId));
    if (value === "1") return 1;
    if (value === "0") return 0;
    return null;
  } catch {
    return null;
  }
}

/** 週の開始曜日を覚える。保存に失敗しても何も起こさない(次回また取得するだけ)。 */
export async function saveCachedWeekStartsOn(userId: string, weekStartsOn: WeekStartsOn): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), String(weekStartsOn));
  } catch {
    // 保存できなくても、アプリの動作は続ける。
  }
}

/**
 * カレンダーの週の開始曜日。取得できたプロフィールの設定を使い、まだ取得できていない間(起動直後)や
 * 取得に失敗したときは、最後に取得できた設定を使う。どちらも無いときだけ日曜始まり。
 */
export function useWeekStartsOn(userId: string | undefined, profile: Profile | null): WeekStartsOn {
  const [cached, setCached] = useState<{ userId: string; value: WeekStartsOn } | null>(null);
  const fromProfile = profile?.weekStartsOn;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    readCachedWeekStartsOn(userId).then((value) => {
      // 取得したプロフィールの設定のほうが新しいので、読み込みが遅れても上書きしない。
      if (!cancelled && value !== null) setCached((previous) => previous ?? { userId, value });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || fromProfile === undefined) return;
    setCached({ userId, value: fromProfile });
    void saveCachedWeekStartsOn(userId, fromProfile);
  }, [userId, fromProfile]);

  const cachedForUser = cached && cached.userId === userId ? cached.value : null;
  return fromProfile ?? cachedForUser ?? 0;
}
