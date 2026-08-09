import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the chart studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>图作 · 透明图表工具<\/title>/);
  assert.match(html, /图作/);
  assert.match(html, /透明图表工具/);
  assert.match(html, /上传 CSV/);
  assert.match(html, /30(?:<!-- -->)?\s*种图表/);
  assert.match(html, /数据表/);
  assert.match(html, /搜索设置/);
  assert.match(html, /线条、数据点与面积/);
  assert.match(html, /数字格式/);
  assert.match(html, /标题样式/);
  assert.match(html, /副标题样式/);
  assert.match(html, /本地模式/);
  assert.match(html, /下载 PNG/);
  assert.match(html, /PNG/);
  assert.match(html, /SVG/);
  assert.doesNotMatch(html, /codex-preview|Building your site|SkeletonPreview/);
});

test("keeps the chart canvas mounted while editing data", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /workspaceMode !== "preview" \? "workspace-hidden"/);
  assert.match(page, /workspaceMode !== "data" \? "workspace-hidden"/);
  assert.match(page, /\[dataError, height, option, width, workspaceMode\]/);
  assert.match(styles, /\.workspace-hidden\s*\{[^}]*display:\s*none\s*!important/s);
});

test("includes the complete chart studio implementation", async () => {
  const [
    page,
    model,
    styles,
    layout,
    packageJson,
    authServer,
    authSchema,
    authRegisterRoute,
    authLoginRoute,
    authVerifyRoute,
    exportDownload,
    hostingConfig,
  ] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/chart-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/auth-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/auth/register/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/auth/login/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/auth/verify/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/studio/export/download.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  const templateDefinitions =
    model
      .match(/export const CHART_TEMPLATES:[\s\S]*?\n\];/)?.[0]
      .match(/\{\s*id:/g) ?? [];

  assert.equal(templateDefinitions.length, 30);
  assert.match(page, /renderer:\s*"svg"/);
  assert.match(page, /renderPngDataUrl/);
  assert.match(exportDownload, /URL\.createObjectURL\(blob\)/);
  assert.match(exportDownload, /export function safeFilename/);
  assert.match(exportDownload, /export async function renderPngDataUrl/);
  assert.match(page, /download=\{`\$\{safeFilename\(title\)\}/);
  assert.match(page, /tuzuo-custom-palettes/);
  assert.match(page, /editingPaletteId/);
  assert.match(page, /editSavedPalette/);
  assert.match(page, /TextStyleControls/);
  assert.match(page, /titleStyle/);
  assert.match(page, /subtitleStyle/);
  assert.match(page, /xAxisTitleStyle/);
  assert.match(page, /yAxisLabelStyle/);
  assert.match(page, /labelStyle/);
  assert.match(page, /标签样式/);
  assert.match(page, /X 轴标题样式/);
  assert.match(page, /Y 轴刻度样式/);
  assert.match(page, /系列颜色覆盖/);
  assert.match(page, /四周边距（px）/);
  assert.match(page, /leftPanelCollapsed/);
  assert.match(page, /rightPanelCollapsed/);
  assert.match(page, /PanelLeftClose/);
  assert.match(page, /PanelRightClose/);
  assert.match(page, /authUser/);
  assert.match(page, /requireDownloadAuth/);
  assert.match(page, /NEXT_PUBLIC_TUZUO_REQUIRE_AUTH/);
  assert.match(page, /\/api\/auth\/session/);
  assert.match(page, /登录 \/ 注册/);
  assert.match(page, /登录后可下载 SVG、PNG 和项目文件/);
  assert.match(page, /登录后才能下载/);
  assert.match(styles, /\.brand-logo/);
  assert.match(styles, /\.studio-grid\.left-collapsed/);
  assert.match(styles, /\.toolbar-group/);
  assert.match(styles, /\.auth-dialog/);
  assert.match(styles, /\.auth-toolbar/);
  assert.match(styles, /\.canvas-margin-block/);
  assert.match(styles, /--topbar-height:\s*58px/);
  assert.match(styles, /--control-height:\s*34px/);
  assert.match(styles, /--radius-control:\s*4px/);
  assert.match(styles, /--text-ui:\s*12px/);
  assert.match(styles, /height:\s*var\(--control-height\)/);
  assert.match(styles, /box-shadow:\s*var\(--focus-ring\)/);
  assert.match(page, /parseDelimited/);
  assert.match(page, /backgroundColor/);
  assert.match(styles, /\.topbar\s*\{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(page, /step-index/);
  assert.doesNotMatch(page, /高级布局/);
  assert.match(model, /populationPyramid/);
  assert.match(model, /streamgraph/);
  assert.match(model, /legendPosition/);
  assert.match(model, /legendAlign/);
  assert.match(model, /numberFormatter/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(authSchema, /sqliteTable\(\s*"users"/);
  assert.match(authSchema, /email_verification_tokens/);
  assert.match(authSchema, /sqliteTable\(\s*"sessions"/);
  assert.match(authServer, /PBKDF2/);
  assert.match(authServer, /RESEND_API_KEY/);
  assert.match(authServer, /SESSION_COOKIE/);
  assert.match(authRegisterRoute, /registerWithEmail/);
  assert.match(authLoginRoute, /setSessionCookie/);
  assert.match(authVerifyRoute, /verifyEmailToken/);
  assert.match(hostingConfig, /"d1":\s*"DB"/);

  await assert.rejects(
    access(new URL("../app/_sites-preview", templateRoot)),
  );
});
