import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { deleteOwnAccount, getMyProfile, updateDisplayName } from "./service";
import type { Profile, ProfileError } from "./types";

export interface UseMyProfileResult {
  profile: Profile | null;
  isLoading: boolean;
  error: ProfileError | null;
  refetch: () => Promise<void>;
}

export function useMyProfile(userId: string): UseMyProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ProfileError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await getMyProfile(getSupabaseClient(), userId);
    if (result.ok) {
      setProfile(result.value);
      setError(null);
    } else {
      setProfile(null);
      setError(result.error);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, isLoading, error, refetch };
}

export interface UseUpdateDisplayNameResult {
  updateDisplayName: (userId: string, displayName: string) => Promise<Profile | null>;
  isSubmitting: boolean;
  error: ProfileError | null;
}

export function useUpdateDisplayName(): UseUpdateDisplayNameResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  const runUpdateDisplayName = useCallback(async (userId: string, displayName: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await updateDisplayName(getSupabaseClient(), userId, displayName);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.value;
  }, []);

  return { updateDisplayName: runUpdateDisplayName, isSubmitting, error };
}

export interface UseDeleteAccountResult {
  deleteAccount: () => Promise<boolean>;
  isSubmitting: boolean;
  error: ProfileError | null;
}

export function useDeleteAccount(): UseDeleteAccountResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  const runDeleteAccount = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteOwnAccount(getSupabaseClient());
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { deleteAccount: runDeleteAccount, isSubmitting, error };
}
