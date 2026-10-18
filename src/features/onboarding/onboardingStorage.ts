import AsyncStorage from "@react-native-async-storage/async-storage";

// 初回の案内(チュートリアル)を見たかどうかは、この端末の中にユーザーごとに覚えておく。
// バージョンを付けておき、案内の内容を大きく変えたときに、キーを上げて見せ直せるようにする。
function storageKey(userId: string): string {
  return `onboarding.completed.v1.${userId}`;
}

/** そのユーザーが案内を見終えているか。読み込みに失敗したときは、見せ続けないよう「見終えた」として扱う。 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(userId))) === "1";
  } catch {
    return true;
  }
}

/** 案内を見終えた(閉じた)ことを記録する。保存に失敗しても何も起こさない(次回また見えるだけ)。 */
export async function markOnboardingCompleted(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), "1");
  } catch {
    // 保存できなくても、アプリの動作は続ける。
  }
}
