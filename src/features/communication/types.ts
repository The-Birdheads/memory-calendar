export interface EventComment {
  id: string;
  eventId: string;
  userId: string;
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
