export type CalendarRole = "owner" | "editor" | "viewer";

export interface Calendar {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface CalendarMember {
  calendarId: string;
  userId: string;
  role: CalendarRole;
  joinedAt: string;
}

export interface CreateCalendarInput {
  name: string;
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
