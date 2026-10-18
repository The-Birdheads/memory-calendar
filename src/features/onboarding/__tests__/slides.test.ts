import { ONBOARDING_SLIDES } from "../slides";

describe("ONBOARDING_SLIDES", () => {
  it("covers sharing, memories, personal ToDo/tags and meals after the welcome slide", () => {
    expect(ONBOARDING_SLIDES.map((slide) => slide.id)).toEqual(["welcome", "share", "memories", "personal", "meals"]);
  });

  it("gives every slide a screenshot, a positive aspect ratio, a caption, a title and a body", () => {
    for (const slide of ONBOARDING_SLIDES) {
      expect(slide.image).toBeTruthy();
      expect(slide.imageAspectRatio).toBeGreaterThan(0);
      expect(slide.caption.length).toBeGreaterThan(0);
      expect(slide.title.length).toBeGreaterThan(0);
      expect(slide.body.length).toBeGreaterThan(0);
    }
  });

  it("uses a different screenshot for each slide", () => {
    expect(new Set(ONBOARDING_SLIDES.map((slide) => slide.image)).size).toBe(ONBOARDING_SLIDES.length);
  });
});
