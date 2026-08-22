export type AuthError =
  | { type: "InvalidCredentials" }
  | { type: "EmailAlreadyInUse" }
  | { type: "Unknown"; message: string };

export interface AuthCredentials {
  email: string;
  password: string;
}
