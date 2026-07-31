import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  logoutCurrentSession,
  toAuthError,
} from "../../../auth-server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    await logoutCurrentSession(request);
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, request);
  return response;
}
