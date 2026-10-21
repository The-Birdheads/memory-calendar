import { expo } from "../../../../app.json";
import { LATEST_RELEASE_VERSION, RELEASE_NOTES } from "../releases";

describe("RELEASE_NOTES", () => {
  // "1.0.10" > "1.0.2" のように、数として比べる。
  const compareVersions = (a: string, b: string): number => {
    const left = a.split(".").map(Number);
    const right = b.split(".").map(Number);
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return 0;
  };

  // 不具合の修正だけの版では、新しいノートを足さない(全員に更新内容の画面を出さない)。
  // そのため、先頭のノートは、アプリのバージョンと同じか、それより古い。
  it("never has a release note newer than the app version", () => {
    expect(compareVersions(RELEASE_NOTES[0].version, expo.version)).toBeLessThanOrEqual(0);
    expect(LATEST_RELEASE_VERSION).toBe(RELEASE_NOTES[0].version);
  });

  it("lists releases from newest to oldest", () => {
    for (let index = 1; index < RELEASE_NOTES.length; index++) {
      expect(compareVersions(RELEASE_NOTES[index - 1].version, RELEASE_NOTES[index].version)).toBeGreaterThan(0);
    }
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
