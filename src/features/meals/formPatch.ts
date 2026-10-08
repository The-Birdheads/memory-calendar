import type { MealFormValues } from "./components/MealFormModal";
import type { UpdateMealRecordInput } from "./types";

/**
 * 献立の詳細(項目別編集)が返す差分(Partial<MealFormValues>)を、保存用の
 * UpdateMealRecordInput に変換する。差分に含まれる項目だけを送り、空にした
 * URL/メモは null(=削除)として保存する。
 */
export function mealFormPatchToUpdateInput(patch: Partial<MealFormValues>): UpdateMealRecordInput {
  return {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.url !== undefined ? { url: patch.url || null } : {}),
    ...(patch.memo !== undefined ? { memo: patch.memo || null } : {}),
    ...(patch.mealDate !== undefined ? { mealDate: patch.mealDate } : {}),
    ...(patch.slot !== undefined ? { slot: patch.slot } : {}),
    ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
    ...(patch.calendarId !== undefined ? { calendarId: patch.calendarId } : {}),
  };
}
