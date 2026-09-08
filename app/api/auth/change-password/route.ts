import { NextResponse } from "next/server";
import { changePassword, toAuthError } from "../../../auth-server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    await changePassword(await request.json(), request);
    return NextResponse.json({ ok: true, message: "密码已修改" });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
