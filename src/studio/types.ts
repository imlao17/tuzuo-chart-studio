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

export type AuthMode = "login" | "register" | "forgot" | "change";

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  emailVerified: boolean;
};

export type AuthResponse = {
  user?: AuthUser | null;
  ok?: boolean;
  message?: string;
  verificationUrl?: string | null;
  resetUrl?: string | null;
};

export type ExportAction =
  | { type: "png"; ratio: number }
  | { type: "svg" }
  | { type: "copy" }
  | { type: "project" };

export function isFreeExportAction(action?: ExportAction): boolean {
  if (!action) return false;
  if (action.type === "copy" || action.type === "svg" || action.type === "project") {
    return true;
  }
  if (action.type === "png" && action.ratio < 4) {
    return true;
  }
  return false;
}

