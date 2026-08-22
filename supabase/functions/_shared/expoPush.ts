// Expo Push Notification Service へのメッセージ送信を行う共通ヘルパー。
// event-change-notifier / notification-dispatcher の両Edge Functionから利用する。

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<boolean> {
  if (messages.length === 0) {
    return true;
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}
