import { NextResponse } from "next/server";
import {
  getAppOrigin,
  toAuthError,
  verifyEmailToken,
} from "../../../auth-server";

export const runtime = "edge";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  let redirectUrl = new URL("/", requestUrl.origin);

  try {
    redirectUrl = new URL("/", await getAppOrigin(request));
    await verifyEmailToken(requestUrl.searchParams.get("token") ?? "");
    redirectUrl.searchParams.set("verified", "1");
  } catch (error) {
    const authError = toAuthError(error);
    redirectUrl.searchParams.set("auth_error", authError.code);
  }

  return NextResponse.redirect(redirectUrl);
}
