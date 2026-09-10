export type CalendarRole = "owner" | "editor" | "viewer";

/** "personal": no reactions/stamps feature. "group": full shared-calendar features. */
export type CalendarKind = "personal" | "group";

export interface Calendar {
  id: string;
  name: string;
  kind: CalendarKind;
  /** タグが付いていない予定をこの色で表示する(タグが付いていればタグの色が優先)。 */
  color: string;
  createdBy: string;
  createdAt: string;
}

export interface CalendarMember {
  calendarId: string;
  userId: string;
  role: CalendarRole;
  joinedAt: string;
  displayName: string | null;
}

export interface CreateCalendarInput {
  name: string;
  color?: string;
}

export interface UpdateCalendarInput {
  name?: string;
  color?: string;
}

export interface CalendarInvite {
  id: string;
  calendarId: string;
  code: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}

export type CalendarMembership = CalendarMember;

export type CalendarError =
  | { type: "NotFound" }
  | { type: "Forbidden" }
  | { type: "InviteExpired" }
  | { type: "ValidationError"; field: string };
