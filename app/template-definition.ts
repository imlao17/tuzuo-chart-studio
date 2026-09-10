/**
 * Template definition layer.
 *
 * Each chart template declares its data bindings, validators, settings
 * groups, capabilities, and its renderer. Every template is migrated to a
 * per-family renderer; the legacy buildChartOption fallback has been removed.
 *
 * The type surface here is the contract the rest of the P0 roadmap builds on:
 *   - Task 3 fills in dataBindings for real field-role binding UI.
 *   - Task 4 drives the right-hand settings panel from settingsGroups.
 *   - Task 5 surfaces validators as empty-state errors.
 *   - Task 6 fixes the per-template "silent ignore" issues.
 */
import type { ChartConfig, ChartFamily, ChartType } from "./chart-model";
import {
  buildBoxplotHorizontalOption,
  buildSmallMultiplesOption,
  buildTimelineOption,
  buildBoxplotOption,
  buildCalendarHeatmapOption,
  buildDensityHeatmapOption,
  buildHalfDonutOption,
  buildCandlestickOption,
  buildCorrelationMatrixOption,
  buildDotPlotOption,
  buildEcdfOption,
  buildErrorBarOption,
  buildFunnelOption,
  buildGaugeOption,
  buildHeatmapOption,
  buildCandleVolumeOption,
  buildMarimekkoOption,
  buildMultiRingOption,
  buildOhlcBarOption,
  buildParallelOption,
  buildRadarOption,
  buildSankeyOption,
  buildTreemapOption,
  buildViolinOption,
  buildWaterfallOption,
} from "./renderers/advanced";
import {
  buildArrowOption,
  buildBarOption,
  buildBulletOption,
  buildCapsuleOption,
  buildDumbbellOption,
  buildGanttOption,
  buildDensityHistogramOption,
  buildHistogramOption,
  buildLollipopOption,
  buildPictorialOption,
  buildProgressOption,
  buildRangeOption,
  buildRankingOption,
  buildSplitAxisOption,
  buildStackedDotOption,
} from "./renderers/bar";
import {
  buildDendrogramOption,
  buildOrgChartOption,
  buildRadialTreeOption,
  buildSunburstOption,
} from "./renderers/hierarchy";
import {
  buildAdjacencyMatrixOption,
  buildAlluvialOption,
  buildChordOption,
  buildNetworkGraphOption,
} from "./renderers/network";
import {
  buildBarTableOption,
  buildKpiCardOption,
  buildKpiCardRowOption,
  buildSparklineCardOption,
  buildWordCloudOption,
} from "./renderers/cards";
import {
  buildChinaChoroplethOption,
  buildFlowMapOption,
  buildGeoHeatmapOption,
  buildSymbolMapOption,
  buildWorldChoroplethOption,
  hasKnownGeoNames,
} from "./renderers/map";
import { buildComboOption, buildParetoOption } from "./renderers/combo";
import { buildDivergingOption } from "./renderers/diverging";
import {
  buildBandAreaOption,
  buildBumpOption,
  buildDualAxisLineOption,
  buildLineAreaOption,
  buildRidgelineOption,
  buildSlopeOption,
} from "./renderers/line-area";
import { buildPieOption } from "./renderers/pie";
import {
  buildPolarLineOption,
  buildProgressRingOption,
  buildRadialBarOption,
  buildRoseOption,
} from "./renderers/radial";
import {
  buildBeeswarmOption,
  buildBubbleOption,
  buildGroupedScatterOption,
  buildQuadrantOption,
  buildScatterOption,
  buildTrendScatterOption,
} from "./renderers/scatter";
import { buildStreamgraphOption } from "./renderers/streamgraph";
import { buildWithRenderer, type RendererResult } from "./renderers/shared";
import {
  SETTINGS_SECTION_META,
  type SettingsSectionId,
} from "../src/studio/settings/registry";

export type DataBindingRole =
  | "category"
  | "value"
  | "x"
  | "y"
  | "size"
  | "color"
  | "shape"
  | "leftValue"
  | "rightValue"
  | "source"
  | "target";

export type DataBinding = {
  role: DataBindingRole;
  /** 中文显示名 */
  label: string;
  required: boolean;
  /** true=可多列（如数值系列），false=单列 */
  multiple: boolean;
  /** 数据要求提示，如「至少 1 个数值列」 */
  hint?: string;
};

export type ValidationContext = {
  parsed: ChartConfig["parsed"];
  categoryColumn: string;
  seriesColumns: string[];
  sourceColumn?: string;
  targetColumn?: string;
};

export type DataValidator = {
  /** 返回可读错误信息，null 表示通过。任务 5 启用。 */
  validate(ctx: ValidationContext): string | null;
};

export type SettingsGroupId = Exclude<SettingsSectionId, "data">;

export type SettingsGroup = {
  id: SettingsGroupId;
  /** 与 page.tsx 中 SettingsSection 的显示名保持一致 */
  title: string;
  /** 沿用现有 settingsSectionVisible 的搜索关键词 */
  keywords: string;
};

export type Capabilities = {
  /** false 时隐藏坐标轴相关组（饼/环=false） */
  axes: boolean;
  legend: boolean;
  tooltip: boolean;
  labels: boolean;
  animation: boolean;
  /** 所有当前模板均支持 SVG 导出 */
  svgExport: boolean;
};

export type RenderContext = {
  config: ChartConfig;
  categories: string[];
  dataSeries: { name: string; data: number[] }[];
  proportional: boolean;
  formatNumber: (value: number | string) => string;
};

export type SampleData = {
  /** 含表头的二维数组（同 tableData 形状） */
  table: string[][];
  /** 该示例数据的分类列名 */
  categoryColumn: string;
  /** 该示例数据的数值系列列名（按渲染顺序） */
  seriesColumns: string[];
  /** 特殊角色默认列名，例如桑基图的来源 / 去向。 */
  roleDefaults?: Partial<Record<DataBindingRole, string | string[]>>;
};

export type TemplateDefinition = {
  id: ChartType;
  family: ChartFamily;
  dataBindings: DataBinding[];
  validators: DataValidator[];
  settingsGroups: SettingsGroup[];
  capabilities: Capabilities;
  /** 模板专属示例数据，用于模板库缩略图与「加载示例」入口 */
  sampleData: SampleData;
  buildOption?: (ctx: RenderContext) => RendererResult;
  /** Map-family templates: the GeoJSON registered before first render. */
  geoMap?: "world" | "china";
  /**
   * Semantic data check beyond shape validators: when the current table
   * passes the validators but cannot produce meaningful marks (e.g. a map
   * template whose place names resolve to nothing), the template switch
   * auto-loads the sample data instead of rendering a near-empty chart.
   */
  canUseData?: (ctx: ValidationContext) => boolean;
};

// --- Shared settings-group declarations -------------------------------------
// These titles/keywords mirror the existing hand-written sections in page.tsx
// so that task 4 can switch the panel to be schema-driven without changing
// user-visible labels.

const GROUP_COLORS: SettingsGroup = SETTINGS_SECTION_META.colors;
const GROUP_MARKS: SettingsGroup = SETTINGS_SECTION_META.marks;
const GROUP_LABELS: SettingsGroup = SETTINGS_SECTION_META.labels;
const GROUP_X_AXIS: SettingsGroup = SETTINGS_SECTION_META.xAxis;
const GROUP_Y_AXIS: SettingsGroup = SETTINGS_SECTION_META.yAxis;
const GROUP_LEGEND: SettingsGroup = SETTINGS_SECTION_META.legend;
const GROUP_NUMBERS: SettingsGroup = SETTINGS_SECTION_META.numbers;
const ANNOTATIONS_GROUP: SettingsGroup = SETTINGS_SECTION_META.annotations;

const CARTESIAN_GROUPS: SettingsGroup[] = [
  ANNOTATIONS_GROUP,
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_X_AXIS,
  GROUP_Y_AXIS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const CARTESIAN_GROUPS_NO_LEGEND: SettingsGroup[] = [
  ANNOTATIONS_GROUP,
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_X_AXIS,
  GROUP_Y_AXIS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const CARTESIAN_BASIC_GROUPS_NO_LEGEND: SettingsGroup[] = [
  ANNOTATIONS_GROUP,
  GROUP_COLORS,
  GROUP_LABELS,
  GROUP_X_AXIS,
  GROUP_Y_AXIS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const PIE_GROUPS: SettingsGroup[] = [
  ANNOTATIONS_GROUP,
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const NON_CARTESIAN_GROUPS_NO_LEGEND: SettingsGroup[] = [
  ANNOTATIONS_GROUP,
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND: SettingsGroup[] = [
  ANNOTATIONS_GROUP,
  GROUP_COLORS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const RADAR_GROUPS: SettingsGroup[] = [
  ANNOTATIONS_GROUP,
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

// --- Shared capability presets ---------------------------------------------

const CAP_CARTESIAN: Capabilities = {
  axes: true,
  legend: true,
  tooltip: true,
  labels: true,
  animation: true,
  svgExport: true,
};

const CAP_PIE: Capabilities = {
  axes: false,
  legend: true,
  tooltip: true,
  labels: true,
  animation: true,
  svgExport: true,
};

const CAP_CARTESIAN_NO_LEGEND: Capabilities = {
  ...CAP_CARTESIAN,
  legend: false,
};

const CAP_NON_CARTESIAN: Capabilities = {
  axes: false,
  legend: true,
  tooltip: true,
  labels: true,
  animation: true,
  svgExport: true,
};

const CAP_NON_CARTESIAN_NO_LEGEND: Capabilities = {
  ...CAP_NON_CARTESIAN,
  legend: false,
};

// Graphic-driven templates (cards/wordcloud): no axes, legend, tooltip, or
// data labels — only 配色 and 数字格式 apply.
const CAP_GRAPHIC: Capabilities = {
  axes: false,
  legend: false,
  tooltip: false,
  labels: false,
  animation: true,
  svgExport: true,
};

const GRAPHIC_GROUPS: SettingsGroup[] = [GROUP_COLORS, GROUP_NUMBERS, ANNOTATIONS_GROUP];

// --- Shared data-binding presets (task 3 will specialize these per template) -

const BIND_CATEGORY_SINGLE: DataBinding = {
  role: "category",
  label: "分类字段",
  required: true,
  multiple: false,
};

const BIND_VALUE_SINGLE: DataBinding = {
  role: "value",
  label: "数值字段",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

// Batch-1 presets: templates that consume exactly two ordered numeric columns
// (range bars, bullets) but don't fit the left/right diverging vocabulary.
const BIND_VALUE_LOWER: DataBinding = {
  role: "value",
  label: "下限数值",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_UPPER: DataBinding = {
  role: "value",
  label: "上限数值",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_ACTUAL: DataBinding = {
  role: "value",
  label: "实际值",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_TARGET: DataBinding = {
  role: "value",
  label: "目标值",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_START: DataBinding = {
  role: "value",
  label: "起点数值",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_END: DataBinding = {
  role: "value",
  label: "终点数值",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_VOLUME: DataBinding = {
  role: "value",
  label: "成交量",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_MID: DataBinding = {
  role: "value",
  label: "中值",
  required: true,
  multiple: false,
  hint: "额外数值列将被忽略",
};

const BIND_VALUE_MULTIPLE: DataBinding = {
  role: "value",
  label: "数值系列",
  required: true,
  multiple: true,
  hint: "至少 1 个数值列",
};

const BIND_DISTRIBUTION_MULTIPLE: DataBinding = {
  role: "value",
  label: "分布字段",
  required: true,
  multiple: true,
  hint: "每个数值列生成一个箱线",
};

const BIND_OHLC_MULTIPLE: DataBinding = {
  role: "value",
  label: "OHLC 字段",
  required: true,
  multiple: true,
  hint: "按开盘、收盘、最低、最高选择 4 列",
};

// Specialized bindings for role-driven templates (task 3 will surface these
// in the UI; today they are metadata only and rendering still reads
// ctx.dataSeries / ctx.config.seriesColumns).

const BIND_X: DataBinding = {
  role: "x",
  label: "X 轴（数值）",
  required: true,
  multiple: false,
};

const BIND_Y: DataBinding = {
  role: "y",
  label: "Y 轴（数值）",
  required: true,
  multiple: false,
};

const BIND_LEFT_VALUE: DataBinding = {
  role: "leftValue",
  label: "左侧数值",
  required: true,
  multiple: false,
};

const BIND_RIGHT_VALUE: DataBinding = {
  role: "rightValue",
  label: "右侧数值",
  required: true,
  multiple: false,
};

const BIND_SOURCE: DataBinding = {
  role: "source",
  label: "来源字段",
  required: true,
  multiple: false,
};

const BIND_TARGET: DataBinding = {
  role: "target",
  label: "去向字段",
  required: true,
  multiple: false,
};

// Scatter optional roles. All not required; undefined = single global style.
const BIND_SIZE: DataBinding = {
  role: "size",
  label: "点大小（数值，可选）",
  required: false,
  multiple: false,
  hint: "留空使用统一点大小",
};

const BIND_COLOR: DataBinding = {
  role: "color",
  label: "点颜色（分类，可选）",
  required: false,
  multiple: false,
  hint: "留空使用统一颜色",
};

const BIND_SHAPE: DataBinding = {
  role: "shape",
  label: "点形状（分类，可选）",
  required: false,
  multiple: false,
  hint: "留空使用统一形状",
};

// --- Per-template sample data ----------------------------------------------
// Semantically appropriate demo data for each template family. Used by the
// template-gallery thumbnails (so each preview shows a meaningful shape) and
// by the "加载示例" action in the data-field panel. Tables include the header
// row, matching the tableData shape.

const SAMPLE_MONTHLY: SampleData = {
  table: [
    ["月份", "实际收入", "目标", "成本"],
    ["一月", "128", "110", "80"],
    ["二月", "146", "125", "90"],
    ["三月", "138", "140", "85"],
    ["四月", "172", "150", "100"],
    ["五月", "189", "165", "110"],
    ["六月", "218", "190", "125"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["实际收入", "目标", "成本"],
};

const SAMPLE_QUARTERLY: SampleData = {
  table: [
    ["季度", "产品 A", "产品 B", "产品 C"],
    ["Q1", "320", "240", "180"],
    ["Q2", "380", "290", "210"],
    ["Q3", "420", "310", "245"],
    ["Q4", "510", "365", "290"],
  ],
  categoryColumn: "季度",
  seriesColumns: ["产品 A", "产品 B", "产品 C"],
};

const SAMPLE_SHARE: SampleData = {
  table: [
    ["渠道", "占比"],
    ["线上", "42"],
    ["门店", "31"],
    ["分销", "18"],
    ["其他", "9"],
  ],
  categoryColumn: "渠道",
  seriesColumns: ["占比"],
};

// Scatter needs two numeric columns (X / Y). The category column labels points.
const SAMPLE_SCATTER: SampleData = {
  table: [
    ["姓名", "身高 cm", "体重 kg"],
    ["A", "160", "55"],
    ["B", "168", "61"],
    ["C", "172", "66"],
    ["D", "175", "70"],
    ["E", "180", "74"],
    ["F", "158", "52"],
    ["G", "185", "82"],
    ["H", "165", "58"],
  ],
  categoryColumn: "姓名",
  seriesColumns: ["身高 cm", "体重 kg"],
};

// Diverging needs two numeric columns (left / right) on opposite sides.
const SAMPLE_DIVERGING: SampleData = {
  table: [
    ["议题", "支持", "反对"],
    ["政策一", "62", "28"],
    ["政策二", "48", "44"],
    ["政策三", "35", "55"],
    ["政策四", "71", "19"],
    ["政策五", "44", "46"],
  ],
  categoryColumn: "议题",
  seriesColumns: ["支持", "反对"],
};

// Population pyramid: left = male, right = female, by age band.
const SAMPLE_PYRAMID: SampleData = {
  table: [
    ["年龄段", "男性 万", "女性 万"],
    ["0-9", "380", "350"],
    ["10-19", "420", "395"],
    ["20-29", "510", "485"],
    ["30-39", "480", "470"],
    ["40-49", "445", "440"],
    ["50-59", "390", "400"],
    ["60-69", "310", "335"],
    ["70+", "205", "245"],
  ],
  categoryColumn: "年龄段",
  seriesColumns: ["男性 万", "女性 万"],
};

const SAMPLE_WATERFALL: SampleData = {
  table: [
    ["项目", "变化"],
    ["期初余额", "120"],
    ["新增收入", "48"],
    ["服务成本", "-31"],
    ["市场投入", "-18"],
    ["续费收入", "42"],
    ["期末调整", "-9"],
  ],
  categoryColumn: "项目",
  seriesColumns: ["变化"],
};

const SAMPLE_HEATMAP: SampleData = {
  table: [
    ["时段", "周一", "周二", "周三", "周四", "周五"],
    ["早间", "32", "41", "36", "45", "52"],
    ["午间", "58", "63", "61", "68", "72"],
    ["下午", "44", "49", "55", "59", "64"],
    ["晚间", "27", "34", "39", "42", "47"],
  ],
  categoryColumn: "时段",
  seriesColumns: ["周一", "周二", "周三", "周四", "周五"],
};

const SAMPLE_RADAR: SampleData = {
  table: [
    ["维度", "品牌 A", "品牌 B", "品牌 C"],
    ["性能", "88", "74", "68"],
    ["价格", "62", "82", "71"],
    ["设计", "79", "69", "91"],
    ["服务", "85", "73", "77"],
    ["口碑", "72", "80", "83"],
  ],
  categoryColumn: "维度",
  seriesColumns: ["品牌 A", "品牌 B", "品牌 C"],
};

const SAMPLE_DISTRIBUTION: SampleData = {
  table: [
    ["样本", "产品 A", "产品 B", "产品 C"],
    ["1", "42", "36", "48"],
    ["2", "45", "39", "51"],
    ["3", "47", "41", "57"],
    ["4", "49", "44", "60"],
    ["5", "53", "46", "63"],
    ["6", "57", "52", "68"],
    ["7", "60", "56", "74"],
  ],
  categoryColumn: "样本",
  seriesColumns: ["产品 A", "产品 B", "产品 C"],
};

const SAMPLE_CANDLESTICK: SampleData = {
  table: [
    ["日期", "开盘", "收盘", "最低", "最高"],
    ["7/01", "102", "108", "99", "112"],
    ["7/02", "108", "105", "101", "111"],
    ["7/03", "105", "113", "104", "116"],
    ["7/04", "113", "110", "107", "117"],
    ["7/05", "110", "118", "109", "121"],
    ["7/06", "118", "122", "115", "126"],
  ],
  categoryColumn: "日期",
  seriesColumns: ["开盘", "收盘", "最低", "最高"],
};

const SAMPLE_FUNNEL: SampleData = {
  table: [
    ["阶段", "人数"],
    ["访问", "4800"],
    ["注册", "2100"],
    ["试用", "960"],
    ["付费", "420"],
    ["续费", "260"],
  ],
  categoryColumn: "阶段",
  seriesColumns: ["人数"],
};

const SAMPLE_GAUGE: SampleData = {
  table: [
    ["指标", "完成率"],
    ["本月目标", "76"],
  ],
  categoryColumn: "指标",
  seriesColumns: ["完成率"],
};

const SAMPLE_FLOW: SampleData = {
  table: [
    ["来源", "去向", "流量"],
    ["官网", "注册", "340"],
    ["广告", "注册", "280"],
    ["社媒", "注册", "180"],
    ["注册", "试用", "520"],
    ["试用", "付费", "210"],
    ["注册", "流失", "280"],
  ],
  categoryColumn: "来源",
  seriesColumns: ["流量"],
  roleDefaults: {
    source: "来源",
    target: "去向",
    value: "流量",
  },
};

// --- Batch-1 (Flourish parity) sample data ---------------------------------
// Each dataset is shaped so the template's signature form is visible in the
// gallery thumbnail (bell-shaped scores for histograms, decreasing defect
// counts for the Pareto, ≤100 rates for progress bars, ...).

const SAMPLE_SCORES: SampleData = {
  table: [
    ["学生", "成绩"],
    ["学生 A", "42"],
    ["学生 B", "55"],
    ["学生 C", "58"],
    ["学生 D", "61"],
    ["学生 E", "65"],
    ["学生 F", "66"],
    ["学生 G", "68"],
    ["学生 H", "70"],
    ["学生 I", "71"],
    ["学生 J", "73"],
    ["学生 K", "75"],
    ["学生 L", "76"],
    ["学生 M", "78"],
    ["学生 N", "80"],
    ["学生 O", "83"],
    ["学生 P", "88"],
    ["学生 Q", "94"],
  ],
  categoryColumn: "学生",
  seriesColumns: ["成绩"],
};

const SAMPLE_HEIGHTS: SampleData = {
  table: [
    ["人员", "身高 cm"],
    ["人员 A", "152"],
    ["人员 B", "158"],
    ["人员 C", "161"],
    ["人员 D", "164"],
    ["人员 E", "166"],
    ["人员 F", "168"],
    ["人员 G", "169"],
    ["人员 H", "170"],
    ["人员 I", "171"],
    ["人员 J", "172"],
    ["人员 K", "174"],
    ["人员 L", "176"],
    ["人员 M", "179"],
    ["人员 N", "183"],
    ["人员 O", "188"],
  ],
  categoryColumn: "人员",
  seriesColumns: ["身高 cm"],
};

const SAMPLE_RANGE_TASK: SampleData = {
  table: [
    ["任务", "开始(天)", "结束(天)"],
    ["需求确认", "0", "3"],
    ["方案设计", "2", "6"],
    ["开发", "5", "12"],
    ["联调", "10", "14"],
    ["验收", "13", "16"],
  ],
  categoryColumn: "任务",
  seriesColumns: ["开始(天)", "结束(天)"],
};

const SAMPLE_RANGE_PRICE: SampleData = {
  table: [
    ["月份", "最低价", "最高价"],
    ["一月", "102", "118"],
    ["二月", "108", "121"],
    ["三月", "99", "112"],
    ["四月", "110", "126"],
    ["五月", "115", "131"],
    ["六月", "121", "138"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["最低价", "最高价"],
};

const SAMPLE_BULLET: SampleData = {
  table: [
    ["部门", "实际完成", "目标"],
    ["华东", "86", "100"],
    ["华南", "74", "90"],
    ["华北", "92", "85"],
    ["西南", "61", "80"],
    ["东北", "55", "70"],
  ],
  categoryColumn: "部门",
  seriesColumns: ["实际完成", "目标"],
};

const SAMPLE_LOLLIPOP: SampleData = {
  table: [
    ["页面", "耗时 ms"],
    ["首页", "420"],
    ["列表页", "680"],
    ["详情页", "540"],
    ["购物车", "310"],
    ["结算页", "760"],
    ["个人中心", "260"],
  ],
  categoryColumn: "页面",
  seriesColumns: ["耗时 ms"],
};

const SAMPLE_PICTORIAL: SampleData = {
  table: [
    ["候选人", "得票(万)"],
    ["候选人 A", "52"],
    ["候选人 B", "38"],
    ["候选人 C", "27"],
    ["候选人 D", "12"],
  ],
  categoryColumn: "候选人",
  seriesColumns: ["得票(万)"],
};

const SAMPLE_PROGRESS: SampleData = {
  table: [
    ["地区", "达成率 %"],
    ["华东", "92"],
    ["华南", "78"],
    ["华北", "85"],
    ["西南", "64"],
    ["东北", "71"],
    ["西北", "58"],
  ],
  categoryColumn: "地区",
  seriesColumns: ["达成率 %"],
};

const SAMPLE_RANKING: SampleData = {
  table: [
    ["销售员", "销售额 万"],
    ["周洁", "168"],
    ["李成", "142"],
    ["王一", "205"],
    ["刘敏", "97"],
    ["张弛", "130"],
  ],
  categoryColumn: "销售员",
  seriesColumns: ["销售额 万"],
};

const SAMPLE_PARETO: SampleData = {
  table: [
    ["原因", "数量"],
    ["物流延迟", "62"],
    ["尺寸不符", "38"],
    ["色差", "21"],
    ["破损", "12"],
    ["其他", "6"],
  ],
  categoryColumn: "原因",
  seriesColumns: ["数量"],
};

// --- Batch-2 (Flourish parity) sample data ---------------------------------

const SAMPLE_DUAL_AXIS: SampleData = {
  table: [
    ["月份", "销售额 万", "转化率 %"],
    ["一月", "128", "3.2"],
    ["二月", "146", "3.8"],
    ["三月", "138", "3.5"],
    ["四月", "172", "4.1"],
    ["五月", "189", "4.6"],
    ["六月", "218", "5.2"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["销售额 万", "转化率 %"],
};

const SAMPLE_SLOPE: SampleData = {
  table: [
    ["品牌", "2023", "2024"],
    ["品牌 A", "42", "58"],
    ["品牌 B", "35", "31"],
    ["品牌 C", "28", "44"],
    ["品牌 D", "22", "12"],
    ["品牌 E", "18", "26"],
  ],
  categoryColumn: "品牌",
  seriesColumns: ["2023", "2024"],
};

const SAMPLE_BAND: SampleData = {
  table: [
    ["日期", "最低温", "平均温", "最高温"],
    ["周一", "18", "23", "29"],
    ["周二", "17", "22", "27"],
    ["周三", "19", "25", "31"],
    ["周四", "21", "27", "33"],
    ["周五", "20", "26", "32"],
    ["周六", "22", "28", "35"],
    ["周日", "21", "27", "34"],
  ],
  categoryColumn: "日期",
  seriesColumns: ["最低温", "最高温", "平均温"],
};

const SAMPLE_RIDGE: SampleData = {
  table: [
    ["月份", "产品 A", "产品 B", "产品 C", "产品 D"],
    ["一月", "18", "9", "14", "5"],
    ["二月", "34", "20", "26", "11"],
    ["三月", "52", "38", "31", "18"],
    ["四月", "41", "55", "22", "26"],
    ["五月", "25", "42", "35", "38"],
    ["六月", "12", "24", "48", "30"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["产品 A", "产品 B", "产品 C", "产品 D"],
};

const SAMPLE_BUMP: SampleData = {
  table: [
    ["年份", "品牌 A", "品牌 B", "品牌 C"],
    ["2020", "86", "72", "64"],
    ["2021", "78", "80", "61"],
    ["2022", "70", "75", "82"],
    ["2023", "88", "66", "74"],
    ["2024", "92", "70", "69"],
  ],
  categoryColumn: "年份",
  seriesColumns: ["品牌 A", "品牌 B", "品牌 C"],
};

// --- Batch-3 (Flourish parity) sample data ---------------------------------

const SAMPLE_ROSE: SampleData = {
  table: [
    ["渠道", "销售额 万"],
    ["直营门店", "128"],
    ["电商平台", "96"],
    ["分销商", "64"],
    ["直播带货", "52"],
    ["团购", "24"],
  ],
  categoryColumn: "渠道",
  seriesColumns: ["销售额 万"],
};

const SAMPLE_RADIAL: SampleData = {
  table: [
    ["城市", "气温 ℃"],
    ["北京", "24"],
    ["上海", "28"],
    ["广州", "31"],
    ["成都", "22"],
    ["西安", "26"],
    ["哈尔滨", "15"],
  ],
  categoryColumn: "城市",
  seriesColumns: ["气温 ℃"],
};

const SAMPLE_RADIAL_STACK: SampleData = {
  table: [
    ["月份", "线上", "线下"],
    ["一月", "62", "48"],
    ["二月", "58", "52"],
    ["三月", "74", "55"],
    ["四月", "80", "61"],
    ["五月", "92", "66"],
    ["六月", "105", "72"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["线上", "线下"],
};

const SAMPLE_POLAR_LINE: SampleData = {
  table: [
    ["月份", "今年", "去年"],
    ["一月", "128", "104"],
    ["二月", "146", "122"],
    ["三月", "138", "118"],
    ["四月", "172", "149"],
    ["五月", "189", "160"],
    ["六月", "218", "185"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["今年", "去年"],
};

// --- Batch-4 (Flourish parity) sample data ---------------------------------

const SAMPLE_BUBBLE: SampleData = {
  table: [
    ["城市", "平均收入 万", "生活成本 万", "人口 万"],
    ["城市 A", "32", "18", "2100"],
    ["城市 B", "41", "26", "3400"],
    ["城市 C", "27", "14", "980"],
    ["城市 D", "48", "31", "5600"],
    ["城市 E", "22", "11", "650"],
    ["城市 F", "36", "21", "1800"],
    ["城市 G", "52", "35", "7200"],
  ],
  categoryColumn: "城市",
  seriesColumns: ["平均收入 万", "生活成本 万", "人口 万"],
};

const SAMPLE_GROUPED_SCATTER: SampleData = {
  table: [
    ["品种", "花瓣长 cm", "花瓣宽 cm"],
    ["品种 A", "1.4", "0.2"],
    ["品种 A", "1.7", "0.4"],
    ["品种 A", "1.3", "0.3"],
    ["品种 B", "4.7", "1.4"],
    ["品种 B", "4.2", "1.5"],
    ["品种 B", "5.1", "1.8"],
    ["品种 A", "1.5", "0.1"],
    ["品种 B", "4.4", "1.2"],
  ],
  categoryColumn: "品种",
  seriesColumns: ["花瓣长 cm", "花瓣宽 cm"],
};

const SAMPLE_QUADRANT: SampleData = {
  table: [
    ["产品", "价格", "满意度"],
    ["产品 A", "88", "92"],
    ["产品 B", "45", "78"],
    ["产品 C", "120", "66"],
    ["产品 D", "62", "84"],
    ["产品 E", "95", "48"],
    ["产品 F", "30", "35"],
    ["产品 G", "70", "72"],
    ["产品 H", "55", "58"],
  ],
  categoryColumn: "产品",
  seriesColumns: ["价格", "满意度"],
};

const SAMPLE_TREND: SampleData = {
  table: [
    ["门店", "广告投入 万", "销售额 万"],
    ["门店 A", "12", "148"],
    ["门店 B", "25", "196"],
    ["门店 C", "8", "121"],
    ["门店 D", "31", "228"],
    ["门店 E", "18", "170"],
    ["门店 F", "42", "265"],
    ["门店 G", "15", "158"],
  ],
  categoryColumn: "门店",
  seriesColumns: ["广告投入 万", "销售额 万"],
};

const SAMPLE_BEESWARM: SampleData = {
  table: [
    ["班级", "分数"],
    ["一班", "88"],
    ["一班", "92"],
    ["一班", "76"],
    ["一班", "84"],
    ["二班", "71"],
    ["二班", "95"],
    ["二班", "83"],
    ["二班", "67"],
    ["三班", "79"],
    ["三班", "90"],
    ["三班", "86"],
    ["三班", "74"],
  ],
  categoryColumn: "班级",
  seriesColumns: ["分数"],
};

// --- Batch-5 (Flourish parity) sample data ---------------------------------

const SAMPLE_HIERARCHY: SampleData = {
  table: [
    ["大区", "销售额 万", "利润 万"],
    ["华东", "420", "96"],
    ["华南", "356", "74"],
    ["华北", "298", "58"],
    ["西南", "180", "31"],
    ["东北", "142", "22"],
  ],
  categoryColumn: "大区",
  seriesColumns: ["销售额 万", "利润 万"],
};

const SAMPLE_NETWORK: SampleData = {
  table: [
    ["来源", "去向", "流量"],
    ["官网", "注册", "340"],
    ["广告", "注册", "280"],
    ["社媒", "注册", "180"],
    ["注册", "试用", "520"],
    ["注册", "流失", "280"],
    ["试用", "付费", "210"],
    ["付费", "续费", "150"],
    ["社媒", "官网", "90"],
  ],
  categoryColumn: "来源",
  seriesColumns: ["流量"],
  roleDefaults: {
    source: "来源",
    target: "去向",
    value: "流量",
  },
};

const SAMPLE_ADJACENCY: SampleData = {
  table: [
    ["出发地", "目的地", "班次数"],
    ["北京", "上海", "36"],
    ["北京", "广州", "18"],
    ["上海", "广州", "22"],
    ["上海", "成都", "14"],
    ["广州", "成都", "9"],
    ["成都", "北京", "11"],
    ["西安", "北京", "8"],
    ["西安", "上海", "6"],
  ],
  categoryColumn: "出发地",
  seriesColumns: ["班次数"],
  roleDefaults: {
    source: "出发地",
    target: "目的地",
    value: "班次数",
  },
};

const SAMPLE_ALLUVIAL: SampleData = {
  table: [
    ["阶段", "下一阶段", "人数"],
    ["曝光", "点击", "1200"],
    ["点击", "咨询", "480"],
    ["曝光", "分享", "260"],
    ["分享", "点击", "180"],
    ["咨询", "成交", "210"],
    ["点击", "流失", "720"],
  ],
  categoryColumn: "阶段",
  seriesColumns: ["人数"],
  roleDefaults: {
    source: "阶段",
    target: "下一阶段",
    value: "人数",
  },
};

// --- Batch-6 (Flourish parity) sample data ---------------------------------

const SAMPLE_PARALLEL: SampleData = {
  table: [
    ["城市", "收入 万", "消费 万", "通勤 分钟", "幸福指数"],
    ["城市 A", "32", "18", "42", "72"],
    ["城市 B", "41", "26", "55", "64"],
    ["城市 C", "27", "14", "28", "81"],
    ["城市 D", "48", "31", "61", "58"],
    ["城市 E", "22", "11", "24", "86"],
    ["城市 F", "36", "21", "38", "74"],
  ],
  categoryColumn: "城市",
  seriesColumns: ["收入 万", "消费 万", "通勤 分钟", "幸福指数"],
};

const SAMPLE_CALENDAR: SampleData = {
  table: [
    ["日期", "步数"],
    ["2026-01-05", "8200"],
    ["2026-01-08", "10400"],
    ["2026-01-12", "6400"],
    ["2026-01-15", "9800"],
    ["2026-01-19", "12200"],
    ["2026-01-22", "7600"],
    ["2026-01-26", "8900"],
    ["2026-01-29", "5400"],
    ["2026-02-02", "11200"],
    ["2026-02-05", "9100"],
    ["2026-02-09", "13600"],
    ["2026-02-12", "7800"],
  ],
  categoryColumn: "日期",
  seriesColumns: ["步数"],
};

const SAMPLE_ECDF: SampleData = {
  table: [
    ["样本", "响应时间 ms"],
    ["样本 1", "120"],
    ["样本 2", "85"],
    ["样本 3", "240"],
    ["样本 4", "160"],
    ["样本 5", "95"],
    ["样本 6", "310"],
    ["样本 7", "180"],
    ["样本 8", "140"],
    ["样本 9", "205"],
    ["样本 10", "68"],
  ],
  categoryColumn: "样本",
  seriesColumns: ["响应时间 ms"],
};

const SAMPLE_ERROR: SampleData = {
  table: [
    ["处理方式", "良率 %", "波动下", "波动上"],
    ["工艺 A", "92", "88", "96"],
    ["工艺 B", "86", "79", "94"],
    ["工艺 C", "78", "70", "89"],
    ["工艺 D", "95", "92", "97"],
    ["工艺 E", "83", "75", "91"],
  ],
  categoryColumn: "处理方式",
  seriesColumns: ["良率 %", "波动下", "波动上"],
};

const SAMPLE_CORR: SampleData = {
  table: [
    ["月份", "销售额", "广告费", "客流", "客单价"],
    ["一月", "128", "12", "860", "149"],
    ["二月", "146", "14", "920", "159"],
    ["三月", "138", "13", "890", "155"],
    ["四月", "172", "16", "1080", "159"],
    ["五月", "189", "18", "1150", "164"],
    ["六月", "218", "21", "1320", "165"],
    ["七月", "205", "19", "1240", "165"],
    ["八月", "232", "23", "1410", "165"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["销售额", "广告费", "客流", "客单价"],
};

const SAMPLE_VIOLIN: SampleData = {
  table: [
    ["组别", "得分"],
    ["一组", "62"],
    ["一组", "68"],
    ["一组", "70"],
    ["一组", "74"],
    ["一组", "78"],
    ["一组", "85"],
    ["二组", "55"],
    ["二组", "66"],
    ["二组", "72"],
    ["二组", "76"],
    ["二组", "88"],
    ["二组", "92"],
    ["三组", "48"],
    ["三组", "58"],
    ["三组", "64"],
    ["三组", "80"],
    ["三组", "81"],
    ["三组", "95"],
  ],
  categoryColumn: "组别",
  seriesColumns: ["得分"],
};

// --- Batch-7 (Flourish parity) sample data ---------------------------------

const SAMPLE_CAPSULE: SampleData = {
  table: [
    ["项目", "完成度 %"],
    ["需求分析", "100"],
    ["原型设计", "85"],
    ["前端开发", "62"],
    ["后端开发", "48"],
    ["联调测试", "24"],
    ["上线部署", "8"],
  ],
  categoryColumn: "项目",
  seriesColumns: ["完成度 %"],
};

const SAMPLE_ARROW: SampleData = {
  table: [
    ["方案", "支持票数"],
    ["方案 A", "412"],
    ["方案 B", "366"],
    ["方案 C", "298"],
    ["方案 D", "203"],
    ["方案 E", "121"],
  ],
  categoryColumn: "方案",
  seriesColumns: ["支持票数"],
};

const SAMPLE_DUMBBELL: SampleData = {
  table: [
    ["科室", "改造前等待 分钟", "改造后等待 分钟"],
    ["门诊 A", "52", "31"],
    ["门诊 B", "44", "38"],
    ["门诊 C", "61", "27"],
    ["门诊 D", "38", "35"],
    ["门诊 E", "47", "22"],
    ["门诊 F", "58", "40"],
  ],
  categoryColumn: "科室",
  seriesColumns: ["改造前等待 分钟", "改造后等待 分钟"],
};

const SAMPLE_STACKED_DOT: SampleData = {
  table: [
    ["候选人", "得票数"],
    ["候选人 A", "12"],
    ["候选人 B", "9"],
    ["候选人 C", "6"],
    ["候选人 D", "4"],
  ],
  categoryColumn: "候选人",
  seriesColumns: ["得票数"],
};

const SAMPLE_CANDLE_VOLUME: SampleData = {
  table: [
    ["日期", "开盘", "收盘", "最低", "最高", "成交量"],
    ["8/01", "102", "108", "99", "112", "5200"],
    ["8/02", "108", "105", "101", "111", "4100"],
    ["8/03", "105", "113", "104", "116", "6300"],
    ["8/04", "113", "110", "107", "117", "3800"],
    ["8/05", "110", "118", "109", "121", "7400"],
    ["8/06", "118", "122", "115", "126", "8900"],
    ["8/07", "122", "117", "113", "124", "5600"],
    ["8/08", "117", "126", "116", "130", "9400"],
  ],
  categoryColumn: "日期",
  seriesColumns: ["开盘", "收盘", "最低", "最高", "成交量"],
};

// --- Batch-8 (Flourish parity) sample data ---------------------------------

const SAMPLE_MULTI_RING: SampleData = {
  table: [
    ["渠道", "线上店", "自营门店"],
    ["家电", "360", "290"],
    ["数码", "420", "240"],
    ["家居", "250", "310"],
    ["服饰", "480", "180"],
  ],
  categoryColumn: "渠道",
  seriesColumns: ["线上店", "自营门店"],
};

const SAMPLE_DENSITY: SampleData = {
  table: [
    ["门店", "客流 千", "销售额 万"],
    ["门店 A", "12", "86"],
    ["门店 B", "18", "120"],
    ["门店 C", "22", "146"],
    ["门店 D", "30", "205"],
    ["门店 E", "26", "188"],
    ["门店 F", "35", "242"],
    ["门店 G", "40", "288"],
    ["门店 H", "48", "330"],
    ["门店 I", "55", "402"],
    ["门店 J", "61", "455"],
    ["门店 K", "9", "58"],
    ["门店 L", "15", "104"],
  ],
  categoryColumn: "门店",
  seriesColumns: ["客流 千", "销售额 万"],
};

// --- Batch-9 (Flourish parity) sample data ---------------------------------

const SAMPLE_KPI: SampleData = {
  table: [
    ["指标", "数值"],
    ["本月销售额", "1280"],
  ],
  categoryColumn: "指标",
  seriesColumns: ["数值"],
};

const SAMPLE_KPI_ROW: SampleData = {
  table: [
    ["门店", "一月", "二月", "三月", "四月"],
    ["汇总", "128", "146", "172", "189"],
  ],
  categoryColumn: "门店",
  seriesColumns: ["一月", "二月", "三月", "四月"],
};

const SAMPLE_SPARKLINE: SampleData = {
  table: [
    ["指标", "当前值", "一月", "二月", "三月", "四月", "五月", "六月"],
    ["销售额 万", "218", "128", "146", "138", "172", "189", "218"],
  ],
  categoryColumn: "指标",
  seriesColumns: ["当前值", "一月", "二月", "三月", "四月", "五月", "六月"],
};

const SAMPLE_BAR_TABLE: SampleData = {
  table: [
    ["项目", "预算 万"],
    ["市场推广", "480"],
    ["产品研发", "620"],
    ["客户成功", "260"],
    ["基础设施", "180"],
    ["行政运营", "120"],
  ],
  categoryColumn: "项目",
  seriesColumns: ["预算 万"],
};

const SAMPLE_WORDCLOUD: SampleData = {
  table: [
    ["关键词", "热度"],
    ["数据可视化", "100"],
    ["透明图表", "86"],
    ["仪表盘", "72"],
    ["柱状图", "64"],
    ["折线图", "58"],
    ["饼图", "52"],
    ["桑基图", "38"],
    ["热力图", "34"],
    ["雷达图", "30"],
    ["词云", "26"],
    ["散点图", "22"],
    ["箱线图", "18"],
  ],
  categoryColumn: "关键词",
  seriesColumns: ["热度"],
};

// --- Batch-10 (Flourish parity) sample data --------------------------------

const SAMPLE_GANTT: SampleData = {
  table: [
    ["阶段", "开始 天", "结束 天"],
    ["立项评审", "0", "4"],
    ["需求冻结", "3", "9"],
    ["架构设计", "8", "16"],
    ["开发", "14", "34"],
    ["集成测试", "30", "40"],
    ["发布", "38", "42"],
  ],
  categoryColumn: "阶段",
  seriesColumns: ["开始 天", "结束 天"],
};

const SAMPLE_TIMELINE: SampleData = {
  table: [
    ["里程碑", "周次"],
    ["立项", "1"],
    ["原型确认", "3"],
    ["视觉定稿", "5"],
    ["开发完成", "9"],
    ["内测", "11"],
    ["公测", "13"],
    ["正式发布", "15"],
  ],
  categoryColumn: "里程碑",
  seriesColumns: ["周次"],
};

const SAMPLE_SMALL_MULTIPLES: SampleData = {
  table: [
    ["门店", "销售额 万", "客流量 千", "客单价 元"],
    ["门店 A", "86", "12", "149"],
    ["门店 B", "120", "18", "155"],
    ["门店 C", "146", "22", "162"],
    ["门店 D", "205", "30", "171"],
    ["门店 E", "242", "35", "178"],
    ["门店 F", "288", "40", "186"],
  ],
  categoryColumn: "门店",
  seriesColumns: ["销售额 万", "客流量 千", "客单价 元"],
};

// --- Batch-11 (Flourish parity) sample data --------------------------------

const SAMPLE_WORLD_CHOROPLETH: SampleData = {
  table: [
    ["国家", "GDP 万亿美元"],
    ["中国", "18.6"],
    ["美国", "25.5"],
    ["日本", "4.2"],
    ["德国", "4.1"],
    ["印度", "3.4"],
    ["英国", "3.1"],
    ["法国", "2.8"],
    ["巴西", "1.9"],
  ],
  categoryColumn: "国家",
  seriesColumns: ["GDP 万亿美元"],
};

const SAMPLE_CHINA_CHOROPLETH: SampleData = {
  table: [
    ["省份", "常住人口 万人"],
    ["广东省", "12684"],
    ["山东省", "10153"],
    ["河南省", "9883"],
    ["江苏省", "8505"],
    ["四川省", "8374"],
    ["浙江省", "6540"],
    ["湖北省", "5775"],
    ["福建省", "4154"],
  ],
  categoryColumn: "省份",
  seriesColumns: ["常住人口 万人"],
};

const SAMPLE_SYMBOL_MAP: SampleData = {
  table: [
    ["国家", "用户数 万"],
    ["中国", "4200"],
    ["美国", "3100"],
    ["印度", "2600"],
    ["巴西", "1400"],
    ["日本", "980"],
    ["德国", "760"],
    ["英国", "640"],
    ["印度尼西亚", "1200"],
  ],
  categoryColumn: "国家",
  seriesColumns: ["用户数 万"],
};

const SAMPLE_GEO_HEATMAP: SampleData = {
  table: [
    ["国家", "订单密度"],
    ["中国", "92"],
    ["韩国", "58"],
    ["日本", "74"],
    ["新加坡", "66"],
    ["泰国", "38"],
    ["印度", "52"],
    ["德国", "30"],
    ["英国", "44"],
    ["美国", "68"],
    ["澳大利亚", "24"],
  ],
  categoryColumn: "国家",
  seriesColumns: ["订单密度"],
};

const SAMPLE_FLOW_MAP: SampleData = {
  table: [
    ["来源", "去向", "航班量 班"],
    ["中国", "美国", "320"],
    ["中国", "德国", "280"],
    ["中国", "澳大利亚", "190"],
    ["中国", "新加坡", "410"],
    ["中国", "日本", "380"],
    ["中国", "印度", "150"],
    ["中国", "英国", "210"],
    ["中国", "巴西", "90"],
  ],
  categoryColumn: "来源",
  seriesColumns: ["航班量 班"],
  roleDefaults: {
    source: "来源",
    target: "去向",
    value: "航班量 班",
  },
};

const SAMPLE_SPLIT_AXIS: SampleData = {
  table: [
    ["月份", "销售额 万"],
    ["一月", "34"],
    ["二月", "28"],
    ["三月", "41"],
    ["四月", "36"],
    ["五月", "310"],
    ["六月", "45"],
    ["七月", "39"],
    ["八月", "30"],
  ],
  categoryColumn: "月份",
  seriesColumns: ["销售额 万"],
};

const SAMPLE_MARIMEKKO: SampleData = {
  table: [
    ["渠道", "新客", "复购"],
    ["电商平台", "320", "180"],
    ["直营门店", "260", "220"],
    ["分销商", "180", "90"],
    ["直播带货", "140", "60"],
  ],
  categoryColumn: "渠道",
  seriesColumns: ["新客", "复购"],
};

// --- Shared validators -----------------------------------------------------
// Each returns null (pass) or a human-readable error string. Validators read
// only the ValidationContext (parsed table + resolved categoryColumn /
// seriesColumns), never mutate rendering. The page runs them in order and
// surfaces the first non-null message as a preview overlay.

/** Requires at least one data row (the header row alone is not enough). */
const requireRows: DataValidator = {
  validate: (ctx) =>
    ctx.parsed.rows.length === 0 ? "至少需要一行数据" : null,
};

/** Requires at least one numeric column to plot. */
const requireNumericColumn: DataValidator = {
  validate: (ctx) =>
    ctx.parsed.numericHeaders.length === 0 ? "至少需要一个数值列" : null,
};

/** Requires at least two numeric columns (e.g. scatter X/Y, diverging L/R). */
const requireTwoNumericColumns =
  (message: string): DataValidator => ({
    validate: (ctx) => {
      const selectedNumericColumns = ctx.seriesColumns.filter((header) =>
        ctx.parsed.numericHeaders.includes(header),
      );
      return selectedNumericColumns.length < 2 ? message : null;
    },
  });

const requireFourNumericColumns =
  (message: string): DataValidator => ({
    validate: (ctx) => {
      const selectedNumericColumns = ctx.seriesColumns.filter((header) =>
        ctx.parsed.numericHeaders.includes(header),
      );
      return selectedNumericColumns.length < 4 ? message : null;
    },
  });

const requireFiveNumericColumns =
  (message: string): DataValidator => ({
    validate: (ctx) => {
      const selectedNumericColumns = ctx.seriesColumns.filter((header) =>
        ctx.parsed.numericHeaders.includes(header),
      );
      return selectedNumericColumns.length < 5 ? message : null;
    },
  });

const requireThreeNumericColumns =
  (message: string): DataValidator => ({
    validate: (ctx) => {
      const selectedNumericColumns = ctx.seriesColumns.filter((header) =>
        ctx.parsed.numericHeaders.includes(header),
      );
      return selectedNumericColumns.length < 3 ? message : null;
    },
  });

const requireSankeyColumns: DataValidator = {
  validate: (ctx) => {
    const textHeaders = ctx.parsed.headers.filter(
      (header) => !ctx.parsed.numericHeaders.includes(header),
    );
    if (textHeaders.length < 2) return "桑基图需要 2 个文本列（来源和去向）";
    return null;
  },
};

// Most templates only need rows + at least one numeric column.
const BASE_VALIDATORS: DataValidator[] = [requireRows, requireNumericColumn];

// --- The registry ----------------------------------------------------------
// Every template is registered with its family renderer.

export const TEMPLATE_REGISTRY: Record<ChartType, TemplateDefinition> = {
  // --- Bar / column family (migrated) -------------------------------------
  bar: {
    id: "bar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  stackedBar: {
    id: "stackedBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  proportionalBar: {
    id: "proportionalBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  column: {
    id: "column",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  groupedColumn: {
    id: "groupedColumn",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  stackedColumn: {
    id: "stackedColumn",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  proportionalColumn: {
    id: "proportionalColumn",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },

  // --- Bar/column extensions (Flourish parity batch 1) --------------------
  histogram: {
    id: "histogram",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildHistogramOption,
    sampleData: SAMPLE_SCORES,
  },
  densityHistogram: {
    id: "densityHistogram",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildDensityHistogramOption,
    sampleData: SAMPLE_HEIGHTS,
  },
  rangeBar: {
    id: "rangeBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_LOWER, BIND_VALUE_UPPER],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("区间条形图需要 2 个数值列（下限和上限）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildRangeOption,
    sampleData: SAMPLE_RANGE_TASK,
  },
  rangeColumn: {
    id: "rangeColumn",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_LOWER, BIND_VALUE_UPPER],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("区间柱状图需要 2 个数值列（下限和上限）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildRangeOption,
    sampleData: SAMPLE_RANGE_PRICE,
  },
  bulletBar: {
    id: "bulletBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_ACTUAL, BIND_VALUE_TARGET],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("子弹图需要 2 个数值列（实际值和目标值）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBulletOption,
    sampleData: SAMPLE_BULLET,
  },
  lollipop: {
    id: "lollipop",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLollipopOption,
    sampleData: SAMPLE_LOLLIPOP,
  },
  pictorialColumn: {
    id: "pictorialColumn",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildPictorialOption,
    sampleData: SAMPLE_PICTORIAL,
  },
  progressBar: {
    id: "progressBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildProgressOption,
    sampleData: SAMPLE_PROGRESS,
  },
  rankingBar: {
    id: "rankingBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildRankingOption,
    sampleData: SAMPLE_RANKING,
  },
  pareto: {
    id: "pareto",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildParetoOption,
    sampleData: SAMPLE_PARETO,
  },

  // --- Pie / donut family (migrated) --------------------------------------
  halfDonut: {
    id: "halfDonut",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildHalfDonutOption,
    sampleData: SAMPLE_GAUGE,
  },
  multiRing: {
    id: "multiRing",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildMultiRingOption,
    sampleData: SAMPLE_MULTI_RING,
  },
  donut: {
    id: "donut",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildPieOption,
    sampleData: SAMPLE_SHARE,
  },
  pie: {
    id: "pie",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildPieOption,
    sampleData: SAMPLE_SHARE,
  },

  // --- Radial / polar family (Flourish parity batch 3) ---------------------
  rose: {
    id: "rose",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildRoseOption,
    sampleData: SAMPLE_ROSE,
  },
  roseArea: {
    id: "roseArea",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildRoseOption,
    sampleData: SAMPLE_ROSE,
  },
  radialBar: {
    id: "radialBar",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildRadialBarOption,
    sampleData: SAMPLE_RADIAL,
  },
  radialStackedBar: {
    id: "radialStackedBar",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildRadialBarOption,
    sampleData: SAMPLE_RADIAL_STACK,
  },
  progressRing: {
    id: "progressRing",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildProgressRingOption,
    sampleData: SAMPLE_GAUGE,
  },
  polarLine: {
    id: "polarLine",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildPolarLineOption,
    sampleData: SAMPLE_POLAR_LINE,
  },
  polarArea: {
    id: "polarArea",
    family: "pie",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: PIE_GROUPS,
    capabilities: CAP_PIE,
    buildOption: buildPolarLineOption,
    sampleData: SAMPLE_POLAR_LINE,
  },

  // --- Line / area family (migrated) --------------------------------------
  line: {
    id: "line",
    family: "line",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  smoothLine: {
    id: "smoothLine",
    family: "line",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  stepLine: {
    id: "stepLine",
    family: "line",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  area: {
    id: "area",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  stackedArea: {
    id: "stackedArea",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  proportionalArea: {
    id: "proportionalArea",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },

  // --- Streamgraph family (migrated) --------------------------------------
  streamgraph: {
    id: "streamgraph",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildStreamgraphOption,
    sampleData: SAMPLE_MONTHLY,
  },

  // --- Line/area extensions (Flourish parity batch 2) ----------------------
  pointLine: {
    id: "pointLine",
    family: "line",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  dualAxisLine: {
    id: "dualAxisLine",
    family: "line",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildDualAxisLineOption,
    sampleData: SAMPLE_DUAL_AXIS,
  },
  slopeChart: {
    id: "slopeChart",
    family: "line",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_LOWER, BIND_VALUE_UPPER],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("斜率图需要 2 个数值列（两个时期）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildSlopeOption,
    sampleData: SAMPLE_SLOPE,
  },
  bump: {
    id: "bump",
    family: "line",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBumpOption,
    sampleData: SAMPLE_BUMP,
  },
  smoothArea: {
    id: "smoothArea",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  stepArea: {
    id: "stepArea",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildLineAreaOption,
    sampleData: SAMPLE_MONTHLY,
  },
  bandArea: {
    id: "bandArea",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_LOWER, BIND_VALUE_UPPER, BIND_VALUE_MID],
    validators: [
      ...BASE_VALIDATORS,
      requireThreeNumericColumns("区间面积图需要 3 个数值列（下限、上限、中值）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBandAreaOption,
    sampleData: SAMPLE_BAND,
  },
  ridgeline: {
    id: "ridgeline",
    family: "area",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildRidgelineOption,
    sampleData: SAMPLE_RIDGE,
  },

  // --- Combo family (migrated) --------------------------------------------
  combo: {
    id: "combo",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildComboOption,
    sampleData: SAMPLE_QUARTERLY,
  },

  // --- Scatter family (migrated) ------------------------------------------
  scatter: {
    id: "scatter",
    family: "other",
    dataBindings: [
      BIND_CATEGORY_SINGLE,
      BIND_X,
      BIND_Y,
      BIND_SIZE,
      BIND_COLOR,
      BIND_SHAPE,
    ],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("散点图需要 2 个数值列（X 和 Y）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildScatterOption,
    sampleData: SAMPLE_SCATTER,
  },

  // --- Scatter/bubble extensions (Flourish parity batch 4) -----------------
  bubble: {
    id: "bubble",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_X, BIND_Y, BIND_SIZE],
    validators: [
      ...BASE_VALIDATORS,
      requireThreeNumericColumns("气泡图需要 3 个数值列（X、Y 和大小）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBubbleOption,
    sampleData: SAMPLE_BUBBLE,
  },
  groupedScatter: {
    id: "groupedScatter",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_X, BIND_Y],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("分组散点图需要 2 个数值列（X 和 Y）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildGroupedScatterOption,
    sampleData: SAMPLE_GROUPED_SCATTER,
  },
  quadrant: {
    id: "quadrant",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_X, BIND_Y],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("象限图需要 2 个数值列（X 和 Y）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildQuadrantOption,
    sampleData: SAMPLE_QUADRANT,
  },
  trendScatter: {
    id: "trendScatter",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_X, BIND_Y],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("回归散点图需要 2 个数值列（X 和 Y）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildTrendScatterOption,
    sampleData: SAMPLE_TREND,
  },
  beeswarm: {
    id: "beeswarm",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBeeswarmOption,
    sampleData: SAMPLE_BEESWARM,
  },

  // --- Hierarchy & network (Flourish parity batch 5) -----------------------
  sunburst: {
    id: "sunburst",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildSunburstOption,
    sampleData: SAMPLE_HIERARCHY,
  },
  dendrogram: {
    id: "dendrogram",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildDendrogramOption,
    sampleData: SAMPLE_HIERARCHY,
  },
  radialTree: {
    id: "radialTree",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildRadialTreeOption,
    sampleData: SAMPLE_HIERARCHY,
  },
  orgChart: {
    id: "orgChart",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildOrgChartOption,
    sampleData: SAMPLE_HIERARCHY,
  },
  networkGraph: {
    id: "networkGraph",
    family: "other",
    dataBindings: [BIND_SOURCE, BIND_TARGET, BIND_VALUE_SINGLE],
    validators: [...BASE_VALIDATORS, requireSankeyColumns],
    settingsGroups: NON_CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildNetworkGraphOption,
    sampleData: SAMPLE_NETWORK,
  },
  chord: {
    id: "chord",
    family: "other",
    dataBindings: [BIND_SOURCE, BIND_TARGET, BIND_VALUE_SINGLE],
    validators: [...BASE_VALIDATORS, requireSankeyColumns],
    settingsGroups: NON_CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildChordOption,
    sampleData: SAMPLE_NETWORK,
  },
  adjacencyMatrix: {
    id: "adjacencyMatrix",
    family: "other",
    dataBindings: [BIND_SOURCE, BIND_TARGET, BIND_VALUE_SINGLE],
    validators: [...BASE_VALIDATORS, requireSankeyColumns],
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildAdjacencyMatrixOption,
    sampleData: SAMPLE_ADJACENCY,
  },
  alluvial: {
    id: "alluvial",
    family: "other",
    dataBindings: [BIND_SOURCE, BIND_TARGET, BIND_VALUE_SINGLE],
    validators: [...BASE_VALIDATORS, requireSankeyColumns],
    settingsGroups: NON_CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildAlluvialOption,
    sampleData: SAMPLE_ALLUVIAL,
  },

  // --- Statistical & distribution (Flourish parity batch 6) ----------------
  parallelCoordinates: {
    id: "parallelCoordinates",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: [GROUP_COLORS, GROUP_LEGEND, GROUP_NUMBERS],
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildParallelOption,
    sampleData: SAMPLE_PARALLEL,
  },
  calendarHeatmap: {
    id: "calendarHeatmap",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildCalendarHeatmapOption,
    sampleData: SAMPLE_CALENDAR,
  },
  ecdf: {
    id: "ecdf",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildEcdfOption,
    sampleData: SAMPLE_ECDF,
  },
  errorBar: {
    id: "errorBar",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_ACTUAL, BIND_VALUE_LOWER, BIND_VALUE_UPPER],
    validators: [
      ...BASE_VALIDATORS,
      requireThreeNumericColumns("误差线图需要 3 个数值列（数值、下误差、上误差）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildErrorBarOption,
    sampleData: SAMPLE_ERROR,
  },
  correlationMatrix: {
    id: "correlationMatrix",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("相关性矩阵图需要 2 个数值列"),
    ],
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildCorrelationMatrixOption,
    sampleData: SAMPLE_CORR,
  },
  violin: {
    id: "violin",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildViolinOption,
    sampleData: SAMPLE_VIOLIN,
  },
  marimekko: {
    id: "marimekko",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildMarimekkoOption,
    sampleData: SAMPLE_MARIMEKKO,
  },

  // --- Diverging / population pyramid family (migrated) -------------------
  divergingBar: {
    id: "divergingBar",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_LEFT_VALUE, BIND_RIGHT_VALUE],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("发散条形图需要 2 个数值列（左和右）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildDivergingOption,
    sampleData: SAMPLE_DIVERGING,
  },
  populationPyramid: {
    id: "populationPyramid",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_LEFT_VALUE, BIND_RIGHT_VALUE],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("人口金字塔需要 2 个数值列（左和右）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildDivergingOption,
    sampleData: SAMPLE_PYRAMID,
  },
  dotPlot: {
    id: "dotPlot",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildDotPlotOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  waterfall: {
    id: "waterfall",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildWaterfallOption,
    sampleData: SAMPLE_WATERFALL,
  },
  heatmap: {
    id: "heatmap",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildHeatmapOption,
    sampleData: SAMPLE_HEATMAP,
  },
  treemap: {
    id: "treemap",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildTreemapOption,
    sampleData: SAMPLE_SHARE,
  },
  funnel: {
    id: "funnel",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildFunnelOption,
    sampleData: SAMPLE_FUNNEL,
  },
  gauge: {
    id: "gauge",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildGaugeOption,
    sampleData: SAMPLE_GAUGE,
  },
  radar: {
    id: "radar",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: RADAR_GROUPS,
    capabilities: CAP_NON_CARTESIAN,
    buildOption: buildRadarOption,
    sampleData: SAMPLE_RADAR,
  },
  boxplot: {
    id: "boxplot",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_DISTRIBUTION_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildBoxplotOption,
    sampleData: SAMPLE_DISTRIBUTION,
  },
  candlestick: {
    id: "candlestick",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_OHLC_MULTIPLE],
    validators: [
      ...BASE_VALIDATORS,
      requireFourNumericColumns("蜡烛图需要 4 个数值列（开盘、收盘、最低、最高）"),
    ],
    settingsGroups: CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildCandlestickOption,
    sampleData: SAMPLE_CANDLESTICK,
  },
  sankey: {
    id: "sankey",
    family: "other",
    dataBindings: [BIND_SOURCE, BIND_TARGET, BIND_VALUE_SINGLE],
    validators: [...BASE_VALIDATORS, requireSankeyColumns],
    settingsGroups: NON_CARTESIAN_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildSankeyOption,
    sampleData: SAMPLE_FLOW,
  },

  // --- Bar/column & OHLC variants (Flourish parity batch 7) ----------------
  groupedBar: {
    id: "groupedBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildBarOption,
    sampleData: SAMPLE_QUARTERLY,
  },
  capsuleBar: {
    id: "capsuleBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildCapsuleOption,
    sampleData: SAMPLE_CAPSULE,
  },
  arrowBar: {
    id: "arrowBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildArrowOption,
    sampleData: SAMPLE_ARROW,
  },
  dumbbell: {
    id: "dumbbell",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_START, BIND_VALUE_END],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("哑铃图需要 2 个数值列（起点和终点）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildDumbbellOption,
    sampleData: SAMPLE_DUMBBELL,
  },
  stackedDot: {
    id: "stackedDot",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildStackedDotOption,
    sampleData: SAMPLE_STACKED_DOT,
  },
  ohlcBar: {
    id: "ohlcBar",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_OHLC_MULTIPLE],
    validators: [
      ...BASE_VALIDATORS,
      requireFourNumericColumns("OHLC 条形图需要 4 个数值列（开盘、收盘、最低、最高）"),
    ],
    settingsGroups: [GROUP_COLORS, GROUP_X_AXIS, GROUP_Y_AXIS, GROUP_LEGEND, GROUP_NUMBERS],
    capabilities: { ...CAP_CARTESIAN_NO_LEGEND, labels: false },
    buildOption: buildOhlcBarOption,
    sampleData: SAMPLE_CANDLESTICK,
  },
  candleVolume: {
    id: "candleVolume",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_OHLC_MULTIPLE, BIND_VALUE_VOLUME],
    validators: [
      ...BASE_VALIDATORS,
      requireFiveNumericColumns("蜡烛+成交量组合图需要 5 个数值列（开盘、收盘、最低、最高、成交量）"),
    ],
    settingsGroups: [GROUP_COLORS, GROUP_X_AXIS, GROUP_Y_AXIS, GROUP_LEGEND, GROUP_NUMBERS],
    capabilities: { ...CAP_CARTESIAN_NO_LEGEND, labels: false },
    buildOption: buildCandleVolumeOption,
    sampleData: SAMPLE_CANDLE_VOLUME,
  },
  splitAxisBar: {
    id: "splitAxisBar",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildSplitAxisOption,
    sampleData: SAMPLE_SPLIT_AXIS,
  },

  // --- Pie/boxplot extensions (Flourish parity batch 8) --------------------
  boxplotHorizontal: {
    id: "boxplotHorizontal",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_DISTRIBUTION_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildBoxplotHorizontalOption,
    sampleData: SAMPLE_DISTRIBUTION,
  },
  densityHeatmap: {
    id: "densityHeatmap",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_X, BIND_Y],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("密度热力散点图需要 2 个数值列（X 和 Y）"),
    ],
    settingsGroups: CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildDensityHeatmapOption,
    sampleData: SAMPLE_DENSITY,
  },

  // --- Cards / table / text (Flourish parity batch 9) ----------------------
  kpiCard: {
    id: "kpiCard",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: CAP_GRAPHIC,
    buildOption: buildKpiCardOption,
    sampleData: SAMPLE_KPI,
  },
  kpiCardRow: {
    id: "kpiCardRow",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: CAP_GRAPHIC,
    buildOption: buildKpiCardRowOption,
    sampleData: SAMPLE_KPI_ROW,
  },
  sparklineCard: {
    id: "sparklineCard",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: CAP_GRAPHIC,
    buildOption: buildSparklineCardOption,
    sampleData: SAMPLE_SPARKLINE,
  },
  barTable: {
    id: "barTable",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: CAP_GRAPHIC,
    buildOption: buildBarTableOption,
    sampleData: SAMPLE_BAR_TABLE,
  },
  wordCloud: {
    id: "wordCloud",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: CAP_GRAPHIC,
    buildOption: buildWordCloudOption,
    sampleData: SAMPLE_WORDCLOUD,
  },

  // --- Time & facets (Flourish parity batch 10) ----------------------------
  gantt: {
    id: "gantt",
    family: "bar",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_LOWER, BIND_VALUE_UPPER],
    validators: [
      ...BASE_VALIDATORS,
      requireTwoNumericColumns("甘特图需要 2 个数值列（开始和结束）"),
    ],
    settingsGroups: CARTESIAN_GROUPS,
    capabilities: CAP_CARTESIAN,
    buildOption: buildGanttOption,
    sampleData: SAMPLE_GANTT,
  },
  timeline: {
    id: "timeline",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildTimelineOption,
    sampleData: SAMPLE_TIMELINE,
  },
  smallMultiples: {
    id: "smallMultiples",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_MULTIPLE],
    validators: BASE_VALIDATORS,
    settingsGroups: CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_CARTESIAN_NO_LEGEND,
    buildOption: buildSmallMultiplesOption,
    sampleData: SAMPLE_SMALL_MULTIPLES,
  },

  // --- Map family (Flourish parity batch 11) -------------------------------
  worldChoropleth: {
    id: "worldChoropleth",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildWorldChoroplethOption,
    sampleData: SAMPLE_WORLD_CHOROPLETH,
    geoMap: "world",
    canUseData: (ctx) => hasKnownGeoNames(ctx, 1, "world"),
  },
  chinaChoropleth: {
    id: "chinaChoropleth",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND,
    capabilities: CAP_NON_CARTESIAN_NO_LEGEND,
    buildOption: buildChinaChoroplethOption,
    sampleData: SAMPLE_CHINA_CHOROPLETH,
    geoMap: "china",
    canUseData: (ctx) => hasKnownGeoNames(ctx, 1, "china"),
  },
  symbolMap: {
    id: "symbolMap",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: { ...CAP_NON_CARTESIAN_NO_LEGEND, labels: false },
    buildOption: buildSymbolMapOption,
    sampleData: SAMPLE_SYMBOL_MAP,
    geoMap: "world",
    canUseData: (ctx) => hasKnownGeoNames(ctx, 1, "centroids"),
  },
  geoHeatmap: {
    id: "geoHeatmap",
    family: "other",
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_VALUE_SINGLE],
    validators: BASE_VALIDATORS,
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: { ...CAP_NON_CARTESIAN_NO_LEGEND, labels: false },
    buildOption: buildGeoHeatmapOption,
    sampleData: SAMPLE_GEO_HEATMAP,
    geoMap: "world",
    canUseData: (ctx) => hasKnownGeoNames(ctx, 1, "centroids"),
  },
  flowMap: {
    id: "flowMap",
    family: "other",
    dataBindings: [BIND_SOURCE, BIND_TARGET, BIND_VALUE_SINGLE],
    validators: [...BASE_VALIDATORS, requireSankeyColumns],
    settingsGroups: GRAPHIC_GROUPS,
    capabilities: { ...CAP_NON_CARTESIAN_NO_LEGEND, labels: false },
    buildOption: buildFlowMapOption,
    sampleData: SAMPLE_FLOW_MAP,
    geoMap: "world",
    canUseData: (ctx) => hasKnownGeoNames(ctx, 1, "centroids"),
  },
};

export function getTemplateDefinition(type: ChartType): TemplateDefinition {
  return TEMPLATE_REGISTRY[type];
}

// buildWithRenderer is re-exported here so chart-model.ts can import both the
// registry query and the renderer entry point from a single module, keeping
// chart-model.ts's import list short.
export { buildWithRenderer };
