import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import {
  DEFAULT_MEAL_NOTIFICATION_SETTINGS,
  getMealNotificationSettings,
  saveMealNotificationSettings,
  type MealNotificationSettings,
  type MealNotificationSettingsError,
} from "./notificationSettings";

export interface UseMealNotificationSettingsResult {
  settings: MealNotificationSettings;
  isLoading: boolean;
  error: MealNotificationSettingsError | null;
  /** 設定を変更して保存する。画面にはすぐ反映し、保存に失敗したら元に戻す。 */
  update: (next: MealNotificationSettings) => Promise<boolean>;
}

/** ログイン中ユーザーの献立の通知設定。userIdが未確定(未ログイン)の間は読み込まず、初期値(オフ)を返す。 */
export function useMealNotificationSettings(userId: string | undefined): UseMealNotificationSettingsResult {
  const [settings, setSettings] = useState<MealNotificationSettings>(DEFAULT_MEAL_NOTIFICATION_SETTINGS);
  const [isLoading, setIsLoading] = useState(userId !== undefined);
  const [error, setError] = useState<MealNotificationSettingsError | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    let isActive = true;
    getMealNotificationSettings(getSupabaseClient(), userId).then((result) => {
      if (!isActive) return;
      if (result.ok) {
        setSettings(result.value);
        setError(null);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    });
    return () => {
      isActive = false;
    };
  }, [userId]);

  const update = useCallback(
    async (next: MealNotificationSettings) => {
      if (userId === undefined) return false;
      const previous = settings;
      setSettings(next);
      setError(null);
      const result = await saveMealNotificationSettings(getSupabaseClient(), userId, next);
      if (!result.ok) {
        setSettings(previous);
        setError(result.error);
        return false;
      }
      setSettings(result.value);
      return true;
    },
    [userId, settings]
  );

  return { settings, isLoading, error, update };
}
