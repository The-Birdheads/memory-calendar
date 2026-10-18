import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { ONBOARDING_SLIDES } from "../../slides";
import { OnboardingModal } from "../OnboardingModal";

function setup(overrides: Partial<React.ComponentProps<typeof OnboardingModal>> = {}) {
  const onClose = jest.fn();
  const utils = render(<OnboardingModal visible onClose={onClose} {...overrides} />);
  return { utils, onClose };
}

async function goToLastStep(getByTestId: (id: string) => unknown) {
  for (let i = 0; i < ONBOARDING_SLIDES.length; i += 1) {
    await fireEvent.press(getByTestId("onboarding-next") as never);
  }
}

describe("OnboardingModal", () => {
  it("shows nothing while it is not visible", async () => {
    const { queryByTestId } = await render(<OnboardingModal visible={false} onClose={jest.fn()} />);

    expect(queryByTestId("onboarding-title")).toBeNull();
  });

  it("starts on the first slide, with its title and body", async () => {
    const { utils } = setup();
    const { getByTestId } = await utils;

    expect(getByTestId("onboarding-title").props.children).toBe(ONBOARDING_SLIDES[0].title);
    expect(getByTestId("onboarding-body").props.children).toBe(ONBOARDING_SLIDES[0].body);
  });

  it("shows a cropped screenshot of the real app screen on each slide, with a one-line caption saying what it shows", async () => {
    const { utils } = setup();
    const { getByTestId } = await utils;

    for (const slide of ONBOARDING_SLIDES) {
      expect(getByTestId("onboarding-image").props.source).toBe(slide.image);
      expect(getByTestId("onboarding-caption").props.children).toBe(slide.caption);
      await fireEvent.press(getByTestId("onboarding-next"));
    }
  });

  it("sizes the screenshot to its own aspect ratio, never wider than the content", async () => {
    const { utils } = setup();
    const { getByTestId } = await utils;

    const style = StyleSheet.flatten(getByTestId("onboarding-image").props.style);
    expect(style.width / style.height).toBeCloseTo(ONBOARDING_SLIDES[0].imageAspectRatio, 2);
  });

  it("has no screenshot on the final 始める step", async () => {
    const { utils } = setup();
    const { getByTestId, queryByTestId } = await utils;

    await goToLastStep(getByTestId);

    expect(queryByTestId("onboarding-image")).toBeNull();
  });

  it("goes forward one slide at a time with 次へ, and back with 戻る", async () => {
    const { utils } = setup();
    const { getByTestId, queryByTestId } = await utils;

    expect(queryByTestId("onboarding-back")).toBeNull();

    await fireEvent.press(getByTestId("onboarding-next"));
    expect(getByTestId("onboarding-title").props.children).toBe(ONBOARDING_SLIDES[1].title);

    await fireEvent.press(getByTestId("onboarding-back"));
    expect(getByTestId("onboarding-title").props.children).toBe(ONBOARDING_SLIDES[0].title);
  });

  it("shows one progress dot per step (the slides plus the final 始める step), with the current one marked", async () => {
    const { utils } = setup();
    const { getByTestId, queryByTestId } = await utils;

    for (let i = 0; i <= ONBOARDING_SLIDES.length; i += 1) {
      expect(getByTestId(`onboarding-dot-${i}`)).toBeTruthy();
    }
    expect(queryByTestId(`onboarding-dot-${ONBOARDING_SLIDES.length + 1}`)).toBeNull();
    expect(getByTestId("onboarding-dot-0").props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId("onboarding-dot-1").props.accessibilityState).toEqual({ selected: false });

    await fireEvent.press(getByTestId("onboarding-next"));
    expect(getByTestId("onboarding-dot-1").props.accessibilityState).toEqual({ selected: true });
  });

  it("can be skipped from any slide before the last", async () => {
    const { utils, onClose } = setup();
    const { getByTestId } = await utils;

    await fireEvent.press(getByTestId("onboarding-next"));
    await fireEvent.press(getByTestId("onboarding-skip"));

    expect(onClose).toHaveBeenCalledWith("dismiss");
  });

  describe("最後の「始める」画面", () => {
    it("offers 共有カレンダーをつくる, 最初の予定を作る and あとで instead of 次へ/スキップ", async () => {
      const { utils } = setup();
      const { getByTestId, queryByTestId } = await utils;

      await goToLastStep(getByTestId);

      expect(getByTestId("onboarding-create-calendar")).toBeTruthy();
      expect(getByTestId("onboarding-create-event")).toBeTruthy();
      expect(getByTestId("onboarding-later")).toBeTruthy();
      expect(queryByTestId("onboarding-next")).toBeNull();
      expect(queryByTestId("onboarding-skip")).toBeNull();
    });

    it("closes with the chosen next step", async () => {
      const first = setup();
      const firstScreen = await first.utils;
      await goToLastStep(firstScreen.getByTestId);
      await fireEvent.press(firstScreen.getByTestId("onboarding-create-calendar"));
      expect(first.onClose).toHaveBeenCalledWith("create-calendar");
    });

    it("closes with create-event for 最初の予定を作る", async () => {
      const { utils, onClose } = setup();
      const { getByTestId } = await utils;

      await goToLastStep(getByTestId);
      await fireEvent.press(getByTestId("onboarding-create-event"));

      expect(onClose).toHaveBeenCalledWith("create-event");
    });

    it("closes with dismiss for あとで", async () => {
      const { utils, onClose } = setup();
      const { getByTestId } = await utils;

      await goToLastStep(getByTestId);
      await fireEvent.press(getByTestId("onboarding-later"));

      expect(onClose).toHaveBeenCalledWith("dismiss");
    });

    it("can still go back from the last step", async () => {
      const { utils } = setup();
      const { getByTestId } = await utils;

      await goToLastStep(getByTestId);
      await fireEvent.press(getByTestId("onboarding-back"));

      expect(getByTestId("onboarding-title").props.children).toBe(
        ONBOARDING_SLIDES[ONBOARDING_SLIDES.length - 1].title
      );
    });
  });

  it("closes with dismiss when the system back gesture asks to close", async () => {
    const { utils, onClose } = setup();
    const { getByTestId } = await utils;

    await fireEvent(getByTestId("onboarding-modal"), "requestClose");

    expect(onClose).toHaveBeenCalledWith("dismiss");
  });

  it("starts from the first slide again each time it is shown (viewing it again from the settings)", async () => {
    const { utils } = setup();
    const { getByTestId, rerender } = await utils;

    await fireEvent.press(getByTestId("onboarding-next"));
    await fireEvent.press(getByTestId("onboarding-next"));
    await rerender(<OnboardingModal visible={false} onClose={jest.fn()} />);
    await rerender(<OnboardingModal visible onClose={jest.fn()} />);

    expect(getByTestId("onboarding-title").props.children).toBe(ONBOARDING_SLIDES[0].title);
  });

  it("keeps its content below the status bar by padding the top with the safe-area inset", async () => {
    const { getByTestId } = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 34, left: 0, right: 0 }}>
        <OnboardingModal visible onClose={jest.fn()} />
      </SafeAreaInsetsContext.Provider>
    );

    const style = StyleSheet.flatten(getByTestId("onboarding-container").props.style);
    expect(style.paddingTop).toBeGreaterThanOrEqual(59);
    expect(style.paddingBottom).toBeGreaterThanOrEqual(34);
  });
});
