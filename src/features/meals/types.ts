export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealRecord {
  id: string;
  calendarId: string;
  mealDate: string;
  slot: MealSlot;
  title: string;
  rating: number | null;
  url: string | null;
  memo: string | null;
  // 作成者が退会した後も献立記録自体は残るため(アカウント削除時にNULL化される)、nullを許容する
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealTag {
  id: string;
  calendarId: string;
  name: string;
  createdAt: string;
}

export interface CreateMealRecordInput {
  calendarId: string;
  mealDate: string;
  slot: MealSlot;
  title: string;
  rating?: number;
  url?: string;
  memo?: string;
  tagIds?: string[];
}

export interface CreateMealTagInput {
  calendarId: string;
  name: string;
}

export interface MealFilter {
  slot?: MealSlot;
  dateRange?: { start: string; end: string };
}

export interface UpdateMealRecordInput {
  mealDate?: string;
  slot?: MealSlot;
  title?: string;
  rating?: number | null;
  url?: string | null;
  memo?: string | null;
}

export type MealError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "ValidationError"; field: string };
