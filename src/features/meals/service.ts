import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "../../shared/types/result";
import type {
  CreateMealRecordInput,
  CreateMealTagInput,
  MealError,
  MealFilter,
  MealRecord,
  MealTag,
  UpdateMealRecordInput,
} from "./types";

interface MealRecordRow {
  id: string;
  calendar_id: string;
  meal_date: string;
  slot: MealRecord["slot"];
  title: string;
  rating: number | null;
  url: string | null;
  memo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function mapMealRecordRow(row: MealRecordRow): MealRecord {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    mealDate: row.meal_date,
    slot: row.slot,
    title: row.title,
    rating: row.rating,
    url: row.url,
    memo: row.memo,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface MealTagRow {
  id: string;
  calendar_id: string;
  name: string;
  created_at: string;
}

function mapMealTagRow(row: MealTagRow): MealTag {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapMealError(error: PostgrestError): MealError {
  return { type: "Forbidden" };
}

export async function createMealRecord(
  client: SupabaseClient,
  input: CreateMealRecordInput
): Promise<Result<MealRecord, MealError>> {
  if (!input.title.trim()) {
    return err({ type: "ValidationError", field: "title" });
  }

  const { data, error } = await client
    .from("meal_records")
    .insert({
      calendar_id: input.calendarId,
      meal_date: input.mealDate,
      slot: input.slot,
      title: input.title,
      rating: input.rating ?? null,
      url: input.url ?? null,
      memo: input.memo ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return err(mapMealError(error as PostgrestError));
  }

  const mealRecord = mapMealRecordRow(data as MealRecordRow);

  if (input.tagIds && input.tagIds.length > 0) {
    const { error: tagError } = await client
      .from("meal_record_tags")
      .insert(input.tagIds.map((tagId) => ({ meal_record_id: mealRecord.id, meal_tag_id: tagId })));

    if (tagError) {
      return err(mapMealError(tagError));
    }
  }

  return ok(mealRecord);
}

export async function createMealTag(
  client: SupabaseClient,
  input: CreateMealTagInput
): Promise<Result<MealTag, MealError>> {
  if (!input.name.trim()) {
    return err({ type: "ValidationError", field: "name" });
  }

  const { data, error } = await client
    .from("meal_tags")
    .insert({ calendar_id: input.calendarId, name: input.name })
    .select()
    .single();

  if (error || !data) {
    return err(mapMealError(error as PostgrestError));
  }

  return ok(mapMealTagRow(data as MealTagRow));
}

export async function listMealRecords(
  client: SupabaseClient,
  calendarId: string,
  filter?: MealFilter
): Promise<Result<MealRecord[], MealError>> {
  let query = client.from("meal_records").select().eq("calendar_id", calendarId);

  if (filter?.slot) {
    query = query.eq("slot", filter.slot);
  }
  if (filter?.dateRange) {
    query = query.gte("meal_date", filter.dateRange.start).lte("meal_date", filter.dateRange.end);
  }

  const { data, error } = await query.order("meal_date", { ascending: true });

  if (error || !data) {
    return err(mapMealError(error as PostgrestError));
  }

  return ok((data as MealRecordRow[]).map(mapMealRecordRow));
}

/**
 * Batched version of listMealRecords, for screens (e.g. the meals tab) that
 * show records across several selected calendars at once instead of just one.
 */
export async function listMealRecordsByCalendars(
  client: SupabaseClient,
  calendarIds: string[],
  filter?: MealFilter
): Promise<Result<MealRecord[], MealError>> {
  if (calendarIds.length === 0) {
    return ok([]);
  }

  let query = client.from("meal_records").select().in("calendar_id", calendarIds);

  if (filter?.slot) {
    query = query.eq("slot", filter.slot);
  }
  if (filter?.dateRange) {
    query = query.gte("meal_date", filter.dateRange.start).lte("meal_date", filter.dateRange.end);
  }

  const { data, error } = await query.order("meal_date", { ascending: true });

  if (error || !data) {
    return err(mapMealError(error as PostgrestError));
  }

  return ok((data as MealRecordRow[]).map(mapMealRecordRow));
}

export async function updateMealRecord(
  client: SupabaseClient,
  mealRecordId: string,
  input: UpdateMealRecordInput
): Promise<Result<MealRecord, MealError>> {
  if (input.title !== undefined && !input.title.trim()) {
    return err({ type: "ValidationError", field: "title" });
  }

  const payload: Record<string, unknown> = {};
  if (input.mealDate !== undefined) payload.meal_date = input.mealDate;
  if (input.slot !== undefined) payload.slot = input.slot;
  if (input.title !== undefined) payload.title = input.title;
  if (input.rating !== undefined) payload.rating = input.rating;
  if (input.url !== undefined) payload.url = input.url;
  if (input.memo !== undefined) payload.memo = input.memo;

  const { data, error } = await client
    .from("meal_records")
    .update(payload)
    .eq("id", mealRecordId)
    .select()
    .single();

  if (error || !data) {
    return err(mapMealError(error as PostgrestError));
  }

  return ok(mapMealRecordRow(data as MealRecordRow));
}

export async function deleteMealRecord(
  client: SupabaseClient,
  mealRecordId: string
): Promise<Result<void, MealError>> {
  const { error } = await client.from("meal_records").delete().eq("id", mealRecordId);

  if (error) {
    return err(mapMealError(error));
  }

  return ok(undefined);
}
