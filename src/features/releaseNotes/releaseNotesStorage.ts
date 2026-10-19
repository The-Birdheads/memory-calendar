import AsyncStorage from "@react-native-async-storage/async-storage";

// どのバージョンのリリースノートまで見たかは、この端末の中にユーザーごとに覚えておく。
function storageKey(userId: string): string {
  return `releaseNotes.lastSeenVersion.v1.${userId}`;
}

/** そのユーザーが最後に見たリリースノートのバージョン(未記録なら null)。読み込みに失敗したときは "unknown"(見せ続けないよう、呼び出し側は出さない扱いにする)。 */
export async function getLastSeenReleaseVersion(userId: string): Promise<string | null | "unknown"> {
  try {
    return await AsyncStorage.getItem(storageKey(userId));
  } catch {
    return "unknown";
  }
}

/** リリースノートを見た(閉じた)ことを記録する。保存に失敗しても何も起こさない(次回また見えるだけ)。 */
export async function markReleaseNotesSeen(userId: string, version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), version);
  } catch {
    // 保存できなくても、アプリの動作は続ける。
  }
}
