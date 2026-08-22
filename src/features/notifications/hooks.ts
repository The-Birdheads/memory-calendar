import { useEffect } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { getExpoPushTokenAsync, registerPushToken, requestNotificationPermissionsAsync } from "./service";

export function useRequestNotificationPermissions(): void {
  useEffect(() => {
    requestNotificationPermissionsAsync().catch(() => {
      // 権限リクエストの失敗はアプリの起動を妨げない
    });
  }, []);
}

export function useRegisterPushToken(): void {
  useEffect(() => {
    async function register() {
      const status = await requestNotificationPermissionsAsync();
      if (status !== "granted") {
        return;
      }

      const token = await getExpoPushTokenAsync();
      if (!token) {
        return;
      }

      await registerPushToken(getSupabaseClient(), token);
    }

    register().catch(() => {
      // トークン登録の失敗はアプリの起動を妨げない
    });
  }, []);
}
