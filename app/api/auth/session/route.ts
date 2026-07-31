import { NextResponse } from "next/server";
import { getCurrentUser, toAuthError } from "../../../auth-server";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return NextResponse.json({ user });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
