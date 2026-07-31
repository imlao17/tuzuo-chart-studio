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
  assert.match(html, /20 种图表/);
  assert.match(html, /数据表/);
  assert.match(html, /搜索设置/);
  assert.match(html, /线条、数据点与面积/);
  assert.match(html, /数字格式/);
  assert.match(html, /标题样式/);
  assert.match(html, /副标题样式/);
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
  const [page, model, styles, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/chart-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  const templateDefinitions =
    model
      .match(/export const CHART_TEMPLATES:[\s\S]*?\n\];/)?.[0]
      .match(/\{\s*id:/g) ?? [];

  assert.equal(templateDefinitions.length, 20);
  assert.match(page, /renderer:\s*"svg"/);
  assert.match(page, /renderPngDataUrl/);
  assert.match(page, /URL\.createObjectURL\(blob\)/);
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
  assert.match(styles, /\.brand-logo/);
  assert.match(styles, /\.studio-grid\.left-collapsed/);
  assert.match(styles, /\.toolbar-group/);
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

  await assert.rejects(
    access(new URL("../app/_sites-preview", templateRoot)),
  );
});
