import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { getExpoPushTokenAsync, invalidatePushToken } from "../notifications/service";
import { signIn, signInWithGoogle, signOut, signUp } from "./service";
import type { AuthCredentials, AuthError } from "./types";

export interface UseAuthSessionResult {
  session: Session | null;
  isLoading: boolean;
}

export function useAuthSession(): UseAuthSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseClient();
    let isMounted = true;

    client.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, isLoading };
}

export interface UseAuthActionsResult {
  signUp: (credentials: AuthCredentials) => Promise<boolean>;
  signIn: (credentials: AuthCredentials) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<boolean>;
  isSubmitting: boolean;
  error: AuthError | null;
}

export function useAuthActions(): UseAuthActionsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const runSignUp = useCallback(async (credentials: AuthCredentials) => {
    setIsSubmitting(true);
    setError(null);
    const result = await signUp(getSupabaseClient(), credentials);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  const runSignIn = useCallback(async (credentials: AuthCredentials) => {
    setIsSubmitting(true);
    setError(null);
    const result = await signIn(getSupabaseClient(), credentials);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  const runSignInWithGoogle = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await signInWithGoogle(getSupabaseClient());
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  const runSignOut = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    const client = getSupabaseClient();

    try {
      const token = await getExpoPushTokenAsync();
      if (token) {
        await invalidatePushToken(client, token);
      }
    } catch {
      // トークン無効化の失敗はログアウトを妨げない
    }

    const result = await signOut(client);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return {
    signUp: runSignUp,
    signIn: runSignIn,
    signInWithGoogle: runSignInWithGoogle,
    signOut: runSignOut,
    isSubmitting,
    error,
  };
}
