// react-native-google-mobile-ads はネイティブのモジュールなので、テストでは使わない。
// 広告のコンポーネントは、画面に何が渡されたかを確認できる見た目だけの代わりに置き換える。
const React = require("react");
const { View } = require("react-native");

const BannerAdSize = {
  BANNER: "BANNER",
  MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
  ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER",
  LARGE_ANCHORED_ADAPTIVE_BANNER: "LARGE_ANCHORED_ADAPTIVE_BANNER",
  INLINE_ADAPTIVE_BANNER: "INLINE_ADAPTIVE_BANNER",
};

const TestIds = { BANNER: "ca-app-pub-3940256099942544/2934735716" };

function BannerAd(props) {
  return React.createElement(View, { testID: "mock-banner-ad", ...props });
}

const mobileAdsInstance = {
  initialize: jest.fn(() => Promise.resolve([])),
  setRequestConfiguration: jest.fn(() => Promise.resolve()),
};

module.exports = {
  __esModule: true,
  default: () => mobileAdsInstance,
  BannerAd,
  BannerAdSize,
  TestIds,
  mobileAdsInstance,
};
