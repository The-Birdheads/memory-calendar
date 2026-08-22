export type TagLevel = "major" | "mid" | "minor";

export interface Tag {
  id: string;
  calendarId: string;
  parentId: string | null;
  level: TagLevel;
  name: string;
  color: string;
  createdAt: string;
}

export interface TagTreeNode extends Tag {
  children: TagTreeNode[];
}

export interface CreateTagInput {
  calendarId: string;
  name: string;
  color: string;
  level: TagLevel;
  parentId?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  level?: TagLevel;
  parentId?: string | null;
}

export type TagError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "InvalidHierarchy" };
