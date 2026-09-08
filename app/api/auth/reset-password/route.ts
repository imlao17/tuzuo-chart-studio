import { NextResponse } from "next/server";
import { resetPasswordWithToken, toAuthError } from "../../../auth-server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    await resetPasswordWithToken(await request.json(), request);
    return NextResponse.json({
      ok: true,
      message: "密码已重置，请使用新密码登录",
    });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
