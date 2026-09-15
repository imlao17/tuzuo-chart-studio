# 部署说明

知图支持两种使用方式：本地自用和公开托管。默认优先保证本地部署顺滑，公开托管时再打开账号与下载权限。

## 本地模式

适合自己电脑、本地团队内网、或开源用户克隆后直接使用。

```bash
npm install
npm run dev
```

默认配置：

```bash
NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=false
```

在这个模式下，用户不需要登录就可以：

- 保存和打开 `.tuzuo.json` 项目文件；
- 导出 SVG；
- 复制 PNG；
- 下载 PNG；
- 使用 1x / 2x / 4x 倍率。

浏览器会自动保存上次编辑状态。所有图表数据默认留在本机浏览器和本地项目文件中。

## 生产托管模式

适合作为公开产品供外部用户访问。建议开启权限控制：

```bash
NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=true
APP_BASE_URL=https://your-domain.example
RESEND_API_KEY=...
EMAIL_FROM="知图 <no-reply@your-domain.example>"
```

### 渐进式分级权益模型（Freemium）

为了兼顾“极低试用门槛”与“高价值权益引导注册”，开启 `NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=true` 后，知图采用分级策略：

| 功能操作 | 免登录（游客/试用） | 登录用户（免费注册） | 说明 |
| --- | :---: | :---: | --- |
| 1x / 2x PNG 下载 | ✅ 开放 | ✅ 开放 | 满足日常汇报、社交媒体、PPT 插入需求 |
| 复制 PNG 到剪贴板 | ✅ 开放 | ✅ 开放 | 极速粘入飞书、微信、Notion |
| SVG 矢量无损导出 | ✅ 开放 | ✅ 开放 | 满足开发对接与基本矢量排版 |
| 本地项目保存与读取 (`.tuzuo.json`) | ✅ 开放 | ✅ 开放 | 保证单机数据不丢失，安全隐私无忧 |
| **4x 印刷级超高清 PNG** | 🔒 需登录 | ✅ 开放 | 适合专业印刷、超大画布展板 |
| **云端工程保存与集中管理** | 🔒 需登录 | ✅ 开放 | 多设备无缝同步，云端随时恢复 |

环境变量说明：

| 变量 | 必填场景 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_TUZUO_REQUIRE_AUTH` | 公开托管建议必填 | `true` 时启用上述渐进式权益分级（4x 导出与云端工程需登录；1x/2x、SVG、复制、本地保存全开放） |
| `APP_BASE_URL` | 注册邮箱验证必填 | 生产站点根地址，用来生成可信邮箱验证链接 |
| `RESEND_API_KEY` | 真实发邮件必填 | Resend API Key |
| `EMAIL_FROM` | 真实发邮件必填 | 验证邮件发件人 |
| `AUTH_DEV_SHOW_VERIFICATION_LINK` | 仅本地开发 | `true` 时注册接口会返回验证链接，生产不要开启 |

如果生产环境没有配置 `APP_BASE_URL`，注册会返回明确的配置错误，不会从请求头里猜测公网地址。

## 数据库

账号体系使用 Cloudflare D1 + Drizzle，表结构在 `db/schema.ts`，迁移文件在 `drizzle/`。

当前包含：

- `users`：用户、角色、状态、邮箱验证时间；
- `email_verification_tokens`：邮箱验证 token；
- `sessions`：登录会话；
- `auth_rate_limits`：登录、注册与密码重置限流；
- `password_reset_tokens`：密码重置 token；
- `projects`：用户云端图表工程存储。

生成迁移：

```bash
npm run db:generate
```

应用迁移时，用你的部署方式把 `drizzle/` 下的 SQL 应用到 D1。当前 Sites 配置使用 `.openai/hosting.json` 中的绑定：

```json
{
  "d1": "DB"
}
```

如果改用 Wrangler，需要在 Wrangler 配置里声明同名 D1 绑定。

## 发布前检查

```bash
npm run lint
npm test
npm audit --omit=dev
```

`npm test` 会执行类型检查、生产构建、SSR HTML 回归测试和图表行为测试。`npm audit --omit=dev` 用来确认生产依赖没有已知漏洞。

## 当前不包含的能力

- 团队空间 / 多人协作；
- 外链公开分享与只读嵌入；
- 支付或商业订阅；
- 第三方 OAuth 登录（如 GitHub / Google / 微信）；
- 多租户企业权限模型。

这些能力后续可以按需扩展，但不影响本地模式与单人云端保存的基础能力。
