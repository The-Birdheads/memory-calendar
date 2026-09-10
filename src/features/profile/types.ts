export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export type ProfileError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "ValidationError"; field: "displayName" };
