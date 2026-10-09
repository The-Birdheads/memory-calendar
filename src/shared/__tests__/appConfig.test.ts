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

  it("is version 1.0.0 for the initial release", () => {
    expect(expo.version).toBe("1.0.0");
  });
});
