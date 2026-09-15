# 知图 macOS 桌面版

知图桌面版使用 Electron 作为轻量桌面外壳，编辑器、图表渲染、项目文件和导出逻辑仍然复用现有 React、ECharts 与 vinext 代码。桌面层只负责启动本机服务、创建窗口和限制窗口权限，没有单独开发一套原生界面。

## 安装和使用

当前安装包面向 Apple Silicon Mac（M1/M2/M3/M4 及后续同架构机型）。

1. 打开 `知图-0.1.0-arm64.dmg`。
2. 将“知图”拖入“应用程序”。
3. 从“应用程序”中打开知图。
4. 导入 CSV/Excel 数据或打开 `.tuzuo.json` 项目，编辑后直接导出 SVG、PNG 或项目文件。

编辑状态保存在当前 Mac 的应用数据中，不会自动上传。桌面打包命令会强制采用本地模式，不要求注册或登录，也不会继承公开网站的登录开关；导出的文件进入 macOS 默认下载目录。

### 首次打开提示

当前本地构建没有 Apple Developer ID 签名和公证。如果 macOS 阻止首次打开，可在 Finder 中按住 Control 点击“知图”，选择“打开”，再确认一次。准备公开分发前必须完成签名与公证，不能把这一操作当成正式用户安装流程。

## 本地开发

需要 Node.js `>=22.13.0`，首次使用先安装依赖：

```bash
npm install
```

开发和验证命令：

```bash
npm run desktop:dev       # 构建并打开桌面窗口
npm run desktop:mac:dir   # 生成未压缩的 .app，适合快速检查
npm run desktop:mac       # 生成未签名的内测 DMG 和 ZIP
npm run desktop:smoke     # 打包并自动验证应用启动、加载与退出
npm test                  # 网页、图表行为和桌面本地服务回归测试
npm run lint
```

产物统一写入 `release/`，不会提交到 Git。应用图标源文件位于 `desktop/resources/`。

## 桌面结构

| 文件 | 作用 |
|---|---|
| `desktop/main.mjs` | Electron 主进程、窗口、菜单、权限和外部链接策略 |
| `desktop/local-server.mjs` | 仅监听 `127.0.0.1`，承载生产构建和静态资源 |
| `electron-builder.yml` | 应用名称、图标、架构、DMG 与 ZIP 打包规则 |
| `tests/desktop.test.mjs` | 桌面安全配置、本地页面和静态资源回归测试 |
| `tests/desktop-smoke.test.mjs` | 从打包产物启动真实 Electron 应用的冒烟测试 |

桌面窗口启用了渲染进程沙箱与上下文隔离，关闭 Node.js 注入，拒绝网页权限请求。应用内只允许本机知图页面导航；HTTPS 与邮件链接交给系统默认应用打开。本机服务还会校验精确的 loopback Host，并使用每次启动随机生成的会话凭证保护页面和静态资源；仅知道端口无法访问应用内容。应用优先使用稳定端口以保留本地编辑状态，端口被占用时会自动回退到空闲端口，不会因此拒绝启动。

生产构建已经包含运行所需代码，因此安装包会排除项目根目录的 `node_modules`，避免把构建工具和重复依赖带进桌面应用。调整 vinext 构建方式或引入运行时外部模块后，必须重新执行 DMG 启动验证，不能只确认打包命令成功。

## 正式发布前

当前包适合本机使用和内部测试。公开发布前至少完成以下事项：

1. 申请 Apple Developer Program，并使用 Developer ID Application 证书签名。
2. 将安装包提交 Apple 公证服务，验证 Gatekeeper 安装流程。
3. 增加 Intel 或 Universal 构建，并在真实 Intel Mac 上验证；当前产物仅为 arm64。
4. 确认应用版本号、自动更新策略、隐私说明和崩溃反馈方式。
5. 在全新 macOS 用户环境中回归文件导入、项目保存、PNG/SVG 下载和中文文件名。

正式签名时应删除 `electron-builder.yml` 中的 `identity: null`，通过安全的 CI 密钥配置提供签名证书。证书和 Apple 账号密钥不得写入仓库。
