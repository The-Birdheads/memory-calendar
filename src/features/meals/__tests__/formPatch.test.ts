import { mealFormPatchToUpdateInput } from "../formPatch";

describe("mealFormPatchToUpdateInput", () => {
  it("sends only the fields present in the patch", () => {
    expect(mealFormPatchToUpdateInput({ title: "筑前煮" })).toEqual({ title: "筑前煮" });
    expect(mealFormPatchToUpdateInput({ slot: "snack", mealDate: "2026-09-20" })).toEqual({
      slot: "snack",
      mealDate: "2026-09-20",
    });
  });

  it("turns an emptied URL or memo into null so it is cleared in the database", () => {
    expect(mealFormPatchToUpdateInput({ url: "" })).toEqual({ url: null });
    expect(mealFormPatchToUpdateInput({ memo: "" })).toEqual({ memo: null });
  });

  it("keeps a null rating (clearing the rating) and a calendar change", () => {
    expect(mealFormPatchToUpdateInput({ rating: null })).toEqual({ rating: null });
    expect(mealFormPatchToUpdateInput({ calendarId: "cal-2" })).toEqual({ calendarId: "cal-2" });
  });

  it("returns an empty input for an empty patch", () => {
    expect(mealFormPatchToUpdateInput({})).toEqual({});
  });
});
