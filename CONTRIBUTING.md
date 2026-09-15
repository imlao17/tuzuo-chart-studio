# Contributing

知图目前按“本地优先、可部署、可导出高清透明图表”的方向推进。提交改动时，优先保持现有工作流稳定，再扩展新模板或新设置。

## 本地准备

```bash
npm install
npm run dev
```

默认是本地模式：不需要账号就能保存项目文件、复制 PNG、导出 SVG 和下载 PNG。需要测试登录下载门槛时，设置：

```bash
NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=true
```

## 开发约定

- 新增图表类型时，在 `app/template-definition.ts` 注册字段角色、校验器、设置组、能力和示例数据。
- 新增图表配置时，同步更新 `ChartConfig`、UI 控件、对应 renderer 和行为测试。
- 不要让控件只显示但不生效。没有效果的设置应该从该模板的设置组里隐藏。
- 导出能力必须同时考虑 SVG 与 PNG，透明背景是核心场景。
- 本地项目文件 `.tuzuo.json` 应保持向后兼容，必要时在项目恢复逻辑中做迁移。

## 提交前检查

```bash
npm run lint
npm test
npm audit --omit=dev
```

涉及账号、注册、登录、导出权限或部署配置的改动，还需要检查 `docs/engineering/deployment.md` 是否同步。
