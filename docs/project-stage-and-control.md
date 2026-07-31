# 项目阶段与接管建议

更新日期：2026-07-29

## 当前判断

图作已经进入可用 MVP / 内测版阶段。

它不是早期空壳 demo，而是已经具备完整闭环的透明图表图片生成器：

- 20 个图表起始样式；
- 7 个渲染家族；
- 模板注册表；
- 每个模板的字段绑定、校验器、设置组和示例数据；
- SVG 渲染预览；
- PNG / SVG 导出；
- 数据表编辑、CSV / TSV 上传和 Excel 粘贴；
- 自定义配色、本地配色保存；
- 自动恢复上次编辑；
- 本地项目文件打开与保存。

## 工程状态

核心文件：

- `app/page.tsx`：主编辑器 UI 与状态编排。
- `app/chart-model.ts`：图表配置类型、数据解析和构建分派。
- `app/template-definition.ts`：模板注册表。
- `app/renderers/`：各图表家族渲染器。
- `tests/behavior.test.mts`：图表行为回归测试。
- `tests/rendered-html.test.mjs`：SSR 和页面关键内容回归测试。

当前健康检查：

- `npm test` 通过。
- `npm run lint` 应保持 0 error / 0 warning。
- `npx tsc --noEmit` 可作为补充类型检查。

## 已收口事项

- 半成品 `ProjectState` 已接入自动恢复、本地保存和打开项目文件。
- 默认项目状态统一到 `DEFAULT_PROJECT`，避免 reset、保存、导入之间各维护一份默认值。
- Cloudflare Worker 环境类型通过 `worker/types.d.ts` 补齐。
- favicon 元数据已指向 `public/favicon.svg`。

## 主要风险

1. `app/page.tsx` 仍然过大。

   它同时负责主状态、数据表、模板库、设置面板、导出和项目文件。继续扩展前，应该拆出组件和状态工具。

2. 旧调研文档有些结论已过期。

   `docs/flourish-gap-analysis.md` 是很好的方向文档，但部分“当前状态”描述来自旧版本。后续应把它改成历史调研或更新口径。

3. 新功能必须跟测试绑定。

   后续每增加一个设置项，都要同步更新：

   - `ChartConfig`
   - 对应 renderer
   - UI 控件
   - 示例数据（如需要）
   - 行为测试

## 接管原则

下一阶段不要先追求更多模板数量。

更稳的路线是：

1. 稳定现有 20 个起始样式。
2. 拆分 `app/page.tsx`。
3. 优化布局和信息架构。
4. 再扩展高价值静态模板家族。

所有新增能力都要服务一个承诺：

> 快速生成一张干净、高清、可复用、可透明背景导出的图表图片。
