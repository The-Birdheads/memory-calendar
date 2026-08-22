import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { createMealRecord, createMealTag, deleteMealRecord, listMealRecords, updateMealRecord } from "./service";
import type {
  CreateMealRecordInput,
  CreateMealTagInput,
  MealError,
  MealFilter,
  MealRecord,
  UpdateMealRecordInput,
} from "./types";

export interface UseCreateMealRecordResult {
  createMealRecord: (input: CreateMealRecordInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: MealError | null;
}

export function useCreateMealRecord(): UseCreateMealRecordResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MealError | null>(null);

  const runCreateMealRecord = useCallback(async (input: CreateMealRecordInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createMealRecord(getSupabaseClient(), input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { createMealRecord: runCreateMealRecord, isSubmitting, error };
}

export interface UseCreateMealTagResult {
  createMealTag: (input: CreateMealTagInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: MealError | null;
}

export function useCreateMealTag(): UseCreateMealTagResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MealError | null>(null);

  const runCreateMealTag = useCallback(async (input: CreateMealTagInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await createMealTag(getSupabaseClient(), input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { createMealTag: runCreateMealTag, isSubmitting, error };
}

export interface UseMealRecordsResult {
  mealRecords: MealRecord[];
  isLoading: boolean;
  error: MealError | null;
  refetch: () => Promise<void>;
}

export function useMealRecords(calendarId: string, filter?: MealFilter): UseMealRecordsResult {
  const [mealRecords, setMealRecords] = useState<MealRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<MealError | null>(null);
  const slot = filter?.slot;
  const rangeStart = filter?.dateRange?.start;
  const rangeEnd = filter?.dateRange?.end;

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const resolvedFilter: MealFilter | undefined =
      slot !== undefined || (rangeStart !== undefined && rangeEnd !== undefined)
        ? { slot, dateRange: rangeStart !== undefined && rangeEnd !== undefined ? { start: rangeStart, end: rangeEnd } : undefined }
        : undefined;
    const result = await listMealRecords(getSupabaseClient(), calendarId, resolvedFilter);
    if (result.ok) {
      setMealRecords(result.value);
      setError(null);
    } else {
      setMealRecords([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [calendarId, slot, rangeStart, rangeEnd]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { mealRecords, isLoading, error, refetch };
}

export interface UseUpdateMealRecordResult {
  updateMealRecord: (mealRecordId: string, input: UpdateMealRecordInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: MealError | null;
}

export function useUpdateMealRecord(): UseUpdateMealRecordResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MealError | null>(null);

  const runUpdateMealRecord = useCallback(async (mealRecordId: string, input: UpdateMealRecordInput) => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateMealRecord(getSupabaseClient(), mealRecordId, input);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { updateMealRecord: runUpdateMealRecord, isSubmitting, error };
}

export interface UseDeleteMealRecordResult {
  deleteMealRecord: (mealRecordId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: MealError | null;
}

export function useDeleteMealRecord(): UseDeleteMealRecordResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<MealError | null>(null);

  const runDeleteMealRecord = useCallback(async (mealRecordId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteMealRecord(getSupabaseClient(), mealRecordId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { deleteMealRecord: runDeleteMealRecord, isSubmitting, error };
}
