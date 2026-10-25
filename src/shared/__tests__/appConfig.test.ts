import appJson from "../../../app.json";

// App Store提出に関わる設定の取りこぼし防止(どれも抜けるとビルド/審査で問題になる)。
describe("app.json (App Store release config)", () => {
  const { expo } = appJson;

  it("is iPhone-only, so no iPad screenshots are required for the App Store listing", () => {
    expect(expo.ios.supportsTablet).toBe(false);
  });

  it("enables the Sign in with Apple capability (guideline 4.8, since Google sign-in is offered)", () => {
    expect(expo.ios.usesAppleSignIn).toBe(true);
    expect(expo.plugins).toContain("expo-apple-authentication");
  });

  it("declares the export-compliance answer so App Store Connect doesn't ask on every build", () => {
    expect(expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it("keeps the bundle identifier the App Store Connect record is registered under", () => {
    expect(expo.ios.bundleIdentifier).toBe("com.thebirdseed.memorycalendar");
  });

  it("shows 'Memory Calendar' as the name under the home-screen icon, matching the App Store name", () => {
    expect(expo.name).toBe("Memory Calendar");
  });

  it("keeps the slug the EAS project and its credentials are registered under", () => {
    expect(expo.slug).toBe("memory-calendar");
  });

  it("is version 1.0.3", () => {
    expect(expo.version).toBe("1.0.3");
  });

  // App Store の「言語」の行は、アプリ本体が宣言している対応言語を表示する。何も宣言しないと、
  // 画面が日本語でも「英語」と表示されてしまう。
  it("declares Japanese as the development region and the only localization (the App Store language row)", () => {
    const infoPlist = expo.ios.infoPlist as Record<string, unknown>;
    expect(infoPlist.CFBundleDevelopmentRegion).toBe("ja");
    expect(infoPlist.CFBundleLocalizations).toEqual(["ja"]);
  });

  describe("広告(AdMob)", () => {
    type PluginEntry = string | [string, Record<string, unknown>];
    const plugins = appJson.expo.plugins as PluginEntry[];
    const optionsOf = (name: string) => {
      const entry = plugins.find((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === name);
      return Array.isArray(entry) ? entry[1] : undefined;
    };

    it("registers the Google Mobile Ads plugin with an iOS app id (the SDK crashes at launch without one)", () => {
      expect(optionsOf("react-native-google-mobile-ads")?.iosAppId).toMatch(/^ca-app-pub-\d+~\d+$/);
    });

    it("lists Google's SKAdNetwork id so ad attribution works", () => {
      expect(optionsOf("react-native-google-mobile-ads")?.skAdNetworkItems).toContain("cstr6suwn9.skadnetwork");
    });

    it("explains the tracking permission request in Japanese (App Tracking Transparency)", () => {
      const description = optionsOf("expo-tracking-transparency")?.userTrackingPermission;

      expect(typeof description).toBe("string");
      expect((description as string).length).toBeGreaterThan(10);
    });
  });
});
