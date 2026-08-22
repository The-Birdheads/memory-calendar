import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../shared/api/supabaseClient";
import { addReaction, deleteComment, listComments, listReactions, postComment } from "./service";
import type { CommunicationError, EventComment, EventReaction } from "./types";

export interface UseCommentsResult {
  comments: EventComment[];
  isLoading: boolean;
  error: CommunicationError | null;
  refetch: () => Promise<void>;
}

export function useComments(eventId: string): UseCommentsResult {
  const [comments, setComments] = useState<EventComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<CommunicationError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listComments(getSupabaseClient(), eventId);
    if (result.ok) {
      setComments(result.value);
      setError(null);
    } else {
      setComments([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { comments, isLoading, error, refetch };
}

export interface UsePostCommentResult {
  postComment: (eventId: string, body: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: CommunicationError | null;
}

export function usePostComment(): UsePostCommentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CommunicationError | null>(null);

  const runPostComment = useCallback(async (eventId: string, body: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await postComment(getSupabaseClient(), eventId, body);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { postComment: runPostComment, isSubmitting, error };
}

export interface UseDeleteCommentResult {
  deleteComment: (commentId: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: CommunicationError | null;
}

export function useDeleteComment(): UseDeleteCommentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CommunicationError | null>(null);

  const runDeleteComment = useCallback(async (commentId: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await deleteComment(getSupabaseClient(), commentId);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { deleteComment: runDeleteComment, isSubmitting, error };
}

export interface UseReactionsResult {
  reactions: EventReaction[];
  isLoading: boolean;
  error: CommunicationError | null;
  refetch: () => Promise<void>;
}

export function useReactions(eventId: string): UseReactionsResult {
  const [reactions, setReactions] = useState<EventReaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<CommunicationError | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const result = await listReactions(getSupabaseClient(), eventId);
    if (result.ok) {
      setReactions(result.value);
      setError(null);
    } else {
      setReactions([]);
      setError(result.error);
    }
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { reactions, isLoading, error, refetch };
}

export interface UseAddReactionResult {
  addReaction: (eventId: string, stampType: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: CommunicationError | null;
}

export function useAddReaction(): UseAddReactionResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<CommunicationError | null>(null);

  const runAddReaction = useCallback(async (eventId: string, stampType: string) => {
    setIsSubmitting(true);
    setError(null);
    const result = await addReaction(getSupabaseClient(), eventId, stampType);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { addReaction: runAddReaction, isSubmitting, error };
}
