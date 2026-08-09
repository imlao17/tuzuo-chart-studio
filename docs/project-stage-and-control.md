# 项目阶段与接管建议

更新日期：2026-08-09

## 当前判断

图作已经进入可用 MVP / 开源发布准备阶段。

它不是早期空壳 demo，而是已经具备完整闭环的透明图表图片生成器：

- 30 个图表起始样式；
- 8 个渲染家族；
- 模板注册表；
- 每个模板的字段绑定、校验器、设置组和示例数据；
- SVG 渲染预览；
- PNG / SVG 导出；
- 数据表编辑、CSV / TSV 上传和 Excel 粘贴；
- 自定义配色、本地配色保存；
- 自动恢复上次编辑；
- 本地项目文件打开与保存。
- 本地模式默认可直接导出；
- 可选邮箱注册、邮箱验证、登录会话和登录后导出；
- 登录/注册基础限流；
- 生产依赖安全审计清零。

## 工程状态

核心文件：

- `app/page.tsx`：主编辑器 UI 与状态编排。
- `app/chart-model.ts`：图表配置类型、数据解析和构建分派。
- `app/template-definition.ts`：模板注册表。
- `app/renderers/`：各图表家族渲染器。
- `tests/behavior.test.mts`：图表行为回归测试。
- `tests/rendered-html.test.mjs`：SSR 和页面关键内容回归测试。

当前健康检查：

- `npm test` 应通过。
- `npm run lint` 应保持 0 error / 0 warning。
- `npm audit --omit=dev` 应保持 0 vulnerability。

## 已收口事项

- 半成品 `ProjectState` 已接入自动恢复、本地保存和打开项目文件。
- 默认项目状态统一到 `DEFAULT_PROJECT`，避免 reset、保存、导入之间各维护一份默认值。
- Cloudflare Worker 环境类型通过 `worker/types.d.ts` 补齐。
- favicon 元数据已指向 `public/favicon.svg`。
- 邮箱验证链接不再从生产请求头里猜测公网地址，生产环境需要显式配置 `APP_BASE_URL`。
- 开源基础文件已补齐：`LICENSE`、`.env.example`、`CONTRIBUTING.md`、`SECURITY.md`、`docs/deployment.md`。
- 旧 ChatGPT 头部登录工具和 D1 notes starter 示例已移除。

## 主要风险

1. `app/page.tsx` 仍然过大。

   它同时负责主状态、数据表、模板库、设置面板、导出和项目文件。继续扩展前，应该拆出组件和状态工具。

2. 旧调研文档仍然保留历史口径。

   `docs/flourish-gap-analysis.md` 是很好的方向文档，但部分“当前状态”描述来自旧版本。后续应把它改成历史调研或更新口径。

3. 账号体系还只是最小可上线闭环。

   目前覆盖邮箱注册、验证、登录、会话和导出权限。还没有云端项目保存、团队空间、分享链接、支付订阅、第三方登录和多租户权限。

4. 新功能必须跟测试绑定。

   后续每增加一个设置项，都要同步更新：

   - `ChartConfig`
   - 对应 renderer
   - UI 控件
   - 示例数据（如需要）
   - 行为测试

## 接管原则

下一阶段不要先追求更多模板数量。

更稳的路线是：

1. 稳定现有 30 个起始样式。
2. 拆分 `app/page.tsx`。
3. 优化布局和信息架构。
4. 再扩展高价值静态模板家族。
5. 在保持本地模式稳定的前提下，再推进云端项目保存和账号内数据管理。

所有新增能力都要服务一个承诺：

> 快速生成一张干净、高清、可复用、可透明背景导出的图表图片。
