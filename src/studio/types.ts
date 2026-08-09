export type SavedPalette = {
  id: string;
  name: string;
  colors: string[];
};

export type TextStyleState = {
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
};

export type AuthMode = "login" | "register";

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  emailVerified: boolean;
};

export type AuthResponse = {
  user?: AuthUser | null;
  message?: string;
  verificationUrl?: string | null;
};
