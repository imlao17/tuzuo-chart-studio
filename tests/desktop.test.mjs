import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import test from "node:test";

const root = new URL("../", import.meta.url);

function rawRequestStatus(url, headers) {
  return new Promise((resolveRequest, rejectRequest) => {
    const request = httpRequest(url, { headers }, (response) => {
      response.resume();
      response.once("end", () => resolveRequest(response.statusCode));
    });
    request.once("error", rejectRequest);
    request.end();
  });
}

function listen(server, port = 0) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

test("desktop shell keeps the renderer isolated and local", async () => {
  const [main, packageJson, builder] = await Promise.all([
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../electron-builder.yml", import.meta.url), "utf8"),
  ]);
  const packageConfig = JSON.parse(packageJson);

  assert.equal(packageConfig.main, "desktop/main.mjs");
  assert.match(packageConfig.scripts["desktop:mac"], /electron-builder --mac/);
  assert.match(packageConfig.scripts["desktop:mac"], /NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=false/);
  assert.match(packageConfig.scripts["desktop:smoke"], /desktop-smoke\.test\.mjs/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /setPermissionCheckHandler\(\(\) => false\)/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /new URL\(rawUrl\)\.origin === localOrigin/);
  assert.match(main, /insertCSS\(MACOS_WINDOW_CSS\)/);
  assert.match(main, /padding-left:\s*88px/);
  assert.match(main, /-webkit-app-region:\s*drag/);
  assert.match(main, /-webkit-app-region:\s*no-drag/);
  assert.match(main, /dialog\.showErrorBox/);
  assert.match(main, /TUZUO_DESKTOP_READY/);
  assert.match(builder, /appId:\s*com\.lao17\.tuzuo/);
  assert.match(builder, /target:\s*dmg/);
  assert.match(builder, /!node_modules\/\*\*\/\*/);
});

test("desktop local server renders the app and bundled assets", async (context) => {
  const { startLocalServer } = await import(
    new URL("desktop/local-server.mjs", root)
  );
  const server = await startLocalServer({ rootDirectory: root, port: 0 });
  context.after(() => server.close());

  const unauthorized = await fetch(server.origin);
  assert.equal(unauthorized.status, 403);

  const bootstrap = await fetch(server.url, { redirect: "manual" });
  assert.equal(bootstrap.status, 302);
  assert.equal(bootstrap.headers.get("location"), "/");
  const sessionCookie = bootstrap.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(sessionCookie);
  const requestOptions = { headers: { cookie: sessionCookie } };
  const wrongHostStatus = await rawRequestStatus(server.origin, {
    cookie: sessionCookie,
    host: "example.test",
  });
  assert.equal(wrongHostStatus, 403);
  const wrongOrigin = await fetch(server.origin, {
    headers: { cookie: sessionCookie, origin: "https://example.test" },
  });
  assert.equal(wrongOrigin.status, 403);

  const page = await fetch(server.origin, requestOptions);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type") ?? "", /^text\/html/);
  const html = await page.text();
  assert.match(html, /知图/);
  const stylesheetPath = html.match(/href="([^"]+\.css)"/)?.[1];
  assert.ok(stylesheetPath);
  const stylesheet = await fetch(new URL(stylesheetPath, server.origin), requestOptions);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get("content-type") ?? "", /^text\/css/);

  const icon = await fetch(new URL("favicon.svg", server.origin), requestOptions);
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get("content-type") ?? "", /image\/svg\+xml/);

  const traversal = await fetch(
    new URL("%2e%2e%2fpackage.json", server.origin),
    requestOptions,
  );
  assert.equal(traversal.status, 404);
});

test("desktop local server falls back when the preferred port is occupied", async (context) => {
  const { startLocalServer } = await import(
    new URL("desktop/local-server.mjs", root)
  );
  const blocker = createServer((_request, response) => response.end("occupied"));
  await listen(blocker);
  context.after(() => close(blocker));
  const address = blocker.address();
  assert.ok(address && typeof address === "object");

  const server = await startLocalServer({ rootDirectory: root, port: address.port });
  context.after(() => server.close());
  assert.notEqual(new URL(server.origin).port, String(address.port));

  const bootstrap = await fetch(server.url, { redirect: "manual" });
  assert.equal(bootstrap.status, 302);
});
