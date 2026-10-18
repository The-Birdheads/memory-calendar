import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

import { getBannerUnitId } from "./adConfig";
import { useAds } from "./AdsProvider";

/**
 * - banner: 標準のバナー(320×50)。画面の下部や、一覧の途中に入れる。
 * - rectangle: 大きめの広告(300×250)。予定の一覧の余白や、写真の一覧の途中に入れる。
 */
export type AdBannerVariant = "banner" | "rectangle";

const VARIANT_SIZE: Record<AdBannerVariant, { size: BannerAdSize; height: number }> = {
  banner: { size: BannerAdSize.BANNER, height: 50 },
  rectangle: { size: BannerAdSize.MEDIUM_RECTANGLE, height: 250 },
};

export interface AdBannerProps {
  testID?: string;
  variant: AdBannerVariant;
  /** 広告が表示されているときだけ、上下に空ける余白(広告が無いときに空白が残らないように)。 */
  spacing?: number;
}

/**
 * バナー広告1枠。広告の準備ができるまで・読み込みに失敗したときは何も出さない。読み込めるまでは
 * 場所を取らず(高さ0)、読み込めたら広告の高さ分だけ場所を取る(読み込みの前後で画面がずれない
 * ように、広告のない空白を作らない)。
 */
export function AdBanner({ testID, variant, spacing = 0 }: AdBannerProps) {
  const { isReady, nonPersonalizedOnly } = useAds();
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const unitId = getBannerUnitId();

  if (!isReady || unitId === null || status === "failed") {
    return null;
  }

  const { size, height } = VARIANT_SIZE[variant];

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        status === "loaded" ? { height, marginVertical: spacing } : { height: 0 },
      ]}
      pointerEvents="box-none"
    >
      <BannerAd
        // testID はテストで広告の見た目の代わり(jest/googleMobileAdsMock.js)を見分けるためのもの。
        // 本物の BannerAd は知らない属性を使わない。
        {...(testID ? ({ testID: `${testID}-view` } as object) : {})}
        unitId={unitId}
        size={size}
        requestOptions={{ requestNonPersonalizedAdsOnly: nonPersonalizedOnly }}
        onAdLoaded={() => setStatus("loaded")}
        onAdFailedToLoad={() => setStatus("failed")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
