import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { AdBanner } from "../AdBanner";
import { AdsProvider, useAds } from "../AdsProvider";

jest.mock("expo-tracking-transparency", () => ({
  requestTrackingPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, status: "denied" }),
}));

function ReadyProvider({ children, start = true }: { children: React.ReactNode; start?: boolean }) {
  return (
    <AdsProvider>
      <Starter start={start} />
      {children}
    </AdsProvider>
  );
}

function Starter({ start }: { start: boolean }) {
  const { start: begin } = useAds();
  if (start) begin();
  return null;
}

async function renderReady(element: React.ReactElement) {
  const utils = await render(<ReadyProvider>{element}</ReadyProvider>);
  await act(async () => {});
  return utils;
}

describe("AdBanner", () => {
  it("renders nothing when ads are not ready (outside a provider, or before start)", async () => {
    const outside = await render(<AdBanner testID="ad" variant="banner" />);
    expect(outside.queryByTestId("ad")).toBeNull();
    outside.unmount?.();
  });

  it("renders nothing before the ads SDK has started", async () => {
    const { queryByTestId } = await render(
      <ReadyProvider start={false}>
        <AdBanner testID="ad" variant="banner" />
      </ReadyProvider>
    );

    expect(queryByTestId("ad")).toBeNull();
  });

  it("renders the banner once ads are ready", async () => {
    const { getByTestId } = await renderReady(<AdBanner testID="ad" variant="banner" />);

    expect(getByTestId("ad")).toBeTruthy();
    expect(getByTestId("ad-view")).toBeTruthy();
  });

  it("uses the 320x50 banner size for the 'banner' variant and the 300x250 size for the 'rectangle' variant", async () => {
    const banner = await renderReady(<AdBanner testID="ad" variant="banner" />);
    expect(banner.getByTestId("ad-view").props.size).toBe("BANNER");
  });

  it("uses the medium rectangle size for the 'rectangle' variant", async () => {
    const { getByTestId } = await renderReady(<AdBanner testID="ad" variant="rectangle" />);

    expect(getByTestId("ad-view").props.size).toBe("MEDIUM_RECTANGLE");
  });

  it("requests the Google test unit in development", async () => {
    const { getByTestId } = await renderReady(<AdBanner testID="ad" variant="banner" />);

    expect(getByTestId("ad-view").props.unitId).toBe("ca-app-pub-3940256099942544/2934735716");
  });

  it("asks for non-personalized ads when tracking was not allowed", async () => {
    const { getByTestId } = await renderReady(<AdBanner testID="ad" variant="banner" />);

    expect(getByTestId("ad-view").props.requestOptions).toEqual({ requestNonPersonalizedAdsOnly: true });
  });

  it("takes no space until the ad has loaded, then reserves exactly the ad's height", async () => {
    const { getByTestId } = await renderReady(<AdBanner testID="ad" variant="banner" />);

    expect(StyleSheet.flatten(getByTestId("ad").props.style).height).toBe(0);

    await fireEvent(getByTestId("ad-view"), "adLoaded");

    expect(StyleSheet.flatten(getByTestId("ad").props.style).height).toBe(50);
  });

  it("reserves 250 for a loaded rectangle", async () => {
    const { getByTestId } = await renderReady(<AdBanner testID="ad" variant="rectangle" />);

    await fireEvent(getByTestId("ad-view"), "adLoaded");

    expect(StyleSheet.flatten(getByTestId("ad").props.style).height).toBe(250);
  });

  it("disappears (no space, no ad view) when the ad fails to load", async () => {
    const { getByTestId, queryByTestId } = await renderReady(<AdBanner testID="ad" variant="banner" />);

    await fireEvent(getByTestId("ad-view"), "adFailedToLoad", { code: "no-fill" });

    expect(queryByTestId("ad")).toBeNull();
  });

  it("adds the vertical spacing only while the ad is shown, so no blank gap is left otherwise", async () => {
    const { getByTestId } = await renderReady(<AdBanner testID="ad" variant="banner" spacing={8} />);

    expect(StyleSheet.flatten(getByTestId("ad").props.style).marginVertical).toBeUndefined();

    await fireEvent(getByTestId("ad-view"), "adLoaded");

    expect(StyleSheet.flatten(getByTestId("ad").props.style).marginVertical).toBe(8);
  });
});
