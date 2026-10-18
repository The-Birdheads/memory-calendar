import { act, renderHook, waitFor } from "@testing-library/react-native";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import mobileAds from "react-native-google-mobile-ads";

import { AdsProvider, useAds } from "../AdsProvider";

jest.mock("expo-tracking-transparency", () => ({
  requestTrackingPermissionsAsync: jest.fn(),
}));

const adsSdk = mobileAds();

const wrapper = ({ children }: { children: React.ReactNode }) => <AdsProvider>{children}</AdsProvider>;

beforeEach(() => {
  (requestTrackingPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, status: "granted" });
  (adsSdk.initialize as jest.Mock).mockClear();
  (adsSdk.setRequestConfiguration as jest.Mock).mockClear();
});
afterEach(() => jest.clearAllMocks());

describe("AdsProvider", () => {
  it("is not ready, and does not touch the ads SDK, until start() is called", async () => {
    const { result } = await renderHook(() => useAds(), { wrapper });

    expect(result.current.isReady).toBe(false);
    expect(requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(mobileAds().initialize).not.toHaveBeenCalled();
  });

  it("asks for tracking permission, then initializes the ads SDK, then becomes ready", async () => {
    const { result } = await renderHook(() => useAds(), { wrapper });

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    const trackingOrder = (requestTrackingPermissionsAsync as jest.Mock).mock.invocationCallOrder[0];
    const initOrder = (adsSdk.initialize as jest.Mock).mock.invocationCallOrder[0];
    expect(trackingOrder).toBeLessThan(initOrder);
  });

  it("allows personalized ads when tracking was granted", async () => {
    const { result } = await renderHook(() => useAds(), { wrapper });

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.nonPersonalizedOnly).toBe(false);
  });

  it("falls back to non-personalized ads when tracking was denied (the ads still show)", async () => {
    (requestTrackingPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, status: "denied" });
    const { result } = await renderHook(() => useAds(), { wrapper });

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.nonPersonalizedOnly).toBe(true);
  });

  it("does not target children: requests are configured for a general audience", async () => {
    const { result } = await renderHook(() => useAds(), { wrapper });

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(adsSdk.setRequestConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false })
    );
  });

  it("only initializes once even if start() is called repeatedly", async () => {
    const { result } = await renderHook(() => useAds(), { wrapper });

    await act(async () => {
      result.current.start();
      result.current.start();
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(adsSdk.initialize).toHaveBeenCalledTimes(1);
  });

  it("stays not ready, without throwing, when the SDK fails to start", async () => {
    (adsSdk.initialize as jest.Mock).mockRejectedValueOnce(new Error("sdk"));
    const { result } = await renderHook(() => useAds(), { wrapper });

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => expect(adsSdk.initialize).toHaveBeenCalled());
    expect(result.current.isReady).toBe(false);
  });

  it("outside a provider, ads are simply not ready and start() does nothing (e.g. in tests)", async () => {
    const { result } = await renderHook(() => useAds());

    expect(result.current.isReady).toBe(false);
    expect(() => result.current.start()).not.toThrow();
  });
});
