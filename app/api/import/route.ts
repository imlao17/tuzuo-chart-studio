import { NextResponse } from "next/server";

export const runtime = "edge";

const MAX_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

/** Block loopback, private ranges and link-local targets (SSRF defence).
 *  Hostname-level only: DNS-rebinding to internal IPs is out of scope for
 *  this single-tenant tool, but the obvious probes are refused. */
function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // cloud metadata endpoint
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return true;
  }
  return false;
}

async function fetchWithLimit(url: string) {
  // redirect:"manual" — redirect targets are re-validated in the caller so a
  // 30x cannot bypass the host blocklist.
  return fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "tuzuo-chart-import" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

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

    if (isBlockedHost(parsed.hostname)) {
      return NextResponse.json(
        { error: "URL_BLOCKED", message: "该链接指向内部地址，已被拒绝" },
        { status: 400 },
      );
    }

    let upstream = await fetchWithLimit(parsed.toString());
    let redirects = 0;
    while (upstream.status >= 300 && upstream.status < 400) {
      redirects += 1;
      if (redirects > MAX_REDIRECTS) {
        return NextResponse.json(
          { error: "TOO_MANY_REDIRECTS", message: "重定向次数过多" },
          { status: 502 },
        );
      }
      const location = upstream.headers.get("location");
      if (!location) break;
      const next = new URL(location, parsed.toString());
      if (isBlockedHost(next.hostname)) {
        return NextResponse.json(
          { error: "URL_BLOCKED", message: "重定向指向内部地址，已被拒绝" },
          { status: 400 },
        );
      }
      upstream = await fetchWithLimit(next.toString());
    }
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
