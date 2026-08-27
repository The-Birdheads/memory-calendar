export type AuthError =
  | { type: "InvalidCredentials" }
  | { type: "EmailAlreadyInUse" }
  | { type: "Cancelled" }
  | { type: "Unknown"; message: string };

export interface AuthCredentials {
  email: string;
  password: string;
}
