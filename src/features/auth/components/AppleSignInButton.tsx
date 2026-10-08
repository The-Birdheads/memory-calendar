import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

export interface AppleSignInButtonProps {
  testID: string;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * Appleの公式「Appleでサインイン」ボタン(HIGで公式ボタンの使用が求められる)。
 * 端末がSign in with Appleに対応していない場合(古いOS等)は何も描画しない。
 * Googleログインを出す以上、App Storeガイドライン4.8により同等の選択肢が必要。
 */
export function AppleSignInButton({ testID, onPress, disabled }: AppleSignInButtonProps) {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (isMounted) setIsAvailable(available);
      })
      .catch(() => {
        // 判定に失敗したら出さない(他のログイン手段は使える)。
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isAvailable) return null;

  return (
    <View style={[styles.container, disabled && styles.disabled]} pointerEvents={disabled ? "none" : "auto"}>
      <AppleAuthentication.AppleAuthenticationButton
        testID={testID}
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
  },
  button: {
    height: 44,
  },
  disabled: {
    opacity: 0.5,
  },
});
