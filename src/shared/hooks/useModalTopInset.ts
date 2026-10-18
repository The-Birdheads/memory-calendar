import { useContext } from "react";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

const MARGIN_BELOW_STATUS_BAR = 8;

/**
 * 画面の上端から広がりうるモーダル(下から出るシート、中身が長いカードなど)のオーバーレイの
 * paddingTop に使う値。ステータスバー(時計・カメラ・電波)に重ならないよう、上端のセーフエリア
 * 分に少しの余白を足して返す。SafeAreaProvider が無い環境(テストなど)では余白だけを返す。
 */
export function useModalTopInset(): number {
  const insets = useContext(SafeAreaInsetsContext);
  return (insets?.top ?? 0) + MARGIN_BELOW_STATUS_BAR;
}
