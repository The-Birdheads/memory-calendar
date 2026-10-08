import { StyleSheet, TouchableOpacity, View } from "react-native";

export interface ToggleSwitchProps {
  testID: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * アプリ共通のオン/オフスイッチ。「終日」トグル(予定フォーム)と同じ見た目
 * (オン=アクセントの青、オフ=グレー)で、設定画面などで使う。
 */
export function ToggleSwitch({ testID, value, onValueChange, disabled, accessibilityLabel }: ToggleSwitchProps) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View testID={`${testID}-track`} style={[styles.track, value && styles.trackOn, disabled && styles.disabled]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#d8d8dc",
    padding: 2,
    justifyContent: "center",
  },
  trackOn: {
    backgroundColor: "#2f6fed",
  },
  disabled: {
    opacity: 0.5,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbOn: {
    transform: [{ translateX: 18 }],
  },
});
