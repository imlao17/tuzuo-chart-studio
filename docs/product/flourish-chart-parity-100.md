# Flourish 对标：补齐 100 种常用图表 · 自动化执行手册

更新日期：2026-09-07

本文档是**可执行的工作单**。自动化执行者（agent）必须先完整阅读本文档，再按「自动化执行协议」逐批次实施。人工协作者也可以用它跟踪进度。

## 1. 目标

把图作的图表目录从当前 **30 个起始样式** 扩充到 **100 个**，覆盖 Flourish 生态中最主要、最常用的图表类型（以 Flourish 官方认可的 FT 可视化词汇表 + Flourish 模板目录为参照）。

图作的定位不变：**快速生成一张干净的、透明背景的、可直接复用的静态图表图片**。因此本计划只收录"能生成一张有意义的静态图"的图表；Flourish 中依赖滚动、动画播放、故事步骤的交互形态（如轮播、故事页、问答、体育阵容、音乐播放器）明确不在范围内。

## 2. 已核实的硬约束（执行前必读）

1. 本地 `echarts@6.1.0` 内置系列：`bar`、`pictorialBar`、`line`、`pie`、`scatter`、`effectScatter`、`radar`、`tree`、`treemap`、`sunburst`、`boxplot`、`candlestick`、`chord`、`custom`、`funnel`、`gauge`、`graph`、`heatmap`、`lines`、`map`、`parallel`、`sankey`、`themeRiver`。**没有** `venn`、`circlePacking`。
2. 极坐标（polar）、日历（calendar）、单个 grid（singleAxis）、`graphic` 全局图层均可用，不依赖额外系列。
3. 数据模型是"表头 + 行"的二维表（`ParsedTable`），所有新模板的数据绑定必须能用「分类列 + 若干数值列 + 可选来源/去向列」表达。
4. `ChartFamily` 目前只有 `line | area | bar | pie | other`，`app/page.tsx` 存在按 family 的条件分支。**除非批次说明允许，一律复用这 5 个 family 值**，避免触碰编辑器 UI 分支。
5. 模板库缩略图走 `buildThumbnailOption`（`compact: true`）。每个新模板在 compact 模式下必须能出图（隐藏标签、压缩线宽都是既有做法，参照 `app/renderers/bar.ts`）。

## 3. 红线（任何批次都不得违反）

1. **不破坏已有 30 个模板**：不改它们的 id、显示名、默认视觉和行为；不删、不改弱 `tests/` 里已有断言。
2. **质量门槛**：`npm test` 全绿（typecheck + build + rendered-html + desktop + behavior），`npm run lint` 0 error / 0 warning。两者都通过才算批次完成。
3. **`app/page.tsx` 不做逐模板手写 UI**：新设置项一律走 `ChartConfig` 可选字段 + `settingsGroups` 注册表 + 既有设置区（`src/studio/settings/registry.ts`）；确需 family 级小接线时保持最小 diff。
4. **不新增运行时依赖**，除非批次说明明确允许（当前仅批次 9 的词云候选允许评估 `echarts-wordcloud`，且必须先在批次报告里说明理由）。
5. **Git 纪律**：仓库里存在与本项目无关的未提交桌面版改动（`desktop/`、`electron-builder.yml`、部分 `package.json`/`README` staged 内容）。提交时**只 `git add` 本批次明确触碰的文件**，禁止 `git add -A` / `git commit -a`。
6. 每个新模板必须有**专属示例数据**（`sampleData`），缩略图必须呈现该模板的标志性形态，不得与其他模板共用无法区分的数据。
7. 所有用户可见文案用简体中文，语气与现有 UI 一致。

## 4. 单个新模板的标准改动清单

新增一个模板 id（记为 `X`）需要按顺序完成：

1. `app/chart-model.ts`
   - `ChartType` 联合类型加 `"X"`；
   - `CHART_TEMPLATES` 数组加 `{ id, name: "中文名", family }`（放在所属家族相邻位置）；
   - 如需新设置项：在 `ChartConfig` 加**可选**字段，并写清注释（哪个家族读取）。
2. `app/template-definition.ts`
   - 新增 `SAMPLE_X` 示例数据常量；
   - `TEMPLATE_REGISTRY` 加条目：`dataBindings`（复用既有 BIND_* 预设，必要时新增预设）、`validators`（复用 `BASE_VALIDATORS`，多列需求用 `requireTwoNumericColumns(...)` 这类工厂）、`settingsGroups`（选最贴近的既有组集合）、`capabilities`（选最贴近的预设）、`buildOption`、`sampleData`。
3. `app/renderers/<家族>.ts`
   - 实现或扩展 `buildXOption(ctx: RenderContext): RendererResult`；返回 `{ series, xAxis?, yAxis? }` 或带 polar/calendar/geo 的等价结构（参照 `advanced.ts` 里非笛卡尔模板的做法）。
   - 必须尊重共享配置：主题色（`colorFor`）、标签（`dataLabelTextStyle`、`resolveDataLabelPosition`）、`formatNumber`、透明度、compact 模式。
4. `tests/behavior.test.mts`
   - 通用套件（全类型遍历）会自动覆盖新模板的"示例数据可渲染 / option 可序列化"；
   - 另为 `X` 增加**至少 3 条**专属断言：改一个设置项 → option 变化；改一格数据 → option 变化；校验器边界（如缺数值列时的报错文案）。
5. `tests/rendered-html.test.mjs`
   - 检查是否有需要同步的源码 token 断言（如模板数量），有则更新。
6. `README.md` 的「模板与家族」表：把新模板加进对应家族行。
7. 本文档第 7 节清单中把该模板状态从 `待做` 改为 `完成`。

## 5. 自动化执行协议

每个批次（Batch）是一次独立执行单元。执行者按以下步骤工作：

1. **领批次**：读第 7 节状态表，选择最靠前的 `待开始` 批次（按 1→11 顺序，不要跳批、不要并行多批，因为它们共享同一组文件）。
2. **实现**：按第 4 节清单逐模板实现。每完成一个模板就跑一次 `npx tsc --noEmit` 快速纠错。
3. **验证**：`npm test` 全绿 + `npm run lint` 0 输出。失败就修，不允许跳过或注释掉测试。
4. **收尾**：更新 README 模板表、本文档状态表（批次状态、完成日期、提交哈希、备注）；把状态表里本批模板改为 `完成`。
5. **提交**：`git add <本批触碰的文件列表>` → `git commit -m "Add <批次名>（N 个模板）：<模板中文名列表>"`。提交信息用英文 id + 中文模板名混合均可，保持与仓库历史风格一致（看 `git log` 的祈使句风格）。
6. **报告**：输出一段批次报告：完成了哪些模板、测试结果、触碰文件列表、遇到的设计取舍。受阻模板不得硬塞：在状态表标注 `受阻` 并写明原因，然后继续批内其他模板。

**受阻处理**：标记 `P2-可延后` 的模板（见清单）若实现两次尝试仍失败，直接标 `暂缓` 并继续；非 P2 模板受阻时，先尝试用第 8 节候补清单里语义最接近的候补项顶替（同样标注替换关系），保证总数 100 不变。

## 6. 批次总览与状态追踪

| 批次 | 名称 | 模板数 | 状态 | 完成日期 | 提交 | 备注 |
|---|---|---|---|---|---|---|
| 1 | 条形/柱状扩展 | 10 | 已完成 | 2026-09-07 | `6d28dc3` | 密度直方图与象形柱状图两个 P2 均已完成；象形柱状图的「每单位代表值」暂不可配置（单位符号固定 10px 高 + 2px 间距），后续批次可补 |
| 2 | 折线/面积扩展 | 8 | 已完成 | 2026-09-07 | 随本批提交（"Add 8 line/area chart templates…"） | 点线图/平滑面积图/阶梯面积图复用既有 line-area 路径；双轴折线/斜率/区间面积/脊线/凹凸为独立构造器 |
| 3 | 径向/极坐标家族 | 7 | 已完成 | 2026-09-07 | 随本批提交（"Add 7 radial/polar chart templates…"） | 新建 `renderers/radial.ts`；shared.ts 的 RendererResult 扩展了 polar/angleAxis/radiusAxis/graphic 通道（对既有模板零影响） |
| 4 | 散点/气泡扩展 | 5 | 已完成 | 2026-09-07 | 随本批提交（"Add 5 scatter/bubble chart templates…"） | bubble/trendScatter 为 scatter 的配置注入包装器；象限图中线取中位数（均值可配置项留待后续） |
| 5 | 层级与网络 | 8 | 已完成 | 2026-09-07 | 随本批提交（"Add 8 hierarchy/network chart templates…"） | 新建 `renderers/hierarchy.ts`、`renderers/network.ts`；冲积图复用 sankey 渲染路径（差异在多阶段示例数据）；弦图用 ECharts 6.1 内置 chord 系列 |
| 6 | 统计与分布 | 7 | 待开始 | — | — | 含 2 个 P2 |
| 7 | 条柱线补充变体 | 8 | 待开始 | — | — | 含 1 个 P2 |
| 8 | 环饼与箱线补充 | 4 | 待开始 | — | — | |
| 9 | 卡片、表格与文字 | 5 | 待开始 | — | — | 词云需依赖决策 |
| 10 | 时间与分面 | 3 | 待开始 | — | — | 小倍数是本批难点 |
| 11 | 地图家族 | 5 | 待开始 | — | — | **先做 GeoJSON 基础设施决策（见批次说明）** |

## 7. 全量清单（100 = 已有 30 + 新增 70）

状态取值：`已有`（上线即有，勿动）/ `待做` / `完成` / `暂缓` / `受阻`。

### 批次 1 · 条形/柱状扩展（bar.ts / combo.ts）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 1 | 直方图 | `histogram` | bar，renderer 内对单数值列分箱 | 分类列=数值列本身；自动等宽分箱（10–15 箱），类目轴显示区间端点 | 完成 |
| 2 | 密度直方图 | `densityHistogram` | bar + 平滑 line（归一化密度） | 同上，叠加核密度曲线（右侧隐藏轴或归一化到计数） | 完成 |
| 3 | 区间条形图 | `rangeBar` | bar×2 堆叠（基座透明） | 2 数值列：下限、上限 | 完成 |
| 4 | 区间柱状图 | `rangeColumn` | 同上竖向 | 同上 | 完成 |
| 5 | 子弹图 | `bulletBar` | bar + 目标刻度（markLine/细条） | 2 数值列：实际值、目标值 | 完成 |
| 6 | 滑珠图 | `lollipop` | 细 bar + scatter 圆珠 | 分类 + 1..n 数值列，每系列一根杆一颗珠 | 完成 |
| 7 | 象形柱状图 | `pictorialColumn` | pictorialBar，symbolRepeat | 分类 + 1 数值列；symbol 用内置可缩放图形（如 roundRect/circle），提供每单位代表值的设置 | 完成 |
| 8 | 进度条形图 | `progressBar` | bar（`showBackground: true`） | 分类 + 1 数值列（0–100 或占最大值百分比），按值排序 | 完成 |
| 9 | 排名条形图 | `rankingBar` | bar + 名次标签 | 分类 + 1 数值列；按值降序、条端标 `1.` `2.` 名次；这是 Bar chart race 的静态终帧形态 | 完成 |
| 10 | 帕累托图 | `pareto` | combo：降序柱 + 累计百分比线（双轴） | 分类 + 1 数值列；右轴 0–100% | 完成 |

（P2-可延后：`densityHistogram`、`pictorialColumn`）

### 批次 2 · 折线/面积扩展（line-area.ts）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 11 | 点线图 | `pointLine` | line，symbol 大、线细 | 分类 + 多数值列 | 完成 |
| 12 | 平滑面积图 | `smoothArea` | line smooth + areaStyle | 分类 + 多数值列 | 完成 |
| 13 | 阶梯面积图 | `stepArea` | line step + areaStyle | 同上 | 完成 |
| 14 | 双轴折线图 | `dualAxisLine` | line×2 组，双 y 轴 | 分类 + ≥2 数值列（第 1 列左轴，其余右轴） | 完成 |
| 15 | 斜率图 | `slopeChart` | line，x 轴仅 2 个类目 | 分类列=系列名；恰好 2 数值列（两个时期） | 完成 |
| 16 | 区间面积图 | `bandArea` | 透明底线 + 面积 + 中值线 | 3 数值列：下限、上限、中值 | 完成 |
| 17 | 脊线图 | `ridgeline` | 多个 area 系列按行错位基线 | 分类（行/时期）+ 多数值列（每列一条脊） | 完成 |
| 18 | 凹凸图 | `bump` | line，renderer 内把值换成名次 | 分类（时期）+ 多数值列（每列一个主体，按列重算名次 1..n） | 完成 |

### 批次 3 · 径向/极坐标家族（新 radial.ts，family: "pie"，axes: false）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 19 | 玫瑰图 | `rose` | pie，`roseType: "radius"` | 分类 + 1 数值列 | 完成 |
| 20 | 面积玫瑰图 | `roseArea` | pie，`roseType: "area"` | 同上 | 完成 |
| 21 | 径向条形图 | `radialBar` | polar + 角度类目轴 + 径向数值轴 + bar | 分类 + 1 数值列 | 完成 |
| 22 | 径向堆叠条形图 | `radialStackedBar` | 同上 + stack | 分类 + 多数值列 | 完成 |
| 23 | 进度环形图 | `progressRing` | pie：背景环（满值灰色）+ 前景环 | 1 行 1 数值列（或首行），显示百分比标签 | 完成 |
| 24 | 极坐标折线图 | `polarLine` | polar + line | 分类 + 多数值列（类目在角度轴） | 完成 |
| 25 | 极坐标面积图 | `polarArea` | polar + line + areaStyle | 同上 | 完成 |

### 批次 4 · 散点/气泡扩展（scatter.ts）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 26 | 气泡图 | `bubble` | scatter + sizeColumn 默认绑定 | x、y、size 3 数值列 | 完成 |
| 27 | 分组散点图 | `groupedScatter` | scatter，按 colorColumn 拆成多系列 | x、y + 分类列（颜色） | 完成 |
| 28 | 象限图 | `quadrant` | scatter + markArea 四象限底色 + 中线 | x、y 2 数值列；中值（均值/中位数/手动）可配 | 完成 |
| 29 | 回归散点图 | `trendScatter` | scatter + 最小二乘趋势线（默认开启） | x、y 2 数值列（复用 `scatterTrendLine`） | 完成 |
| 30 | 蜂群图 | `beeswarm` | scatter，确定性一维抖动（排序 + 圆堆积） | 分类 + 1 数值列 | 完成 |

### 批次 5 · 层级与网络（新 hierarchy.ts / network.ts，family: "other"）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 31 | 旭日图 | `sunburst` | sunburst（两层：分类为父、数值列为子） | 分类 + 多数值列 | 完成 |
| 32 | 树状图 | `dendrogram` | tree，orient LR | 同旭日图的两层数据 | 完成 |
| 33 | 径向树图 | `radialTree` | tree，layout radial | 同上 | 完成 |
| 34 | 组织架构图 | `orgChart` | tree，orient TB | 同上 | 完成 |
| 35 | 力导向网络图 | `networkGraph` | graph，layout force | 复用桑基绑定：来源、去向、数值 | 完成 |
| 36 | 弦图 | `chord` | echarts 6.1 内置 chord 系列（若类型暴露不便则用 graph circular + 曲线边实现） | 同上 | 完成 |
| 37 | 邻接矩阵图 | `adjacencyMatrix` | heatmap（来源×去向方阵） | 同上 | 完成 |
| 38 | 冲积图 | `alluvial` | 复用 sankey 渲染器 | 同桑基；示例数据改为多阶段（A→B→C） | 完成 |

### 批次 6 · 统计与分布（advanced.ts）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 39 | 平行坐标图 | `parallelCoordinates` | parallel + parallelAxis | 多数值列（每列一维），分类列作高亮过滤可选 | 待做 |
| 40 | 日历热力图 | `calendarHeatmap` | calendar 坐标 + heatmap | 日期列（可解析为日期的文本）+ 1 数值列 | 待做 |
| 41 | 累计分布图 | `ecdf` | line（排序后累计百分比） | 1 数值列 | 待做 |
| 42 | 误差线图 | `errorBar` | bar + custom renderItem 误差须 | 分类 + 3 数值列（值、下误差、上误差） | 待做 |
| 43 | 相关性矩阵图 | `correlationMatrix` | heatmap，renderer 内计算数值列两两 Pearson 相关系数 | ≥2 数值列 | 待做 |
| 44 | 小提琴图 | `violin` | custom（KDE 密度镜像） | 分类 + 1 数值列（或每列一个提琴） | 待做（P2） |
| 45 | 马赛克图 | `marimekko` | custom（变宽堆叠条） | 分类 + 多数值列 | 待做（P2） |

### 批次 7 · 条柱线补充变体（bar.ts / scatter.ts / combo.ts）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 46 | 分组条形图 | `groupedBar` | bar 横向分组 | 分类 + 多数值列 | 待做 |
| 47 | 胶囊条形图 | `capsuleBar` | bar，全圆角（高度/2 圆角） | 分类 + 1 数值列 | 待做 |
| 48 | 箭头条形图 | `arrowBar` | pictorialBar（三角箭头）+ bar | 分类 + 1 数值列 | 待做 |
| 49 | 哑铃图 | `dumbbell` | scatter + line（两点连线） | 分类 + 2 数值列（起点、终点） | 待做 |
| 50 | 堆叠点图 | `stackedDot` | scatter，按值堆叠圆点（每点=1 单位） | 分类 + 1 数值列（整数计数语义） | 待做 |
| 51 | OHLC 条形图 | `ohlcBar` | custom renderItem（传统开高低收细棒） | 4 数值列（开、收、低、高） | 待做 |
| 52 | 蜡烛+成交量组合图 | `candleVolume` | candlestick + bar，双 grid/双轴 | 5 数值列（开、收、低、高、量） | 待做 |
| 53 | 断轴条形图 | `splitAxisBar` | 双 grid 拼接 + 轴断裂标记 | 分类 + 1 数值列（个别离群值很大） | 待做（P2） |

### 批次 8 · 环饼与箱线补充（pie.ts / advanced.ts / heatmap）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 54 | 半环形图 | `halfDonut` | pie，startAngle/endAngle 半圆 | 分类 + 1 数值列 | 待做 |
| 55 | 多层环形图 | `multiRing` | 多个 pie 同心不同半径 | 分类 + 多数值列（每列一环） | 待做 |
| 56 | 水平箱线图 | `boxplotHorizontal` | boxplot 转置 | 复用现有箱线图绑定 | 待做 |
| 57 | 密度热力散点图 | `densityHeatmap` | heatmap（2D 分箱）替代海量散点 | x、y 2 数值列 | 待做 |

### 批次 9 · 卡片、表格与文字（新 cards.ts / table.ts，family: "other"）

| # | 中文名 | id | 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 58 | 大数字卡 | `kpiCard` | ECharts `graphic` 文本图层（居中大号数字 + 小标题） | 1 行：标签列 + 1 数值列 | 待做 |
| 59 | 指标卡组 | `kpiCardRow` | graphic 多卡横排 | 标签列 + 多数值列（每列一卡） | 待做 |
| 60 | 趋势迷你卡 | `sparklineCard` | graphic 数字 + 小号 line 系列 | 标签列 + 当前值列 + 若干趋势列 | 待做 |
| 61 | 条形表格图 | `barTable` | 每行 = 类别名 + 迷你条 + 数值文本（graphic + bar 组合） | 分类 + 1 数值列 | 待做 |
| 62 | 词云 | `wordCloud` | 评估 `echarts-wordcloud` 依赖；若不可接受则标暂缓 | 文本列 + 权重数值列 | 待做（P2，依赖决策） |

### 批次 10 · 时间与分面（custom / 多 grid）

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 63 | 甘特图 | `gantt` | range bar（起、止 2 数值/日期列），行=任务 | 任务列 + 开始列 + 结束列（+可选阶段分组列） | 待做 |
| 64 | 时间线图 | `timeline` | 水平轴线 + scatter 事件点 + graphic 标签 | 事件列 + 日期/顺序列 | 待做 |
| 65 | 小倍数分面图 | `smallMultiples` | 单 option 多 grid，每数值列一个小图（支持柱/线两种子形态） | 分类 + 多数值列 | 待做 |

### 批次 11 · 地图家族（新 map.ts + GeoJSON 基础设施，family: "other"）

**先做基础设施决策再动手**：把世界与中国省级 GeoJSON（来源建议 [DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)，或 echarts 官方地图仓库）下载到 `public/geo/`，页面启动时按需 fetch + `echarts.registerMap`，桌面版同样可用。若单文件 >2MB 需先压缩（简化多边形）。决策记录写进批次备注。

| # | 中文名 | id | ECharts 方案 | 数据绑定要点 | 状态 |
|---|---|---|---|---|---|
| 66 | 世界分级统计地图 | `worldChoropleth` | map 系列 + visualMap | 地名列（世界国名，中/英文映射表）+ 1 数值列 | 待做 |
| 67 | 中国分级统计地图 | `chinaChoropleth` | map（中国省级） | 省名列 + 1 数值列 | 待做 |
| 68 | 符号地图 | `symbolMap` | geo 底图 + scatter/effectScatter（大小随值） | 地名列 + 1 数值列（内置地名→经纬度质心表） | 待做 |
| 69 | 地点热力地图 | `geoHeatmap` | geo 底图 + heatmap | 同上（质心 + 权重） | 待做 |
| 70 | 流向地图 | `flowMap` | geo 底图 + lines 系列（地名对 → 质心弧线） | 来源列 + 去向列 + 1 数值列 | 待做 |

### 已有 30 个模板（对照锚点，状态：已有）

`line` 折线图、`smoothLine` 平滑折线图、`stepLine` 阶梯折线图、`area` 面积图、`stackedArea` 堆叠面积图、`proportionalArea` 百分比面积图、`bar` 条形图、`stackedBar` 堆叠条形图、`proportionalBar` 百分比条形图、`column` 柱状图、`groupedColumn` 分组柱状图、`stackedColumn` 堆叠柱状图、`proportionalColumn` 百分比柱状图、`combo` 柱线组合图、`donut` 环形图、`pie` 饼图、`scatter` 散点图、`divergingBar` 发散条形图、`populationPyramid` 人口金字塔、`streamgraph` 河流图、`dotPlot` 点图、`waterfall` 瀑布图、`heatmap` 热力图、`treemap` 矩形树图、`funnel` 漏斗图、`gauge` 仪表盘、`radar` 雷达图、`boxplot` 箱线图、`candlestick` 蜡烛图、`sankey` 桑基图。

## 8. 候补清单（用于顶替受阻项，保持总数 100）

1. 半圆仪表盘（`gauge` 变体，startAngle 180–360）
2. 百分比玫瑰图（`rose` + 堆叠归一化）
3. 饼图小倍数（批次 10 小倍数引擎落地后的饼图分面）
4. 点阵图（waffle/dot matrix，10×10 百分点方阵）
5. 阶梯对比条形（发散 + 阶梯混合形态）

## 9. 与 Flourish 的覆盖关系说明

- Flourish 模板目录中**图表类**能力（条柱线饼、堆叠/分组/百分比、散点气泡、斜率、凹凸、桑基/冲积、层级 treemap/旭日/树、网络、词云、表格条形、KPI 卡、地图族、竞赛条形的静态形态）→ 本清单全部覆盖。
- Flourish 的**动画竞赛类**（bar chart race / line chart race）→ 以静态终帧形态覆盖（`rankingBar`、`bump`），符合图作"生成图片"的定位。
- Flourish 的**故事/交互类**（story、carousel、quiz、survey 动画、photo grid、sports、music）→ 明确不做，与定位不符。
- ECharts 6.1 无 `venn` / `circlePacking`，原候选维恩图、圆填充图未入清单，由密度直方图、弦图等顶替。

## 10. 完成定义（整个计划）

- 第 7 节清单 100 项全部 `完成`（或经用户确认的少量 `暂缓` + 候补顶替）；
- `npm test`、`npm run lint` 全绿；
- README 模板表与实际 `CHART_TEMPLATES.length` 一致（编辑器页脚显示该数量）；
- 每批次一个提交，提交历史可回溯每个模板的引入。
