# 图作 · 透明图表工具

导入数据，制作图表，导出**透明背景**的 PNG 或 SVG。一个本地、轻量、可复用的静态图表图片生成器。

## 定位

图作不是 Flourish 那样的发布/协作平台，而是专注一件事：**快速生成一张干净的、透明背景的、可直接复用的图表图片**。所有控件都真实影响预览与导出，每个模板都有独立的数据字段、校验、菜单和行为。当前编辑状态会自动保存在浏览器本地，也可以保存/打开 `.tuzuo.json` 项目文件。

## 模板与家族

75 个起始样式，按 renderer 家族组织，每个家族有独立的数据角色、设置菜单和能力声明：

| 家族 | 模板 |
|---|---|
| 柱/条 | 条形图、堆叠条形图、百分比条形图、柱状图、分组柱状图、堆叠柱状图、百分比柱状图、直方图、密度直方图、区间条形图、区间柱状图、子弹图、滑珠图、象形柱状图、进度条形图、排名条形图、帕累托图 |
| 折线/面积 | 折线图、平滑折线图、阶梯折线图、点线图、双轴折线图、斜率图、凹凸图、面积图、堆叠面积图、百分比面积图、平滑面积图、阶梯面积图、区间面积图、脊线图、河流图 |
| 饼/环 | 饼图、环形图、玫瑰图、面积玫瑰图、径向条形图、径向堆叠条形图、进度环形图、极坐标折线图、极坐标面积图 |
| 组合 | 柱线组合图 |
| 散点/分布 | 散点图、气泡图、分组散点图、象限图、回归散点图、蜂群图 |
| 发散 | 发散条形图、人口金字塔 |
| 层级 | 旭日图、树状图、径向树图、组织架构图 |
| 网络 | 力导向网络图、弦图、邻接矩阵图、冲积图、桑基图 |
| 高级常用 | 点图、瀑布图、热力图、矩形树图、漏斗图、仪表盘、雷达图、箱线图、蜡烛图 |
| 统计/分布 | 平行坐标图、日历热力图、累计分布图、误差线图、相关性矩阵图、小提琴图、马赛克图 |

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
- `app/renderers/*.ts` — 每个家族一个 renderer（bar / line-area / pie / combo / scatter / diverging / streamgraph / advanced）
- `app/renderers/shared.ts` — 共享的轴原语、上下文组装、最终 option 拼装
- `app/chart-model.ts` — `ChartConfig` 类型、数据解析、`buildChartOption` 分派器
- `app/page.tsx` — 编辑器 UI（模板库、数据字段角色绑定、设置面板、预览、PNG/SVG 导出）
- `app/auth-server.ts` — 邮箱注册、邮箱验证、登录会话、下载权限的服务端逻辑
- `app/api/auth/*` — 注册 / 登录 / 登出 / 会话 / 邮箱验证 API
- `db/schema.ts` — D1/Drizzle 用户、验证 token、会话表结构
- `drizzle/` — 数据库迁移文件
- `docs/engineering/deployment.md` — 本地部署、生产托管、账号与邮箱配置
- `docs/engineering/macos-desktop.md` — macOS 桌面版安装、打包与正式分发要求
- `docs/product/project-stage-and-control.md` — 当前阶段、风险和接管建议
- `docs/product/layout-redesign-plan.md` — 下一轮左右布局调整方案

## 快速开始

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev      # 本地开发
npm run build    # 生产构建
npm test         # 构建 + HTML 回归测试 + 行为测试
npm run lint
```

默认是本地模式，不需要账号就可以保存项目文件、复制 PNG、导出 SVG 和下载 PNG。公开托管时，可以通过 `NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=true` 打开“登录后才能导出”。

## macOS 桌面版

桌面版复用同一套 React 与 ECharts 编辑器，仅用 Electron 提供窗口和本机运行环境，不另写原生界面。当前安装包面向 Apple Silicon Mac：

```bash
npm run desktop:dev       # 本机打开桌面版
npm run desktop:mac:dir   # 生成可直接检查的 .app
npm run desktop:mac       # 生成未签名的内测 DMG 与 ZIP
```

安装、首次打开、签名与公证说明见 `docs/engineering/macos-desktop.md`。

## 部署与账号体系

当前版本已经接入最小可上线账号闭环：邮箱注册、邮箱验证、登录会话、登出、登录/注册限流，以及可配置的下载权限拦截。

两种运行方式：

| 模式 | 配置 | 适合场景 |
|---|---|---|
| 本地模式 | `NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=false`（默认） | 自己用、团队内网、开源用户本地部署 |
| 公开托管 | `NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=true` | 面向外部用户，要求登录后导出 |

生产环境需要配置：

| 配置 | 用途 |
|---|---|
| `DB` | Cloudflare D1 绑定名，已在 `.openai/hosting.json` 里声明为 `"d1": "DB"` |
| `RESEND_API_KEY` | 发送邮箱验证邮件 |
| `EMAIL_FROM` | 验证邮件发件人，例如 `图作 <no-reply@example.com>` |
| `APP_BASE_URL` | 生产站点根地址，用来生成邮箱验证链接 |

本地开发可临时配置 `AUTH_DEV_SHOW_VERIFICATION_LINK=true`。这样即使没有配置邮件服务，注册接口也会返回验证链接，方便本地验证流程；生产环境不要开启。

数据库迁移流程：

```bash
npm run db:generate
# 然后用部署控制台或 wrangler 将 drizzle/ 里的迁移应用到 D1
```

如果直接使用 `wrangler d1 migrations apply DB --local/--remote`，需要先在 `wrangler.jsonc` 里声明 D1 数据库；当前 Sites 部署配置以 `.openai/hosting.json` 为准。

完整部署说明见 `docs/engineering/deployment.md`。

## 测试

三类测试，`npm test` 会依次运行：

- `tests/rendered-html.test.mjs` — SSR 渲染的 HTML 回归 + 源码 token 断言（`node --test`）
- `tests/behavior.test.mts` — 行为回归（`tsx --test`），覆盖每个模板：配置变更是否真的改变 option、数据变更是否重绘、校验边界（空/负/文本/单列）、option 可导出性、示例数据渲染
- `tests/desktop.test.mjs` — Electron 安全配置、本机页面与静态资源回归测试

## 技术栈

vinext + Next.js 16 + React 19 + ECharts 6 + Tailwind 4 + Electron + Cloudflare D1 / Drizzle。

## 开源

本项目使用 MIT License。贡献约定见 `CONTRIBUTING.md`，安全问题报告见 `SECURITY.md`。
