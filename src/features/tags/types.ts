export type TagLevel = "major" | "mid" | "minor";

export interface Tag {
  id: string;
  parentId: string | null;
  level: TagLevel;
  name: string;
  /** null = 色未設定。表示時はカレンダー(や予定)の色にフォールバックする。 */
  color: string | null;
  createdAt: string;
}

export interface TagTreeNode extends Tag {
  children: TagTreeNode[];
}

export interface CreateTagInput {
  name: string;
  color: string | null;
  level: TagLevel;
  parentId?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string | null;
  level?: TagLevel;
  parentId?: string | null;
}

export type TagError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "InvalidHierarchy" };
