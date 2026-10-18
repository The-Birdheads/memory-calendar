import { TestIds } from "react-native-google-mobile-ads";

/**
 * バナー広告の広告ユニットID。開発ビルドでは、Google 公式のテスト用ID(本物の広告も出ず、
 * 収益にも誤クリックの問題にもならない)を使う。リリースビルドでは、AdMob で作った本番の
 * 広告ユニットIDを、環境変数 EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID で渡す。
 * 本番のIDが無いリリースビルドでは、テスト広告にはせず、広告を出さない(null)。
 */
export function getBannerUnitId(): string | null {
  if (__DEV__) {
    return TestIds.BANNER;
  }
  const configured = process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID?.trim();
  return configured ? configured : null;
}
