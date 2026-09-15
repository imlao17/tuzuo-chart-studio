# 定时任务单 · 竞品差距 P0/P1 功能实现 + 多轮验证

拟定日期：2026-09-10（供当晚 23:10 定时任务执行，内容与此前账号/样式批次完全不同——本轮为**新功能开发**）

---

你是知图（tuzuo-chart-studio）仓库的自动化执行者。知图是 React 19 + ECharts 6.1 + vinext(Next.js 16) + Tailwind 4 + Cloudflare D1/Drizzle 的透明图表图片生成器，已有 100 个图表模板（14 类目）、账号体系（注册/验证/登录/忘记密码/修改密码）、云端项目保存（50 个/1MB）。Node >= 22，所有命令在仓库根目录执行。

本轮任务来自竞品差距分析 docs/product/competitive-gap-analysis-2026-09.md 的 P0/P1 项：**通用图形标注层、CSV URL 导入、xlsx 导入、Logo 水印**。按批次 1→4 严格串行，每批独立提交。

## 重要环境事实（前几轮实测踩坑，直接照做）

- 浏览器自动化（browser-use 技能）在 IAB 里 Playwright 点击常因 actionability 误判超时：优先用 `tab.playwright.evaluate` 在页面内对元素 `.click()`（React 合成事件正常触发），输入框赋值用 HTMLInputElement value setter + dispatchEvent("input")。应用启动有「已恢复上次编辑」恢复竞态，操作前等 2-3 秒。图表更新是同步 setOption，切换后 500-800ms 即可断言。
- 账号 API 需要 D1 绑定：`WRANGLER_LOG_PATH=.wrangler/wrangler.log npx vinext dev -p 4174`（.dev.vars 已含 AUTH_DEV_SHOW_VERIFICATION_LINK=true）。curl 用 `http://localhost:4174`（可能只监听 IPv6）。
- 切换模板会自动载入目标模板示例数据（单次原子撤销检查点），这是预期行为。
- 标签自动对比度（inShapeLabelTextStyle）与描边已在位：新增的图形标注文字颜色同理可复用 hexLuminance。

## 通用红线（每批都适用）

- 不破坏已有功能和测试；`npm run typecheck` + `npm test` 全绿 + `npm run lint` 0 输出才算批次完成。
- 提交只 `git add` 本批触碰的具体文件，绝不 `git add -A` / `git commit -a`。
- **不要 git push**（推送由用户决定）。
- 用户可见文案用简体中文。新设置项一律走 ChartConfig 可选字段 + settingsGroups 既有设置区最小接线 + 行为测试。
- 依赖红线：**本轮允许引入一个新运行时依赖 `xlsx`（SheetJS）仅用于批次 2 的 Excel 解析**（纯前端解析、无网络依赖；安装时用 `npm install xlsx@0.18.5 --save` 并在提交说明里注明理由）。除此之外不得新增任何依赖。
- 时间不足时：当前批次完整收尾（测试+提交）后停止，输出已完成清单和剩余批次。

## 批次 1 · 通用图形标注层（P0，本批最大项）

给**所有模板**加一个统一的标注层，导出（PNG/SVG）必须包含标注。

1. `ChartConfig` 加 `annotations?: Annotation[]`，类型：
   ```ts
   type ChartAnnotation =
     | { id: string; kind: "text"; x: number; y: number; text: string; fontSize?: number; color?: string }
     | { id: string; kind: "arrow"; x1: number; y1: number; x2: number; y2: number; color?: string }
     | { id: string; kind: "rect"; x: number; y: number; width: number; height: number; color?: string };
   ```
   坐标用**画布像素**（相对图表左上角），与模板无关。
2. 渲染：在 `assembleOption`（app/renderers/shared.ts）输出 ECharts `graphic` 元素组（与现有 graphic 通道合并，不覆盖各模板已有的 graphic）。text 用 `type:"text"`，arrow 用 `type:"line"` + 箭头端点样式（SVG 兼容，不用 markPoint），rect 用 `type:"rect"`。
3. UI：右栏新增「图形标注」设置区（settingsGroups 注册表加 `annotations` 组），列表式管理：添加文字/箭头/矩形按钮 + 每条的坐标/颜色/文字编辑 + 删除。拖放画布定位本期不做（坐标数字输入即可）。
4. 撤销历史：标注变更走 applyCheckpoint（与现有设置一致）。
5. 测试：行为测试覆盖（标注输出到 graphic、PNG/SVG 导出包含——render-smoke 已有 ECharts 实例可断言 svg 内 text/line/rect 存在）；`.tuzuo.json` 存取包含 annotations（normalizeProject/collectProject 接线）。
6. 提交："Add a universal chart annotation layer"。

## 批次 2 · 数据导入增强（CSV URL + xlsx）

1. **CSV URL 导入**：数据表区加「从链接导入」输入框（默认公开 CSV 直链），fetch 拉取 → 走现有 parseDelimitedTable；错误给中文提示；保存最近使用的 URL（localStorage）。
2. **xlsx 导入**：`npm install xlsx@0.18.5 --save`；文件选择器扩展 accept（.xlsx/.xls）；解析第一个工作表 → 二维数组 → tableData（数字保持原样字符串，与现有粘贴行为一致）；转换在浏览器本地完成。
3. 测试：CSV URL 的解析走既有 parseDelimitedTable 已覆盖，新增 xlsx 解析的最小单元测试（用 xlsx 库生成一个工作簿 buffer 再解析往返）；渲染回归全绿。
4. 提交："Import data from CSV URLs and Excel workbooks"。

## 批次 3 · Logo 水印

1. `ChartConfig` 加 `watermark?: { dataUrl: string; position: "tl"|"tr"|"bl"|"br"; opacity: number; width: number }`（dataUrl 存 base64；默认右下 opacity 0.5 width 96）。
2. 渲染：assembleOption graphic 通道加 `type:"image"`（与标注层合并，不覆盖模板已有 graphic）；导出 PNG/SVG 天然包含（SVG 的 image 标签是 data URL，离线可用）。
3. UI：右栏「画布」区新增「水印」：上传图片（FileReader 转 dataUrl）、位置四选、透明度滑杆、宽度滑杆、清除按钮。
4. `.tuzuo.json` 存取接线；注意 1MB 云端配额——水印 dataUrl 会占空间，属预期。
5. 测试：行为测试断言 graphic 中 image 元素与位置/透明度映射；导出包含（render-smoke 抽查）。
6. 提交："Add a logo watermark option"。

## 批次 4 · 多轮验证（用户明确要求）

1. 一轮 = `npm run typecheck` + `npm test` 全量 + `npm run lint` + dev 服务器（4174）浏览器抽查：任选 5 个不同家族模板切换出图（画布 SVG 随模板变化）、标注层添加/删除在画布与导出 SVG 中可见、CSV URL 导入、水印显示、云端项目存取。
2. 通过标准：**连续 2 轮全绿且期间零修复**。发现问题 → 修复 → 补测试 → 该轮作废从头计；最多 4 轮。
3. 每轮结果记入最终报告。

## 最终输出（总结报告）

本批完成的功能与关键产物、标注层/导入/水印的 UI 与导出验证结果（含截图）、多轮验证每轮结果、各批次提交哈希、发现并修复的问题、受阻项及原因、下一步建议。
