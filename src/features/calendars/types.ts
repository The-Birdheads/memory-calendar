export type CalendarRole = "owner" | "editor" | "viewer";

/** "personal": no reactions/stamps feature. "group": full shared-calendar features. */
export type CalendarKind = "personal" | "group";

export interface Calendar {
  id: string;
  name: string;
  kind: CalendarKind;
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
  kind?: CalendarKind;
}

export interface UpdateCalendarInput {
  name?: string;
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
