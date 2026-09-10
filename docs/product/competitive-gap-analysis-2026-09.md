# 图作 · 竞品功能差异分析

调研日期：2026-09-09
对比对象：Flourish、Datawrapper、RAWGraphs、Infogram（国外）；镝数图表、花火 Hanabi（国内）
图作基线：100 个静态图表模板（14 类目）、表格/CSV/TSV/Excel 粘贴、透明 PNG（1x/2x/4x）与 SVG 导出、邮箱账号 + 云端项目（50 个/1MB）、8 主题 + 自定义色板 + 文字样式、撤销历史、本地自动保存、`.tuzuo.json` 项目文件、macOS 桌面版、MIT 开源。

---

## 一、竞品定位速览

| 产品 | 定位 | 与图作的关系 |
|---|---|---|
| Flourish | 动态交互图表 + 数据故事（新闻媒体向） | 模板能力的对标上限 |
| Datawrapper | 出版级静态/响应式图表（编辑部向） | 工作流与标注能力的对标 |
| RAWGraphs | 开源、浏览器内处理、SVG/PNG 导出 | **定位最接近**（本地优先、无账号也可用） |
| Infogram | 信息图/报告/团队协作平台 | 多图组合与品牌能力对标 |
| 镝数图表 | 国内模板库（近 150 种）+ 动态格式 + AI（爱图表） | 国内市场对标 |
| 花火 Hanabi | 数据短视频/GIF 动图 | 动态导出对标 |

## 二、功能差距清单（按类归组）

### A. 数据接入（差距：大）

| # | 能力 | 竞品现状 | 图作现状 | 建议 |
|---|---|---|---|---|
| A1 | 在线表格链接（Google Sheets / 飞书 / 腾讯文档 / CSV URL）+ 一键刷新 | Datawrapper/Flourish 核心能力，支持 live-updating | 无 | **P1**：先支持公开 CSV URL + 「重新拉取」按钮（不需要 OAuth 即可覆盖飞书/腾讯文档的「生成链接」场景） |
| A2 | `.xlsx` 文件直接导入 | Datawrapper/Flourish/镝数均支持 | 仅粘贴与 CSV/TSV | **P1**：引入 SheetJS（约 300KB）解析工作表 |
| A3 | 转置行列、首行表头开关、多工作表选择 | Datawrapper 有 | 无 | P2 |

### B. 编辑与标注（差距：大，出版场景刚需）

| # | 能力 | 竞品现状 | 图作现状 | 建议 |
|---|---|---|---|---|
| B1 | **标注系统**：图内文字注记、箭头、高亮框、区间色块 | Datawrapper 有独立 Annotate 标签页 | 仅有参考线/参考区间（部分家族） | **P0**：做一个通用的「图形标注层」（ECharts graphic：文字/箭头/矩形框，画布上拖放定位），对出版场景是最大缺口 |
| B2 | 图内 Logo / 水印 | Datawrapper/Flourish/Infogram 均支持品牌位 | 无 | **P1**：画布角角落的水印图（上传 logo + 位置 + 透明度），品牌场景高频 |
| B3 | 多图组合 / 信息图排版 / 长图 | Infogram/Canva 核心形态 | 单图 | P2：需要画布形态升级（多组件拖放），改变产品架构，后置 |
| B4 | 主题/品牌套件（保存整套品牌色+字体一键套用） | Datawrapper Enterprise、Infogram 品牌包 | 已有自定义色板保存（单色板） | P2：把「色板 + 字体样式 + 标题样式」打包成可命名主题 |

### C. 动态与视频（差距：结构性）

| # | 能力 | 竞品现状 | 图作现状 | 建议 |
|---|---|---|---|---|
| C1 | 动态图表（条形竞赛、播放控件） | Flourish/镝数/花火核心卖点 | 无（定位静态图片） | P2：与「透明静态图片」定位有张力；若做，优先「动画时长 + 入场动画导出 GIF」这一小切口（花火路线） |
| C2 | GIF / MP4 导出 | 花火 Hanabi、Flourish（付费） | 无 | P2：依赖 C1；技术路径 ECharts 逐帧渲染 + WebCodecs/gif 编码 |

### D. 分享与发布（差距：中）

| # | 能力 | 竞品现状 | 图作现状 | 建议 |
|---|---|---|---|---|
| D1 | 云端项目只读分享链接（他人打开即见图表） | Flourish/Datawrapper/Infogram 全员标配 | 云端项目仅自己可见 | **P1**：依赖上线部署；`/p/<id>` 只读渲染页 + 「复制分享链接」按钮（复用现有 projects 表加 shareSlug 字段） |
| D2 | iframe 嵌入（响应式、数据更新联动） | Datawrapper/Flourish 核心 | 无（静态导出） | P2：依赖 D1 的 embed 端点 |
| D3 | 作品广场 / 模板社区 | Flourish 社区 | 无 | P3 |

### E. 账号与协作

| # | 能力 | 竞品现状 | 图作现状 | 建议 |
|---|---|---|---|---|
| E1 | 第三方登录（GitHub/Google/微信） | Infogram/Flourish 标配 | 仅邮箱 | P2：GitHub OAuth 对开源用户群最自然 |
| E2 | 团队空间 / 协作 | Infogram/Flourish 团队版 | 无 | P3（需要权限模型） |

### F. AI 能力（差距：中，机会窗口）

| # | 能力 | 竞品现状 | 图作现状 | 建议 |
|---|---|---|---|---|
| F1 | 自然语言 → 图表配置/数据生成 | 镝数「爱图表」（已接 DeepSeek）、Infogram AI | 无 | **P1**：图作已有 100 模板的强类型配置系统（ChartConfig），LLM 输出 JSON 配置即可渲染——接入成本低、是明确的差异化机会 |

### G. 平台与无障碍

| # | 能力 | 竞品现状 | 图作现状 | 建议 |
|---|---|---|---|---|
| G1 | PPT / Figma 插件 | Flourish 有 PPT 插件 | 无 | P2 |
| G2 | 英文界面 / 多语言 | 全部竞品 | 仅中文 | P2（开源国际化） |
| G3 | 无障碍（对比度已做，aria/alt 文案） | Datawrapper 领先 | 部分 | P2 |

## 三、图作的既有优势（应保持的差异化）

1. **本地优先 + 数据不出浏览器**：与 RAWGraphs 同类的隐私卖点，编辑过程零上传
2. **透明底导出**：多数竞品不突出的能力，PPT/设计合成的刚需
3. **100 模板 × ECharts 全能力**：静态模板数量已进入第一梯队（镝数 150 为上限）
4. **开源 MIT + macOS 桌面版**：竞品均闭源 SaaS
5. **切换模板自动载示例 + 原子撤销**：上手成本低

## 四、优先级路线建议

| 优先级 | 事项 | 理由 |
|---|---|---|
| **P0** | B1 通用图形标注层（文字/箭头/高亮框） | 出版与办公场景最大缺口；ECharts graphic 可实现；不改变产品架构 |
| **P1** | A1 CSV URL 导入、A2 xlsx 导入、B2 Logo 水印、D1 分享链接、F1 AI 图表配置 | 小切口高价值；其中 D1 依赖上线部署 |
| P2 | A3 转置/表头、B4 品牌套件、C1/C2 动画小切口、D2 embed、E1 GitHub 登录、G1 插件、G2 多语言 | 按用户反馈排期 |
| P3 | B3 多图信息图、D3 社区、E2 协作 | 战略级投入，暂缓 |

## 五、结论

图作在「静态透明图表图片」这个细分定位上，模板数量与导出能力已达到主流水准，本地优先与开源是独特优势。最大的三个差距：**标注系统（B1）、在线数据源（A1/A2）、分享链接（D1）**——前两个纯前端可实现，分享链接依赖部署。AI 图表生成（F1）是低成本的差异化机会，建议与 B1 一起纳入下一阶段。

数据来源：[Flourish](https://flourish.studio/)、[Datawrapper](https://www.datawrapper.de/)、[Datawrapper Annotate](https://www.datawrapper.de/academy/annotate-tab)、[Datawrapper 定价](https://www.datawrapper.de/pricing)、[RAWGraphs](https://www.rawgraphs.io/)、[Infogram](https://infogram.com/)、[镝数图表](https://dycharts.com/)、[花火 Hanabi](https://hanabi.data-viz.cn/index)、[ToolFlect 对比](https://toolflect.com/datawrapper-vs-flourish-which-data-visualization-tool-wins/)。
