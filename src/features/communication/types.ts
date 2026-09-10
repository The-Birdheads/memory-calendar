export interface EventComment {
  id: string;
  eventId: string;
  // 投稿者が退会した後もコメント自体は残るため(アカウント削除時にNULL化される)、nullを許容する
  userId: string | null;
  body: string;
  createdAt: string;
}

export interface EventReaction {
  id: string;
  eventId: string;
  userId: string;
  stampType: string;
  createdAt: string;
}

export type CommunicationError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "ValidationError"; field: string };
