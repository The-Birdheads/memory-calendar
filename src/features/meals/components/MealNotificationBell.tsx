import { useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

import { MealNotificationSettingsModal } from "./MealNotificationSettingsModal";
import { useAuthSession } from "../../auth/hooks";
import { useMealNotificationSettings } from "../notificationHooks";
import { Icon } from "../../../shared/components/Icon";

/**
 * 献立タブのヘッダー左のベル。押すと献立の通知設定を開く。通知がオンの間は、
 * 効いていることが分かるようにアクセントの青で表示する(オフは他のヘッダーアイコンと同じ濃いグレー)。
 * ログイン中ユーザーの設定の読み込み・保存も含めて自己完結にしてあり、ヘッダーに置くだけで使える。
 */
export function MealNotificationBell() {
  const { session } = useAuthSession();
  const { settings, update } = useMealNotificationSettings(session?.user.id);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        testID="meals-notification-button"
        accessibilityLabel="献立の通知設定"
        style={styles.button}
        onPress={() => setIsOpen(true)}
      >
        <Icon testID="meals-notification-icon" name="bell" size={20} color={settings.enabled ? "#2f6fed" : "#444"} />
      </TouchableOpacity>
      <MealNotificationSettingsModal
        visible={isOpen}
        settings={settings}
        onChange={(next) => {
          update(next);
        }}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    marginLeft: 8,
  },
});
