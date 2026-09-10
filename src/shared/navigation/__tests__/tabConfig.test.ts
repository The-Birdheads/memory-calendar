import { TAB_ROUTES } from "../tabConfig";

describe("TAB_ROUTES", () => {
  it("defines the four bottom tabs in the expected order", () => {
    expect(TAB_ROUTES.map((route) => route.name)).toEqual(["calendar", "todos", "history", "meals"]);
  });

  it("gives every tab a non-empty title", () => {
    TAB_ROUTES.forEach((route) => {
      expect(route.title.length).toBeGreaterThan(0);
    });
  });

  it("does not define duplicate route names", () => {
    const names = TAB_ROUTES.map((route) => route.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tab an icon", () => {
    TAB_ROUTES.forEach((route) => {
      expect(route.icon.length).toBeGreaterThan(0);
    });
  });
});
