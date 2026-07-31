import { NextResponse } from "next/server";
import {
  loginWithEmail,
  setSessionCookie,
  toAuthError,
} from "../../../auth-server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const result = await loginWithEmail(await request.json());
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, request, result.sessionToken);
    return response;
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
