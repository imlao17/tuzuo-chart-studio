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
  buildBoxplotOption,
  buildCandlestickOption,
  buildDotPlotOption,
  buildFunnelOption,
  buildGaugeOption,
  buildHeatmapOption,
  buildRadarOption,
  buildSankeyOption,
  buildTreemapOption,
  buildWaterfallOption,
} from "./renderers/advanced";
import {
  buildBarOption,
  buildBulletOption,
  buildDensityHistogramOption,
  buildHistogramOption,
  buildLollipopOption,
  buildPictorialOption,
  buildProgressOption,
  buildRangeOption,
  buildRankingOption,
} from "./renderers/bar";
import { buildComboOption, buildParetoOption } from "./renderers/combo";
import { buildDivergingOption } from "./renderers/diverging";
import { buildLineAreaOption } from "./renderers/line-area";
import { buildPieOption } from "./renderers/pie";
import { buildScatterOption } from "./renderers/scatter";
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
const CARTESIAN_GROUPS: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_X_AXIS,
  GROUP_Y_AXIS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const CARTESIAN_GROUPS_NO_LEGEND: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_X_AXIS,
  GROUP_Y_AXIS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const CARTESIAN_BASIC_GROUPS_NO_LEGEND: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_LABELS,
  GROUP_X_AXIS,
  GROUP_Y_AXIS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const PIE_GROUPS: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const NON_CARTESIAN_GROUPS_NO_LEGEND: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const NON_CARTESIAN_BASIC_GROUPS_NO_LEGEND: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
];

const RADAR_GROUPS: SettingsGroup[] = [
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
};

export function getTemplateDefinition(type: ChartType): TemplateDefinition {
  return TEMPLATE_REGISTRY[type];
}

// buildWithRenderer is re-exported here so chart-model.ts can import both the
// registry query and the renderer entry point from a single module, keeping
// chart-model.ts's import list short.
export { buildWithRenderer };
