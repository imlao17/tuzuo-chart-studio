# Security Policy

## Supported Versions

当前仓库仍处于 MVP 到开源发布准备阶段，安全修复只维护 `main` 分支。

## Reporting a Vulnerability

如果发现账号、邮箱验证、导出权限、数据库迁移或部署配置相关的安全问题，请先通过 GitHub Security Advisory 或私密渠道报告，不要直接公开可利用细节。

报告时尽量包含：

- 受影响的页面或 API；
- 复现步骤；
- 预期影响；
- 是否需要登录；
- 本地模式还是生产模式；
- 相关环境变量配置。

## Deployment Notes

本地部署默认不强制登录。公开部署时，如果需要登录后才能导出，请设置：

```bash
NEXT_PUBLIC_TUZUO_REQUIRE_AUTH=true
APP_BASE_URL=https://your-domain.example
RESEND_API_KEY=...
EMAIL_FROM="图作 <no-reply@your-domain.example>"
```

生产环境不要开启 `AUTH_DEV_SHOW_VERIFICATION_LINK=true`。
