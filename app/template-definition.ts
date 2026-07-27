/**
 * Template definition layer.
 *
 * Each chart template declares its data bindings, validators, settings
 * groups, capabilities, and its renderer. All 20 templates are migrated to
 * per-family renderers; the legacy buildChartOption fallback has been removed.
 *
 * The type surface here is the contract the rest of the P0 roadmap builds on:
 *   - Task 3 fills in dataBindings for real field-role binding UI.
 *   - Task 4 drives the right-hand settings panel from settingsGroups.
 *   - Task 5 surfaces validators as empty-state errors.
 *   - Task 6 fixes the per-template "silent ignore" issues.
 */
import type { ChartConfig, ChartFamily, ChartType } from "./chart-model";
import { buildBarOption } from "./renderers/bar";
import { buildComboOption } from "./renderers/combo";
import { buildDivergingOption } from "./renderers/diverging";
import { buildLineAreaOption } from "./renderers/line-area";
import { buildPieOption } from "./renderers/pie";
import { buildScatterOption } from "./renderers/scatter";
import { buildStreamgraphOption } from "./renderers/streamgraph";
import { buildWithRenderer, type RendererResult } from "./renderers/shared";

export type DataBindingRole =
  | "category"
  | "value"
  | "x"
  | "y"
  | "size"
  | "color"
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
};

export type DataValidator = {
  /** 返回可读错误信息，null 表示通过。任务 5 启用。 */
  validate(ctx: ValidationContext): string | null;
};

export type SettingsGroupId =
  | "colors"
  | "marks"
  | "labels"
  | "xAxis"
  | "yAxis"
  | "legend"
  | "numbers"
  | "canvas";

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

const GROUP_COLORS: SettingsGroup = {
  id: "colors",
  title: "配色",
  keywords: "配色 主题 色板 颜色",
};
const GROUP_MARKS: SettingsGroup = {
  id: "marks",
  title: "线条、数据点与面积",
  keywords: "线条 数据点 面积 线宽 点大小 平滑 柱宽 圆角 透明度",
};
const GROUP_LABELS: SettingsGroup = {
  id: "labels",
  title: "数据标签",
  keywords: "数据标签 标签位置 字号",
};
const GROUP_X_AXIS: SettingsGroup = {
  id: "xAxis",
  title: "X 轴",
  keywords: "X 轴 横轴 分类轴 标题 旋转",
};
const GROUP_Y_AXIS: SettingsGroup = {
  id: "yAxis",
  title: "Y 轴",
  keywords: "Y 轴 纵轴 数值轴 标题 范围 网格",
};
const GROUP_LEGEND: SettingsGroup = {
  id: "legend",
  title: "图例与交互",
  keywords: "图例 提示 交互 位置 tooltip",
};
const GROUP_NUMBERS: SettingsGroup = {
  id: "numbers",
  title: "数字格式",
  keywords: "数字格式 小数 前缀 后缀 千分位",
};
const GROUP_CANVAS: SettingsGroup = {
  id: "canvas",
  title: "画布与布局",
  keywords: "画布 背景 透明 尺寸 边距 对齐",
};

const CARTESIAN_GROUPS: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_X_AXIS,
  GROUP_Y_AXIS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
  GROUP_CANVAS,
];

const PIE_GROUPS: SettingsGroup[] = [
  GROUP_COLORS,
  GROUP_MARKS,
  GROUP_LABELS,
  GROUP_LEGEND,
  GROUP_NUMBERS,
  GROUP_CANVAS,
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

const BIND_VALUE_MULTIPLE: DataBinding = {
  role: "value",
  label: "数值系列",
  required: true,
  multiple: true,
  hint: "至少 1 个数值列",
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
    validate: (ctx) =>
      ctx.parsed.numericHeaders.length < 2 ? message : null,
  });

// Most templates only need rows + at least one numeric column.
const BASE_VALIDATORS: DataValidator[] = [requireRows, requireNumericColumn];

// --- The registry ----------------------------------------------------------
// All 20 templates are registered with their family renderer.

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
    dataBindings: [BIND_CATEGORY_SINGLE, BIND_X, BIND_Y],
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
};

export function getTemplateDefinition(type: ChartType): TemplateDefinition {
  return TEMPLATE_REGISTRY[type];
}

// buildWithRenderer is re-exported here so chart-model.ts can import both the
// registry query and the renderer entry point from a single module, keeping
// chart-model.ts's import list short.
export { buildWithRenderer };
