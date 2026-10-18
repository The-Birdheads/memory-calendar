import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { listEventAssigneeIds, setEventAssignees } from "./service";
import type { AssigneeError } from "./types";

export interface UseEventAssigneesResult {
  assigneeIds: string[];
  isLoading: boolean;
  error: AssigneeError | null;
  refetch: () => Promise<void>;
}

/** 予定に設定されている対象者のユーザーID(予定詳細の編集用)。 */
export function useEventAssignees(eventId: string): UseEventAssigneesResult {
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AssigneeError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listEventAssigneeIds(getSupabaseClient(), eventId);
    if (result.ok) {
      setAssigneeIds(result.value);
      setError(null);
    } else {
      setAssigneeIds([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { assigneeIds, isLoading, error, refetch };
}

export interface UseSetEventAssigneesResult {
  setEventAssignees: (eventId: string, userIds: string[]) => Promise<boolean>;
  isSubmitting: boolean;
  error: AssigneeError | null;
}

export function useSetEventAssignees(): UseSetEventAssigneesResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<AssigneeError | null>(null);

  const run = useCallback(async (eventId: string, userIds: string[]) => {
    setIsSubmitting(true);
    setError(null);
    const result = await setEventAssignees(getSupabaseClient(), eventId, userIds);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { setEventAssignees: run, isSubmitting, error };
}
