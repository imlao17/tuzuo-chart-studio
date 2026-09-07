import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_PORT = 41731;
const SESSION_COOKIE = "tuzuo_desktop_session";
const STATIC_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};

function contentType(pathname) {
  return STATIC_TYPES[extname(pathname).toLowerCase()] ?? "application/octet-stream";
}

function createAssetsBinding(clientDirectory) {
  const clientRoot = resolve(clientDirectory);
  return {
    async fetch(request) {
      const url = new URL(request.url);
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(url.pathname);
      } catch (error) {
        if (process.env.TUZUO_DESKTOP_DEBUG) {
          console.error("Desktop asset lookup failed", { pathname: url.pathname, error });
        }
        return new Response("Not found", { status: 404 });
      }
      const relativePath = normalize(decodedPath).replace(/^[/\\]+/, "");
      const candidate = resolve(clientRoot, relativePath);
      if (candidate !== clientRoot && !candidate.startsWith(`${clientRoot}${sep}`)) {
        return new Response("Not found", { status: 404 });
      }

      try {
        const file = await stat(candidate);
        if (!file.isFile()) return new Response("Not found", { status: 404 });
        return new Response(createReadStream(candidate), {
          headers: {
            "cache-control": relativePath.startsWith("assets/")
              ? "public, max-age=31536000, immutable"
              : "no-cache",
            "content-length": String(file.size),
            "content-type": contentType(candidate),
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  };
}

function sendNodeResponse(nodeResponse, webResponse) {
  nodeResponse.statusCode = webResponse.status;
  for (const [name, value] of webResponse.headers) {
    nodeResponse.setHeader(name, value);
  }
  if (!webResponse.body) {
    nodeResponse.end();
    return;
  }
  const reader = webResponse.body.getReader();
  const pump = () =>
    reader.read().then(({ done, value }) => {
      if (done) {
        nodeResponse.end();
        return;
      }
      nodeResponse.write(value);
      return pump();
    });
  void pump().catch(() => nodeResponse.destroy());
}

async function createRequest(nodeRequest, origin) {
  const headers = new Headers();
  for (const [name, rawValue] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(rawValue)) rawValue.forEach((value) => headers.append(name, value));
    else if (rawValue !== undefined) headers.set(name, rawValue);
  }
  const method = nodeRequest.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : nodeRequest;
  return new Request(new URL(nodeRequest.url ?? "/", origin), {
    method,
    headers,
    body,
    duplex: body ? "half" : undefined,
  });
}

function getCookie(nodeRequest, name) {
  const cookieHeader = nodeRequest.headers.cookie ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function authorizeRequest(nodeRequest, origin, sessionToken) {
  const requestUrl = new URL(nodeRequest.url ?? "/", origin);
  if (nodeRequest.headers.host !== new URL(origin).host) return "deny";
  if (nodeRequest.headers.origin && nodeRequest.headers.origin !== origin) return "deny";
  if (getCookie(nodeRequest, SESSION_COOKIE) === sessionToken) return "allow";
  if (
    requestUrl.pathname === "/" &&
    requestUrl.searchParams.get("desktopToken") === sessionToken
  ) {
    return "bootstrap";
  }
  return "deny";
}

function listen(server, port) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, LOOPBACK_HOST, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

export async function startLocalServer({
  rootDirectory = new URL("../", import.meta.url),
  port = DEFAULT_PORT,
} = {}) {
  const rootPath = rootDirectory instanceof URL ? fileURLToPath(rootDirectory) : rootDirectory;
  const workerPath = join(rootPath, "dist", "server", "index.js");
  const clientPath = join(rootPath, "dist", "client");
  if (process.env.TUZUO_DESKTOP_DEBUG) {
    console.log("Desktop resources", { rootPath, workerPath, clientPath });
  }
  const worker = (await import(workerPath)).default;
  const assets = createAssetsBinding(clientPath);
  const sessionToken = randomBytes(32).toString("hex");

  let origin = `http://${LOOPBACK_HOST}:${port}`;
  const server = createServer(async (request, response) => {
    try {
      const authorization = authorizeRequest(request, origin, sessionToken);
      if (authorization === "bootstrap") {
        response.writeHead(302, {
          "cache-control": "no-store",
          location: "/",
          "set-cookie": `${SESSION_COOKIE}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`,
        });
        response.end();
        return;
      }
      if (authorization === "deny") {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }
      const webRequest = await createRequest(request, origin);
      const staticResponse = await assets.fetch(webRequest);
      if (staticResponse.status !== 404) {
        sendNodeResponse(response, staticResponse);
        return;
      }
      const webResponse = await worker.fetch(
        webRequest,
        { ASSETS: assets },
        {
          waitUntil() {},
          passThroughOnException() {},
        },
      );
      sendNodeResponse(response, webResponse);
    } catch (error) {
      console.error("Local application request failed", error);
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("图作启动失败，请重新打开应用。");
    }
  });

  try {
    await listen(server, port);
  } catch (error) {
    if (error?.code !== "EADDRINUSE" || port === 0) throw error;
    await listen(server, 0);
  }
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  origin = `http://${LOOPBACK_HOST}:${actualPort}`;

  return {
    origin,
    url: `${origin}/?desktopToken=${sessionToken}`,
    close: () =>
      new Promise((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose())),
      ),
  };
}
