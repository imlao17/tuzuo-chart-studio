import { NextResponse } from "next/server";
import { registerWithEmail, toAuthError } from "../../../auth-server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const result = await registerWithEmail(await request.json(), request);
    return NextResponse.json({
      email: result.email,
      emailDelivery: result.emailDelivery,
      message: "验证邮件已发送，请完成邮箱验证后再登录",
      verificationUrl: result.verificationUrl,
    });
  } catch (error) {
    const authError = toAuthError(error);
    return NextResponse.json(
      { error: authError.code, message: authError.message },
      { status: authError.status },
    );
  }
}
