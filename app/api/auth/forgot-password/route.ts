import { NextResponse } from "next/server";
import { requestPasswordReset, toAuthError } from "../../../auth-server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const result = await requestPasswordReset(await request.json(), request);
    return NextResponse.json({
      ok: true,
      message: "如果该邮箱已注册，重置邮件已发送，请查收",
      resetUrl: result.resetUrl,
    });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
