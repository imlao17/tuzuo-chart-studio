# 图作 · 透明图表工具

导入数据，制作图表，导出**透明背景**的 PNG 或 SVG。一个本地、轻量、可复用的静态图表图片生成器。

## 定位

图作不是 Flourish 那样的发布/协作平台，而是专注一件事：**快速生成一张干净的、透明背景的、可直接复用的图表图片**。所有控件都真实影响预览与导出，每个模板都有独立的数据字段、校验、菜单和行为。当前编辑状态会自动保存在浏览器本地，也可以保存/打开 `.tuzuo.json` 项目文件。

## 模板与家族

20 个起始样式，按 7 个渲染家族组织，每个家族有独立的 renderer、数据角色、设置菜单和能力声明：

| 家族 | 模板 |
|---|---|
| 柱/条 | 条形图、堆叠条形图、百分比条形图、柱状图、分组柱状图、堆叠柱状图、百分比柱状图 |
| 折线/面积 | 折线图、平滑折线图、阶梯折线图、面积图、堆叠面积图、百分比面积图、河流图 |
| 饼/环 | 饼图、环形图 |
| 组合 | 柱线组合图 |
| 散点 | 散点图 |
| 发散 | 发散条形图、人口金字塔 |

每个模板在 `app/template-definition.ts` 的 `TEMPLATE_REGISTRY` 里声明自己的数据绑定（角色）、校验器、设置组、能力，以及专属示例数据。

## 架构

```
buildChartOption(config)          ← 薄分派器
  → getTemplateDefinition(type)   ← 查 registry
  → buildWithRenderer(config, def)
      → buildRenderContext(config)        ← 预算 categories / dataSeries / formatNumber
      → def.buildOption(ctx)              ← 对应家族的 renderer
      → assembleOption(result, ...)       ← 共享 title / legend / tooltip / grid
```

- `app/template-definition.ts` — `TemplateDefinition` 注册表（角色 / 校验 / 菜单 / 能力 / 示例数据）
- `app/renderers/*.ts` — 每个家族一个 renderer（bar / line-area / pie / combo / scatter / diverging / streamgraph）
- `app/renderers/shared.ts` — 共享的轴原语、上下文组装、最终 option 拼装
- `app/chart-model.ts` — `ChartConfig` 类型、数据解析、`buildChartOption` 分派器
- `app/page.tsx` — 编辑器 UI（模板库、数据字段角色绑定、设置面板、预览、PNG/SVG 导出）
- `docs/project-stage-and-control.md` — 当前阶段、风险和接管建议
- `docs/layout-redesign-plan.md` — 下一轮左右布局调整方案

## 快速开始

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev      # 本地开发
npm run build    # 生产构建
npm test         # 构建 + HTML 回归测试 + 行为测试
npm run lint
```

## 测试

两类测试，`npm test` 会依次运行：

- `tests/rendered-html.test.mjs` — SSR 渲染的 HTML 回归 + 源码 token 断言（`node --test`）
- `tests/behavior.test.mts` — 行为回归（`tsx --test`），覆盖每个模板：配置变更是否真的改变 option、数据变更是否重绘、校验边界（空/负/文本/单列）、option 可导出性、示例数据渲染

## 技术栈

vinext + Next.js 16 + React 19 + ECharts 6 + Tailwind 4。可选 Cloudflare D1 / Drizzle（当前未使用）。
