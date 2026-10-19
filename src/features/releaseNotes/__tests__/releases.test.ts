import { expo } from "../../../../app.json";
import { LATEST_RELEASE_VERSION, RELEASE_NOTES } from "../releases";

describe("RELEASE_NOTES", () => {
  it("has the newest release first, matching the app version (bump both together)", () => {
    expect(RELEASE_NOTES[0].version).toBe(expo.version);
    expect(LATEST_RELEASE_VERSION).toBe(expo.version);
  });

  it("has a unique version per release and at least one titled item in each", () => {
    const versions = RELEASE_NOTES.map((note) => note.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (const note of RELEASE_NOTES) {
      expect(note.items.length).toBeGreaterThan(0);
      for (const item of note.items) {
        expect(item.title.trim()).not.toBe("");
        expect(item.body.trim()).not.toBe("");
      }
    }
  });
});
