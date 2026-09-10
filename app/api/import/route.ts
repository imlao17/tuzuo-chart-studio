import { NextResponse } from "next/server";

export const runtime = "edge";

const MAX_BYTES = 5_000_000;

/**
 * Same-origin proxy for remote table imports. Browsers block cross-origin
 * fetches to data hosts that do not send CORS headers, which is most of
 * them, so the client asks this endpoint to relay the payload instead.
 */
export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: unknown };
    if (typeof url !== "string") {
      return NextResponse.json(
        { error: "URL_REQUIRED", message: "缺少数据链接" },
        { status: 400 },
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "URL_INVALID", message: "链接格式无效" },
        { status: 400 },
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "URL_PROTOCOL", message: "仅支持 http(s) 链接" },
        { status: 400 },
      );
    }

    const upstream = await fetch(parsed.toString(), { redirect: "follow" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "UPSTREAM_ERROR", message: `数据源返回 ${upstream.status}` },
        { status: 502 },
      );
    }
    const text = await upstream.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "PAYLOAD_TOO_LARGE", message: "数据源内容超过 5MB，请精简后再导入" },
        { status: 413 },
      );
    }
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "FETCH_FAILED", message: "数据源无法访问" },
      { status: 502 },
    );
  }
}
