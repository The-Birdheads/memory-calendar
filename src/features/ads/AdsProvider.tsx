import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import mobileAds from "react-native-google-mobile-ads";

export interface AdsState {
  /** 広告のSDKの準備ができ、バナーを出してよい。 */
  isReady: boolean;
  /** 「トラッキングを許可」されていないとき true(パーソナライズしない広告だけを出す)。 */
  nonPersonalizedOnly: boolean;
  /** 広告の準備を始める(トラッキング許可の確認 → SDKの初期化)。何度呼んでも1回だけ。 */
  start: () => void;
}

const DEFAULT_STATE: AdsState = { isReady: false, nonPersonalizedOnly: true, start: () => {} };

const AdsContext = createContext<AdsState>(DEFAULT_STATE);

export function useAds(): AdsState {
  return useContext(AdsContext);
}

/**
 * 広告の準備を管理する。start() が呼ばれるまで、トラッキング許可の確認も広告SDKの初期化も
 * しない(案内を見ている最中などに、許可の確認が割り込まないようにするため)。
 * Provider の外(テストなど)では、広告は準備できていない扱いで、何も出ない。
 */
export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [nonPersonalizedOnly, setNonPersonalizedOnly] = useState(true);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const tracking = await requestTrackingPermissionsAsync();
        await mobileAds().setRequestConfiguration({
          // 子ども向けとしては扱わない(一般の利用者向けのアプリ)。
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
        setNonPersonalizedOnly(!tracking.granted);
        setIsReady(true);
      } catch {
        // 広告が出せなくても、アプリの動作は続ける。
      }
    })();
  }, []);

  const value = useMemo(() => ({ isReady, nonPersonalizedOnly, start }), [isReady, nonPersonalizedOnly, start]);

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}
