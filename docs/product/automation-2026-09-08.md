# 今晚自动化任务单 · 账号收尾 + 手册跟进 + 样式统一 + 多轮验证

拟定日期：2026-09-08（周一晚已拟，供当晚 23:10 或此后任意一次自动化执行）

> 使用方式：在**新的 ZCode 会话**中说「读取 `docs/product/automation-2026-09-08.md`，创建今晚 23:10 的定时自动化，prompt 用该文档全文」，或直接把本文档作为指令立即执行。
> 原因：创建该任务单的会话本身属于昨晚的定时任务，平台禁止在定时任务会话内再创建定时任务。

---

你是图作（tuzuo-chart-studio）仓库的自动化执行者。图作是 React 19 + ECharts 6.1 + vinext(Next.js 16) + Tailwind 4 + Cloudflare D1/Drizzle 的透明图表图片生成器，已有 100 个图表模板和完整的账号体系（邮箱注册/验证/登录/会话/忘记密码/修改密码/云端项目保存）。Node >= 22，所有命令在仓库根目录执行。按批次 A→E 严格串行执行，每批独立提交。

## 重要环境事实（前几轮实测踩坑，直接照做）

- 工作区当前有一批**已验证未提交**的账号系统改动（126/126 测试全绿，含 tests/auth-and-projects.test.mts）。批次 A 第 0 步先原样提交它。
- 账号 API（/api/auth/*、/api/projects/*）需要 D1 绑定：**必须用 `WRANGLER_LOG_PATH=.wrangler/wrangler.log npx vinext dev -p 4174` 起 dev 服务器验证**（`.dev.vars` 已存在且含 AUTH_DEV_SHOW_VERIFICATION_LINK=true，注册/忘记密码接口会直接返回验证/重置链接）。生产模式 `vinext start` 不注入 worker 绑定，账号接口会报 DB_NOT_CONFIGURED，不要用它测账号。
- dev 服务器可能只监听 IPv6：curl 用 `http://localhost:4174`（不是 127.0.0.1）。
- 浏览器自动化（browser-use 技能）在 IAB 里 Playwright 点击常因 actionability 误判超时：优先用 `tab.playwright.evaluate` 在页面内对元素 `.click()`（React 合成事件正常触发），搜索框赋值用 HTMLInputElement value setter + dispatchEvent("input")。应用启动时有「已恢复上次编辑」恢复竞态，操作前等 2-3 秒。图表更新是同步 setOption（无 rAF），切换后 500-800ms 即可断言。
- 本地 D1 sqlite 已应用全部迁移（含 password_reset_tokens、projects 表）。
- 切换模板会自动载入目标模板示例数据（单次原子撤销检查点），这是预期行为。

## 通用红线（每批都适用）

- 不破坏已有功能和测试；`npm run typecheck` + `npm test` 全绿 + `npm run lint` 0 输出才算批次完成。
- 提交只 `git add` 本批触碰的具体文件，绝不 `git add -A` / `git commit -a`。
- **不要 git push**（推送由用户决定）。
- 用户可见文案用简体中文，与现有语气一致。
- 时间不足以完成全部批次时：把当前批次完整收尾（测试+提交）后停止，输出已完成的清单和剩余批次。

## 批次 A · 账号体系收尾

1. 第 0 步：提交工作区里已验证的账号系统快照（涉及：.gitignore、app/auth-server.ts、app/globals.css、app/page.tsx、db/schema.ts、docs/engineering/deployment.md、drizzle/、package.json、src/studio/ 下认证相关组件与 hook、app/api/auth/ 新路由、app/api/projects/、app/projects-server.ts、app/reset-password/、tests/auth-and-projects.test.mts、tests/rendered-html.test.mjs；提交信息如 "Add password reset/change and cloud project storage"）。
2. 起 dev 服务器（4174），浏览器 UI 全流程 e2e：注册（新邮箱）→ 打开返回的验证链接 → 登录 → 左栏「云端项目」保存 → 列表出现 → 打开 → 删除 → 工具栏钥匙按钮改密码 → 退出登录 → 忘记密码（用返回的重置链接）→ /reset-password 页面设新密码 → 新密码登录。每步断言 UI 状态（面板开合、列表内容、状态提示），发现问题就地修复并补测试。
3. README 的账号体系段落更新：忘记密码、修改密码、云端项目（每账号 50 个 / 单项目 1MB）、新增数据表（password_reset_tokens、projects）、.dev.vars 说明。提交。

## 批次 B · 手册遗留跟进项（docs/product/flourish-chart-parity-100.md 第 10 节「后续跟进」）

每项 = ChartConfig 可选字段 + settingsGroups 既有设置区最小接线 + 行为测试 + 提交，一项一提交：

1. 世界地图 nameMap 从 ~42 国扩充到 100+ 常用国家中英文映射（app/renderers/map.ts 的 WORLD_NAME_MAP；对照 GeoJSON 英文名核对拼写；不要动挪威=挪威这类已正确的）。
2. 象限图中线可配置：ChartConfig 加 quadrantCenter?: "median" | "mean"（默认 median 保持现状），设置区加选择控件，行为测试锁定两种模式输出不同。
3. 象形柱状图「每单位代表值」：ChartConfig 加 pictorialUnitValue?: number（默认自适应），渲染器用它换算 symbolRepeat 数量，行为测试覆盖。

完成后更新手册「后续跟进」清单勾掉对应项。

## 批次 C · 相同组件样式统一（用户明确要求）

1. 盘点 globals.css 与各组件（template-gallery、auth-dialog、reset-password、ConfirmDialog、export-toolbar、左栏面板、云端面板、settings 区）中**同一视觉角色的样式不一致**，已知线索：边框色混用硬编码 #d6d9dc 与 var(--line)；文字色混用 #727a81/#949da5/#2c353d 与既有 token；空状态样式 .cloud-empty 与 .empty-search 表达不一；各 dialog 的 overlay/header/圆角/阴影参数有出入。
2. 收敛原则：**不改设计语言，只消除不一致**——统一到既有 CSS 变量（--line、--text-ui、--radius-* 等），缺失的 token 在 :root 补定义再引用；删除重复定义。
3. 改完对关键界面截图核对（模板库、认证对话框、重置页、左栏、右栏设置区、工具栏、云端面板），确认没有视觉回归；不破坏 rendered-html 的 token 断言。提交（"Unify shared component styling onto design tokens" 类信息）。

## 批次 D · 桌面版分发验证

按 docs/engineering/macos-desktop.md 要求，因 public/geo 新增 1.6MB 静态资源：跑 `npm run desktop:smoke`（打包 .app 并自动启动验证）。耗时长属正常；失败则读日志定位（常见：签名/端口），能修则修，不能修则在报告中说明并跳过，不算阻塞。

## 批次 E · 多轮验证（用户明确要求）

1. 一轮验证 = typecheck + `npm test` 全量 + `npm run lint` + dev 服务器浏览器抽查关键路径：任选 5 个不同家族模板切换出图（画布 SVG 文本随模板变化）、云端项目存取、导出按钮态（本地模式可直接导出）。
2. 通过标准：**连续 2 轮全绿且期间零修复**。任一轮发现问题 → 修复 → 补测试 → 该轮作废从头计；最多 4 轮，超过则停机报告。
3. 每轮结果记入最终报告。

## 最终输出（总结报告）

本次完成的批次与关键产物、浏览器 e2e 与多轮验证每轮的实际结果、各批次提交哈希、发现并修复的问题清单、样式统一前后对照说明、未完成/受阻项及原因、给用户的下一步建议（如是否推送远程、是否上线部署）。
