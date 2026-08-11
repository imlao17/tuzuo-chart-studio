"use client";

import type { ECharts } from "echarts";
import Image from "next/image";
import {
  AlertTriangle,
  AreaChart,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Columns3,
  FileUp,
  LayoutGrid,
  Lock,
  LockOpen,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCcw,
  Redo2,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  ChangeEvent,
  CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildChartOption,
  CHART_TEMPLATES,
  type ChartConfig,
  ChartType,
  INITIAL_TABLE,
  type LabelPosition,
  type LegendAlign,
  type LegendPosition,
  Margins,
  defaultLegendAlignForPosition,
  parseDelimitedTable,
  tableToParsed,
  THEMES,
} from "./chart-model";
import {
  type DataBindingRole,
  getTemplateDefinition,
} from "./template-definition";
import {
  downloadBlob,
  safeFilename,
} from "../src/studio/export/download";
import { AuthDialog } from "../src/studio/components/auth-dialog";
import { ConfirmDialog } from "../src/studio/components/confirm-dialog";
import { ExportToolbar } from "../src/studio/components/export-toolbar";
import {
  SettingsSection,
  Toggle,
} from "../src/studio/components/settings-controls";
import {
  ChartFamilyIcon,
  TemplateGallery,
} from "../src/studio/components/template-gallery";
import { TextStyleControls } from "../src/studio/components/text-style-controls";
import { useAuthSession } from "../src/studio/hooks/use-auth-session";
import { useCustomPalettes } from "../src/studio/hooks/use-custom-palettes";
import { usePngExport } from "../src/studio/hooks/use-png-export";
import { useProjectHistory } from "../src/studio/hooks/use-project-history";
import { useStudioLayout } from "../src/studio/hooks/use-studio-layout";
import { parseColorOverrides } from "../src/studio/palette/color-overrides";
import {
  DEFAULT_SETTINGS_OPEN,
  SETTINGS_SECTION_META,
  settingsSectionMatches,
  type SettingsSectionId,
} from "../src/studio/settings/registry";
import type {
  TextStyleState,
} from "../src/studio/types";

const DEFAULT_MARGINS: Margins = {
  top: 28,
  right: 32,
  bottom: 36,
  left: 38,
};
const CANVAS_WIDTH_BOUNDS = { min: 320, max: 2400 };
const CANVAS_HEIGHT_BOUNDS = { min: 240, max: 1800 };
const REQUIRE_AUTH_FOR_EXPORT =
  process.env.NEXT_PUBLIC_TUZUO_REQUIRE_AUTH === "true";

// Field role bindings: single-column roles map to a string, the multi-column
// `value` role maps to a string[] (selection order = render order). Missing
// roles are resolved with sensible fallbacks by `resolveFieldBindings`.
type FieldRoles = Partial<Record<DataBindingRole, string | string[]>>;

// A saved project: every editable field that defines a chart, excluding
// transient UI state (modals, toasts, export caches, search queries).
// `DEFAULT_PROJECT` is the single source of truth — collect/apply both
// derive from it so a field is never accidentally dropped.
type ProjectState = {
  tableData: string[][];
  chartType: ChartType;
  fieldRoles: FieldRoles;
  seriesKind: Record<string, "bar" | "line">;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  margins: Margins;
  transparent: boolean;
  backgroundColor: string;
  themeId: string;
  paletteColors: string[];
  colorOverridesText: string;
  showLabels: boolean;
  showLegend: boolean;
  showGrid: boolean;
  smooth: boolean;
  fontSize: number;
  labelColor: string;
  labelPosition: LabelPosition;
  legendPosition: LegendPosition;
  legendAlign: LegendAlign;
  showTooltip: boolean;
  gridLineType: "solid" | "dashed" | "dotted";
  lineWidth: number;
  pointSize: number;
  barWidth: number;
  barRadius: number;
  markOpacity: number;
  areaOpacity: number;
  showXAxis: boolean;
  showYAxis: boolean;
  xAxisTitle: string;
  yAxisTitle: string;
  axisLabelRotation: number;
  yAxisMin: string;
  yAxisMax: string;
  numberDecimals: number;
  numberPrefix: string;
  numberSuffix: string;
  useThousandsSeparator: boolean;
  titleAlign: "left" | "center" | "right";
  titleStyle: TextStyleState;
  subtitleStyle: TextStyleState;
  xAxisTitleStyle: TextStyleState;
  yAxisTitleStyle: TextStyleState;
  xAxisLabelStyle: TextStyleState;
  yAxisLabelStyle: TextStyleState;
  labelStyle: TextStyleState;
  sortCategories: { bySeries: string; order: "asc" | "desc" } | null;
  showStackTotals: boolean;
  stackOrder: "asc" | "desc" | null;
  barGap: number | null;
  barCategoryGap: number | null;
  connectNulls: boolean;
  endLabel: boolean;
  referenceBandsText: string;
  referenceLinesText: string;
  pieLabelContent: "value" | "percent" | "both" | null;
  donutInnerRadius: number | null;
  pieSort: "asc" | "desc" | null;
  startAngle: number | null;
  pieOtherThreshold: number | null;
  sizeColumn: string | null;
  colorColumn: string | null;
  shapeColumn: string | null;
  scatterTrendLine: boolean;
  comboDualAxis: boolean;
  y2AxisTitle: string;
  comboAxisSync: boolean;
  streamTimeAxis: boolean;
};

// Single source of truth for project defaults. collectProject / applyProject
// both reference this so a field is never dropped, and partial/old project
// files fall back to these values for any missing key.
const DEFAULT_PROJECT: ProjectState = {
  tableData: INITIAL_TABLE.map((row) => [...row]),
  chartType: "groupedColumn",
  fieldRoles: { category: "月份", value: ["实际收入", "目标"] },
  seriesKind: {},
  title: "上半年收入趋势",
  subtitle: "单位：万元",
  width: 960,
  height: 540,
  margins: { ...DEFAULT_MARGINS },
  transparent: true,
  backgroundColor: "#ffffff",
  themeId: "editorial",
  paletteColors: [...THEMES[0].colors],
  colorOverridesText: "",
  showLabels: true,
  showLegend: true,
  showGrid: true,
  smooth: true,
  fontSize: 14,
  labelColor: "",
  labelPosition: "auto",
  legendPosition: "top",
  legendAlign: defaultLegendAlignForPosition("top"),
  showTooltip: true,
  gridLineType: "dashed",
  lineWidth: 3,
  pointSize: 7,
  barWidth: 48,
  barRadius: 3,
  markOpacity: 100,
  areaOpacity: 22,
  showXAxis: true,
  showYAxis: true,
  xAxisTitle: "",
  yAxisTitle: "",
  axisLabelRotation: 0,
  yAxisMin: "",
  yAxisMax: "",
  numberDecimals: 0,
  numberPrefix: "",
  numberSuffix: "",
  useThousandsSeparator: true,
  titleAlign: "left",
  titleStyle: { fontSize: 24, color: "", bold: true, italic: false },
  subtitleStyle: { fontSize: 13, color: "#68727d", bold: false, italic: false },
  xAxisTitleStyle: { fontSize: 14, color: "", bold: false, italic: false },
  yAxisTitleStyle: { fontSize: 14, color: "", bold: false, italic: false },
  xAxisLabelStyle: { fontSize: 14, color: "", bold: false, italic: false },
  yAxisLabelStyle: { fontSize: 14, color: "", bold: false, italic: false },
  labelStyle: { fontSize: 14, color: "", bold: false, italic: false },
  sortCategories: null,
  showStackTotals: false,
  stackOrder: null,
  barGap: null,
  barCategoryGap: null,
  connectNulls: false,
  endLabel: false,
  referenceBandsText: "",
  referenceLinesText: "",
  pieLabelContent: null,
  donutInnerRadius: null,
  pieSort: null,
  startAngle: null,
  pieOtherThreshold: null,
  sizeColumn: null,
  colorColumn: null,
  shapeColumn: null,
  scatterTrendLine: false,
  comboDualAxis: false,
  y2AxisTitle: "",
  comboAxisSync: false,
  streamTimeAxis: false,
};

const PROJECT_STORAGE_KEY = "tuzuo-current-project";
const PROJECT_FILE_APP = "tuzuo-chart-studio";
const PROJECT_FILE_VERSION = 1;
const CHART_TYPE_IDS = new Set<ChartType>(
  CHART_TEMPLATES.map((template) => template.id),
);
const LINE_WIDTH_CONTROL_TYPES = new Set<ChartType>([
  "line",
  "smoothLine",
  "stepLine",
  "area",
  "stackedArea",
  "proportionalArea",
  "combo",
  "radar",
]);
const SMOOTH_CONTROL_TYPES = new Set<ChartType>(["line", "area", "combo"]);
const LINE_AREA_EXTRA_CONTROL_TYPES = new Set<ChartType>([
  "line",
  "smoothLine",
  "stepLine",
  "area",
  "stackedArea",
  "proportionalArea",
]);
const LINE_END_LABEL_TYPES = new Set<ChartType>([
  "line",
  "smoothLine",
  "stepLine",
]);
const POINT_SIZE_CONTROL_TYPES = new Set<ChartType>([
  "line",
  "smoothLine",
  "stepLine",
  "area",
  "stackedArea",
  "proportionalArea",
  "combo",
  "scatter",
  "dotPlot",
  "radar",
]);
const BAR_SHAPE_CONTROL_TYPES = new Set<ChartType>([
  "bar",
  "stackedBar",
  "proportionalBar",
  "column",
  "groupedColumn",
  "stackedColumn",
  "proportionalColumn",
  "combo",
  "divergingBar",
  "populationPyramid",
  "waterfall",
]);
const AREA_OPACITY_CONTROL_TYPES = new Set<ChartType>([
  "area",
  "stackedArea",
  "proportionalArea",
  "radar",
]);
const MARK_OPACITY_CONTROL_TYPES = new Set<ChartType>([
  "line",
  "smoothLine",
  "stepLine",
  "area",
  "stackedArea",
  "proportionalArea",
  "bar",
  "stackedBar",
  "proportionalBar",
  "column",
  "groupedColumn",
  "stackedColumn",
  "proportionalColumn",
  "combo",
  "scatter",
  "divergingBar",
  "populationPyramid",
  "dotPlot",
  "waterfall",
  "pie",
  "donut",
  "treemap",
  "funnel",
  "sankey",
]);
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const LABEL_POSITION_VALUES = [
  "auto",
  "outside",
  "outsideTop",
  "outsideRight",
  "outsideBottom",
  "outsideLeft",
  "inside",
  "insideCenter",
  "insideLeft",
  "insideRight",
  "insideTop",
  "insideBottom",
] as const;
const LABEL_POSITION_OPTIONS: Array<{ value: LabelPosition; label: string }> = [
  { value: "auto", label: "自动" },
  { value: "outside", label: "外侧默认" },
  { value: "outsideTop", label: "外侧上方" },
  { value: "outsideRight", label: "外侧右侧" },
  { value: "outsideBottom", label: "外侧下方" },
  { value: "outsideLeft", label: "外侧左侧" },
  { value: "inside", label: "内部默认" },
  { value: "insideCenter", label: "内部居中" },
  { value: "insideLeft", label: "内部左侧" },
  { value: "insideRight", label: "内部右侧" },
  { value: "insideTop", label: "内部上方" },
  { value: "insideBottom", label: "内部下方" },
];
const LEGEND_POSITION_VALUES = ["top", "bottom", "left", "right"] as const;
const LEGEND_ALIGN_VALUES = ["start", "center", "end"] as const;
const LEGEND_HORIZONTAL_ALIGN_OPTIONS: Array<{
  value: LegendAlign;
  label: string;
}> = [
  { value: "start", label: "靠左" },
  { value: "center", label: "居中" },
  { value: "end", label: "靠右" },
];
const LEGEND_VERTICAL_ALIGN_OPTIONS: Array<{
  value: LegendAlign;
  label: string;
}> = [
  { value: "start", label: "靠上" },
  { value: "center", label: "居中" },
  { value: "end", label: "靠下" },
];
const GRID_LINE_VALUES = ["solid", "dashed", "dotted"] as const;
const TITLE_ALIGN_VALUES = ["left", "center", "right"] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;
const PIE_LABEL_VALUES = ["value", "percent", "both"] as const;
const SERIES_KIND_VALUES = ["bar", "line"] as const;

type ProjectFile = {
  app: typeof PROJECT_FILE_APP;
  version: number;
  savedAt: string;
  project: ProjectState;
};

function cloneFieldRoles(roles: FieldRoles): FieldRoles {
  return Object.fromEntries(
    Object.entries(roles).map(([role, value]) => [
      role,
      Array.isArray(value) ? [...value] : value,
    ]),
  ) as FieldRoles;
}

function cloneProject(project: ProjectState = DEFAULT_PROJECT): ProjectState {
  return {
    ...project,
    tableData: project.tableData.map((row) => [...row]),
    fieldRoles: cloneFieldRoles(project.fieldRoles),
    seriesKind: { ...project.seriesKind },
    margins: { ...project.margins },
    paletteColors: [...project.paletteColors],
    titleStyle: { ...project.titleStyle },
    subtitleStyle: { ...project.subtitleStyle },
    xAxisTitleStyle: { ...project.xAxisTitleStyle },
    yAxisTitleStyle: { ...project.yAxisTitleStyle },
    xAxisLabelStyle: { ...project.xAxisLabelStyle },
    yAxisLabelStyle: { ...project.yAxisLabelStyle },
    labelStyle: { ...project.labelStyle },
    sortCategories: project.sortCategories
      ? { ...project.sortCategories }
      : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isChartType(value: unknown): value is ChartType {
  return typeof value === "string" && CHART_TYPE_IDS.has(value as ChartType);
}

function textValue(value: unknown, fallback: string) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function optionalTextValue(value: unknown, fallback: string | null) {
  if (value === null || value === "") return null;
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberCandidate(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
}

function boundedNumber(
  value: unknown,
  fallback: number,
  {
    min,
    max,
    integer,
  }: { min?: number; max?: number; integer?: boolean } = {},
) {
  const candidate = numberCandidate(value);
  if (!Number.isFinite(candidate)) return fallback;
  let next = integer ? Math.round(candidate) : candidate;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function canvasDimensionValue(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
) {
  return boundedNumber(value, fallback, {
    ...bounds,
    integer: true,
  });
}

function nullableBoundedNumber(
  value: unknown,
  fallback: number | null,
  bounds: { min?: number; max?: number; integer?: boolean } = {},
) {
  if (value === null || value === "") return null;
  const candidate = numberCandidate(value);
  if (!Number.isFinite(candidate)) return fallback;
  return boundedNumber(candidate, fallback ?? 0, bounds);
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
) {
  return typeof value === "string" &&
    (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function nullableOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T | null,
) {
  if (value === null || value === "") return null;
  return typeof value === "string" &&
    (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function colorValue(value: unknown, fallback: string) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value
    : fallback;
}

function normalizeTableData(
  value: unknown,
  fallback: ProjectState["tableData"],
) {
  if (!Array.isArray(value)) return fallback.map((row) => [...row]);
  const rows = value
    .filter(Array.isArray)
    .map((row) => row.map((cell) => String(cell ?? "")))
    .filter((row) => row.length > 0);
  return rows.length ? rows : fallback.map((row) => [...row]);
}

function normalizeFieldRoles(value: unknown, fallback: FieldRoles) {
  if (!isRecord(value)) return cloneFieldRoles(fallback);
  const normalized: FieldRoles = {};
  for (const [role, bound] of Object.entries(value)) {
    if (typeof bound === "string") {
      normalized[role as DataBindingRole] = bound;
      continue;
    }
    if (Array.isArray(bound)) {
      const columns = bound
        .filter((column): column is string => typeof column === "string")
        .filter(Boolean);
      if (columns.length) normalized[role as DataBindingRole] = columns;
    }
  }
  return Object.keys(normalized).length ? normalized : cloneFieldRoles(fallback);
}

function normalizeSeriesKind(
  value: unknown,
  fallback: ProjectState["seriesKind"],
) {
  if (!isRecord(value)) return { ...fallback };
  const normalized: ProjectState["seriesKind"] = {};
  for (const [series, kind] of Object.entries(value)) {
    if (
      typeof series === "string" &&
      typeof kind === "string" &&
      (SERIES_KIND_VALUES as readonly string[]).includes(kind)
    ) {
      normalized[series] = kind as "bar" | "line";
    }
  }
  return normalized;
}

function normalizeMargins(value: unknown, fallback: Margins) {
  const source = isRecord(value) ? value : {};
  return {
    top: boundedNumber(source.top, fallback.top, { min: 0, max: 240 }),
    right: boundedNumber(source.right, fallback.right, { min: 0, max: 240 }),
    bottom: boundedNumber(source.bottom, fallback.bottom, {
      min: 0,
      max: 240,
    }),
    left: boundedNumber(source.left, fallback.left, { min: 0, max: 240 }),
  };
}

function textStyleColorValue(value: unknown, fallback: string) {
  if (value === "" || value === null || value === undefined) return "";
  return colorValue(value, fallback);
}

function normalizeTextStyle(
  value: unknown,
  fallback: TextStyleState,
  legacy: {
    fontSize?: unknown;
    color?: unknown;
    bold?: unknown;
    italic?: unknown;
  } = {},
) {
  const source = isRecord(value) ? value : {};
  return {
    fontSize: boundedNumber(source.fontSize ?? legacy.fontSize, fallback.fontSize, {
      min: 8,
      max: 56,
      integer: true,
    }),
    color: textStyleColorValue(source.color ?? legacy.color, fallback.color),
    bold: booleanValue(source.bold ?? legacy.bold, fallback.bold),
    italic: booleanValue(source.italic ?? legacy.italic, fallback.italic),
  };
}

function normalizeSortCategories(value: unknown) {
  if (!isRecord(value) || typeof value.bySeries !== "string") return null;
  const order = oneOf(value.order, SORT_ORDER_VALUES, "asc");
  return { bySeries: value.bySeries, order };
}

function normalizePaletteColors(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return [...fallback];
  const colors = value
    .map((color) => String(color))
    .filter((color) => HEX_COLOR_PATTERN.test(color));
  return colors.length ? colors : [...fallback];
}

function normalizeProject(input: unknown): ProjectState | null {
  const source =
    isRecord(input) && isRecord(input.project) ? input.project : input;
  if (!isRecord(source)) return null;

  const base = cloneProject();
  const chartType = isChartType(source.chartType)
    ? source.chartType
    : base.chartType;
  const legendPosition = oneOf(
    source.legendPosition,
    LEGEND_POSITION_VALUES,
    base.legendPosition,
  );
  const legendAlign = oneOf(
    source.legendAlign,
    LEGEND_ALIGN_VALUES,
    defaultLegendAlignForPosition(legendPosition),
  );

  return {
    tableData: normalizeTableData(source.tableData, base.tableData),
    chartType,
    fieldRoles: normalizeFieldRoles(source.fieldRoles, base.fieldRoles),
    seriesKind: normalizeSeriesKind(source.seriesKind, base.seriesKind),
    title: textValue(source.title, base.title),
    subtitle: textValue(source.subtitle, base.subtitle),
    width: canvasDimensionValue(source.width, base.width, CANVAS_WIDTH_BOUNDS),
    height: canvasDimensionValue(source.height, base.height, CANVAS_HEIGHT_BOUNDS),
    margins: normalizeMargins(source.margins, base.margins),
    transparent: booleanValue(source.transparent, base.transparent),
    backgroundColor: colorValue(source.backgroundColor, base.backgroundColor),
    themeId: textValue(source.themeId, base.themeId),
    paletteColors: normalizePaletteColors(
      source.paletteColors,
      base.paletteColors,
    ),
    colorOverridesText: textValue(
      source.colorOverridesText,
      base.colorOverridesText,
    ),
    showLabels: booleanValue(source.showLabels, base.showLabels),
    showLegend: booleanValue(source.showLegend, base.showLegend),
    showGrid: booleanValue(source.showGrid, base.showGrid),
    smooth: booleanValue(source.smooth, base.smooth),
    fontSize: boundedNumber(source.fontSize, base.fontSize, {
      min: 10,
      max: 20,
      integer: true,
    }),
    labelColor: colorValue(source.labelColor, base.labelColor),
    labelPosition: oneOf(
      source.labelPosition,
      LABEL_POSITION_VALUES,
      base.labelPosition,
    ),
    legendPosition,
    legendAlign,
    showTooltip: booleanValue(source.showTooltip, base.showTooltip),
    gridLineType: oneOf(
      source.gridLineType,
      GRID_LINE_VALUES,
      base.gridLineType,
    ),
    lineWidth: boundedNumber(source.lineWidth, base.lineWidth, {
      min: 1,
      max: 12,
    }),
    pointSize: boundedNumber(source.pointSize, base.pointSize, {
      min: 0,
      max: 24,
    }),
    barWidth: boundedNumber(source.barWidth, base.barWidth, {
      min: 8,
      max: 96,
    }),
    barRadius: boundedNumber(source.barRadius, base.barRadius, {
      min: 0,
      max: 24,
    }),
    markOpacity: boundedNumber(source.markOpacity, base.markOpacity, {
      min: 10,
      max: 100,
    }),
    areaOpacity: boundedNumber(source.areaOpacity, base.areaOpacity, {
      min: 5,
      max: 100,
    }),
    showXAxis: booleanValue(source.showXAxis, base.showXAxis),
    showYAxis: booleanValue(source.showYAxis, base.showYAxis),
    xAxisTitle: textValue(source.xAxisTitle, base.xAxisTitle),
    yAxisTitle: textValue(source.yAxisTitle, base.yAxisTitle),
    axisLabelRotation: boundedNumber(
      source.axisLabelRotation,
      base.axisLabelRotation,
      { min: -90, max: 90, integer: true },
    ),
    yAxisMin: textValue(source.yAxisMin, base.yAxisMin),
    yAxisMax: textValue(source.yAxisMax, base.yAxisMax),
    numberDecimals: boundedNumber(
      source.numberDecimals,
      base.numberDecimals,
      { min: 0, max: 4, integer: true },
    ),
    numberPrefix: textValue(source.numberPrefix, base.numberPrefix),
    numberSuffix: textValue(source.numberSuffix, base.numberSuffix),
    useThousandsSeparator: booleanValue(
      source.useThousandsSeparator,
      base.useThousandsSeparator,
    ),
    titleAlign: oneOf(source.titleAlign, TITLE_ALIGN_VALUES, base.titleAlign),
    titleStyle: normalizeTextStyle(source.titleStyle, base.titleStyle),
    subtitleStyle: normalizeTextStyle(source.subtitleStyle, base.subtitleStyle),
    xAxisTitleStyle: normalizeTextStyle(
      source.xAxisTitleStyle,
      base.xAxisTitleStyle,
      isRecord(source.axisTitleStyle) ? source.axisTitleStyle : {},
    ),
    yAxisTitleStyle: normalizeTextStyle(
      source.yAxisTitleStyle,
      base.yAxisTitleStyle,
      isRecord(source.axisTitleStyle) ? source.axisTitleStyle : {},
    ),
    xAxisLabelStyle: normalizeTextStyle(
      source.xAxisLabelStyle,
      base.xAxisLabelStyle,
      isRecord(source.axisLabelStyle) ? source.axisLabelStyle : {},
    ),
    yAxisLabelStyle: normalizeTextStyle(
      source.yAxisLabelStyle,
      base.yAxisLabelStyle,
      isRecord(source.axisLabelStyle) ? source.axisLabelStyle : {},
    ),
    labelStyle: normalizeTextStyle(source.labelStyle, base.labelStyle, {
      fontSize: source.fontSize,
      color: source.labelColor,
    }),
    sortCategories: normalizeSortCategories(source.sortCategories),
    showStackTotals: booleanValue(
      source.showStackTotals,
      base.showStackTotals,
    ),
    stackOrder: nullableOneOf(
      source.stackOrder,
      SORT_ORDER_VALUES,
      base.stackOrder,
    ),
    barGap: nullableBoundedNumber(source.barGap, base.barGap, {
      min: 0,
      max: 100,
    }),
    barCategoryGap: nullableBoundedNumber(
      source.barCategoryGap,
      base.barCategoryGap,
      { min: 0, max: 80 },
    ),
    connectNulls: booleanValue(source.connectNulls, base.connectNulls),
    endLabel: booleanValue(source.endLabel, base.endLabel),
    referenceBandsText: textValue(
      source.referenceBandsText,
      base.referenceBandsText,
    ),
    referenceLinesText: textValue(
      source.referenceLinesText,
      base.referenceLinesText,
    ),
    pieLabelContent: nullableOneOf(
      source.pieLabelContent,
      PIE_LABEL_VALUES,
      base.pieLabelContent,
    ),
    donutInnerRadius: nullableBoundedNumber(
      source.donutInnerRadius,
      base.donutInnerRadius,
      { min: 0, max: 0.9 },
    ),
    pieSort: nullableOneOf(source.pieSort, SORT_ORDER_VALUES, base.pieSort),
    startAngle: nullableBoundedNumber(source.startAngle, base.startAngle, {
      min: 0,
      max: 360,
    }),
    pieOtherThreshold: nullableBoundedNumber(
      source.pieOtherThreshold,
      base.pieOtherThreshold,
      { min: 0, max: 20 },
    ),
    sizeColumn: optionalTextValue(source.sizeColumn, base.sizeColumn),
    colorColumn: optionalTextValue(source.colorColumn, base.colorColumn),
    shapeColumn: optionalTextValue(source.shapeColumn, base.shapeColumn),
    scatterTrendLine: booleanValue(
      source.scatterTrendLine,
      base.scatterTrendLine,
    ),
    comboDualAxis: booleanValue(source.comboDualAxis, base.comboDualAxis),
    y2AxisTitle: textValue(source.y2AxisTitle, base.y2AxisTitle),
    comboAxisSync: booleanValue(source.comboAxisSync, base.comboAxisSync),
    streamTimeAxis: booleanValue(source.streamTimeAxis, base.streamTimeAxis),
  };
}

export default function Home() {
  const [tableData, setTableData] = useState<string[][]>(() =>
    DEFAULT_PROJECT.tableData.map((row) => [...row]),
  );
  const [chartType, setChartType] = useState<ChartType>(
    DEFAULT_PROJECT.chartType,
  );
  const [workspaceMode, setWorkspaceMode] = useState<"preview" | "data">(
    "preview",
  );
  const [templateOpen, setTemplateOpen] = useState(false);
  const [title, setTitle] = useState(DEFAULT_PROJECT.title);
  const [subtitle, setSubtitle] = useState(DEFAULT_PROJECT.subtitle);
  const [width, setWidth] = useState(DEFAULT_PROJECT.width);
  const [height, setHeight] = useState(DEFAULT_PROJECT.height);
  const [widthInput, setWidthInput] = useState(String(DEFAULT_PROJECT.width));
  const [heightInput, setHeightInput] = useState(String(DEFAULT_PROJECT.height));
  const [fieldRoles, setFieldRoles] = useState<FieldRoles>(() =>
    cloneFieldRoles(DEFAULT_PROJECT.fieldRoles),
  );
  // Combo chart only: per-series bar/line role. Empty = renderer falls back to
  // the legacy rule (first series bar, rest line), so default output is stable.
  const [seriesKind, setSeriesKind] = useState<
    Record<string, "bar" | "line">
  >(() => ({ ...DEFAULT_PROJECT.seriesKind }));
  const [themeId, setThemeId] = useState(DEFAULT_PROJECT.themeId);
  const [paletteColors, setPaletteColors] = useState<string[]>([
    ...DEFAULT_PROJECT.paletteColors,
  ]);
  // Guards the auto-save/restore effect so the initial render's defaults
  // aren't written to localStorage before the saved project is restored.
  const [projectLoaded, setProjectLoaded] = useState(false);
  const projectStorageWarningRef = useRef(false);
  const [colorOverridesText, setColorOverridesText] = useState(
    DEFAULT_PROJECT.colorOverridesText,
  );
  const [transparent, setTransparent] = useState(DEFAULT_PROJECT.transparent);
  const [backgroundColor, setBackgroundColor] = useState(
    DEFAULT_PROJECT.backgroundColor,
  );
  const [margins, setMargins] = useState<Margins>({
    ...DEFAULT_PROJECT.margins,
  });
  const [marginsLinked, setMarginsLinked] = useState(false);
  const [showLabels, setShowLabels] = useState(DEFAULT_PROJECT.showLabels);
  const [showLegend, setShowLegend] = useState(DEFAULT_PROJECT.showLegend);
  const [showGrid, setShowGrid] = useState(DEFAULT_PROJECT.showGrid);
  const [smooth, setSmooth] = useState(DEFAULT_PROJECT.smooth);
  const [titleStyle, setTitleStyle] = useState<TextStyleState>({
    ...DEFAULT_PROJECT.titleStyle,
  });
  const [subtitleStyle, setSubtitleStyle] = useState<TextStyleState>({
    ...DEFAULT_PROJECT.subtitleStyle,
  });
  const [xAxisTitleStyle, setXAxisTitleStyle] = useState<TextStyleState>({
    ...DEFAULT_PROJECT.xAxisTitleStyle,
  });
  const [yAxisTitleStyle, setYAxisTitleStyle] = useState<TextStyleState>({
    ...DEFAULT_PROJECT.yAxisTitleStyle,
  });
  const [xAxisLabelStyle, setXAxisLabelStyle] = useState<TextStyleState>({
    ...DEFAULT_PROJECT.xAxisLabelStyle,
  });
  const [yAxisLabelStyle, setYAxisLabelStyle] = useState<TextStyleState>({
    ...DEFAULT_PROJECT.yAxisLabelStyle,
  });
  const [lineWidth, setLineWidth] = useState(DEFAULT_PROJECT.lineWidth);
  const [pointSize, setPointSize] = useState(DEFAULT_PROJECT.pointSize);
  const [barWidth, setBarWidth] = useState(DEFAULT_PROJECT.barWidth);
  const [barRadius, setBarRadius] = useState(DEFAULT_PROJECT.barRadius);
  // P1-1 bar deepening: category sort, stack totals, stack order, group gaps.
  // Empty = renderer default (no sort / no totals / ECharts default spacing).
  const [sortCategories, setSortCategories] = useState<
    { bySeries: string; order: "asc" | "desc" } | null
  >(DEFAULT_PROJECT.sortCategories);
  const [showStackTotals, setShowStackTotals] = useState(
    DEFAULT_PROJECT.showStackTotals,
  );
  const [stackOrder, setStackOrder] = useState<"asc" | "desc" | null>(
    DEFAULT_PROJECT.stackOrder,
  );
  const [barGap, setBarGap] = useState<number | null>(DEFAULT_PROJECT.barGap);
  const [barCategoryGap, setBarCategoryGap] = useState<number | null>(
    DEFAULT_PROJECT.barCategoryGap,
  );
  const [markOpacity, setMarkOpacity] = useState(DEFAULT_PROJECT.markOpacity);
  const [areaOpacity, setAreaOpacity] = useState(DEFAULT_PROJECT.areaOpacity);
  // P1-2 line/area deepening. All default to off/empty = renderer unchanged.
  const [connectNulls, setConnectNulls] = useState(
    DEFAULT_PROJECT.connectNulls,
  );
  const [endLabel, setEndLabel] = useState(DEFAULT_PROJECT.endLabel);
  const [referenceBandsText, setReferenceBandsText] = useState(
    DEFAULT_PROJECT.referenceBandsText,
  );
  const [referenceLinesText, setReferenceLinesText] = useState(
    DEFAULT_PROJECT.referenceLinesText,
  );
  // P1-3 pie/donut deepening. All default to off/undefined = renderer unchanged.
  const [pieLabelContent, setPieLabelContent] = useState<
    "value" | "percent" | "both" | null
  >(DEFAULT_PROJECT.pieLabelContent);
  const [donutInnerRadius, setDonutInnerRadius] = useState<number | null>(
    DEFAULT_PROJECT.donutInnerRadius,
  );
  const [pieSort, setPieSort] = useState<"asc" | "desc" | null>(
    DEFAULT_PROJECT.pieSort,
  );
  const [startAngle, setStartAngle] = useState<number | null>(
    DEFAULT_PROJECT.startAngle,
  );
  const [pieOtherThreshold, setPieOtherThreshold] = useState<number | null>(
    DEFAULT_PROJECT.pieOtherThreshold,
  );
  // P1-4 scatter deepening. All default to unset = single global style.
  const [sizeColumn, setSizeColumn] = useState<string | null>(
    DEFAULT_PROJECT.sizeColumn,
  );
  const [colorColumn, setColorColumn] = useState<string | null>(
    DEFAULT_PROJECT.colorColumn,
  );
  const [shapeColumn, setShapeColumn] = useState<string | null>(
    DEFAULT_PROJECT.shapeColumn,
  );
  const [scatterTrendLine, setScatterTrendLine] = useState(
    DEFAULT_PROJECT.scatterTrendLine,
  );
  // P1-5 combo dual Y axis. All default to off/empty = renderer unchanged.
  const [comboDualAxis, setComboDualAxis] = useState(
    DEFAULT_PROJECT.comboDualAxis,
  );
  const [y2AxisTitle, setY2AxisTitle] = useState(
    DEFAULT_PROJECT.y2AxisTitle,
  );
  const [comboAxisSync, setComboAxisSync] = useState(
    DEFAULT_PROJECT.comboAxisSync,
  );
  // P1-6 streamgraph time axis. Default off = row-index axis (unchanged).
  const [streamTimeAxis, setStreamTimeAxis] = useState(
    DEFAULT_PROJECT.streamTimeAxis,
  );
  const [labelStyle, setLabelStyle] = useState<TextStyleState>({
    ...DEFAULT_PROJECT.labelStyle,
  });
  const [labelPosition, setLabelPosition] = useState<LabelPosition>(
    DEFAULT_PROJECT.labelPosition,
  );
  const [showXAxis, setShowXAxis] = useState(DEFAULT_PROJECT.showXAxis);
  const [showYAxis, setShowYAxis] = useState(DEFAULT_PROJECT.showYAxis);
  const [xAxisTitle, setXAxisTitle] = useState(DEFAULT_PROJECT.xAxisTitle);
  const [yAxisTitle, setYAxisTitle] = useState(DEFAULT_PROJECT.yAxisTitle);
  const [axisLabelRotation, setAxisLabelRotation] = useState(
    DEFAULT_PROJECT.axisLabelRotation,
  );
  const [yAxisMin, setYAxisMin] = useState(DEFAULT_PROJECT.yAxisMin);
  const [yAxisMax, setYAxisMax] = useState(DEFAULT_PROJECT.yAxisMax);
  const [legendPosition, setLegendPosition] = useState<LegendPosition>(
    DEFAULT_PROJECT.legendPosition,
  );
  const [legendAlign, setLegendAlign] = useState<LegendAlign>(
    DEFAULT_PROJECT.legendAlign,
  );
  const [showTooltip, setShowTooltip] = useState(DEFAULT_PROJECT.showTooltip);
  const [gridLineType, setGridLineType] = useState<
    "solid" | "dashed" | "dotted"
  >(DEFAULT_PROJECT.gridLineType);
  const [numberDecimals, setNumberDecimals] = useState(
    DEFAULT_PROJECT.numberDecimals,
  );
  const [numberPrefix, setNumberPrefix] = useState(
    DEFAULT_PROJECT.numberPrefix,
  );
  const [numberSuffix, setNumberSuffix] = useState(
    DEFAULT_PROJECT.numberSuffix,
  );
  const [useThousandsSeparator, setUseThousandsSeparator] = useState(
    DEFAULT_PROJECT.useThousandsSeparator,
  );
  const [titleAlign, setTitleAlign] = useState<"left" | "center" | "right">(
    DEFAULT_PROJECT.titleAlign,
  );
  const [settingsQuery, setSettingsQuery] = useState("");
  const [settingsOpen, setSettingsOpen] =
    useState<Record<SettingsSectionId, boolean>>(DEFAULT_SETTINGS_OPEN);
  const [pixelRatio, setPixelRatio] = useState(2);
  const [fitPreviewScale, setFitPreviewScale] = useState(1);
  const [previewScaleOverride, setPreviewScaleOverride] = useState<number | null>(
    null,
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [saveState, setSaveState] = useState("正在恢复");
  const {
    leftPanelCollapsed,
    rightPanelCollapsed,
    leftPanelWidth,
    rightPanelWidth,
    dataPanelHeight,
    isNarrowViewport,
    togglePanel,
    closePanels,
    startPanelResize,
    startDataResize,
  } = useStudioLayout();
  const {
    customPalettes,
    editingPaletteId,
    setEditingPaletteId,
    paletteName,
    setPaletteName,
    selectSavedPalette,
    editSavedPalette,
    movePaletteColor,
    addPaletteColor,
    removePaletteColor,
    saveCurrentPalette,
    deleteSavedPalette,
  } = useCustomPalettes({
    paletteColors,
    setPaletteColors,
    themeId,
    setThemeId,
    setStatus,
    defaultColors: THEMES[0].colors,
  });
  const {
    authUser,
    authLoading,
    authPanelOpen,
    setAuthPanelOpen,
    authMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authMessage,
    authVerificationUrl,
    authSubmitting,
    openAuthPanel,
    requireDownloadAuth,
    submitAuthForm,
    logout,
  } = useAuthSession({
    requireAuthForExport: REQUIRE_AUTH_FOR_EXPORT,
    setStatus,
  });

  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const settingsPanelRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const applyProjectRef = useRef<
    ((project: ProjectState, message?: string) => void) | null
  >(null);
  const currentProject = collectProject();
  const currentProjectFingerprint = JSON.stringify(currentProject);
  const { canUndo, canRedo, undo, redo, applyCheckpoint } = useProjectHistory({
    snapshot: currentProject,
    fingerprint: currentProjectFingerprint,
    enabled: projectLoaded,
    applySnapshot: (project, message) =>
      applyProjectRef.current?.(project, message),
  });

  const parsed = useMemo(() => tableToParsed(tableData), [tableData]);
  const colorOverrides = useMemo(
    () => parseColorOverrides(colorOverridesText),
    [colorOverridesText],
  );
  const primaryColor = paletteColors[0] ?? THEMES[0].colors[0];
  const secondaryColor = paletteColors[1] ?? primaryColor;
  const theme =
    THEMES.find((candidate) => candidate.id === themeId) ?? THEMES[0];
  const selectedTemplate =
    CHART_TEMPLATES.find((template) => template.id === chartType) ??
    CHART_TEMPLATES[0];
  const templateDefinition = getTemplateDefinition(chartType);

  // Whether the current table data matches this template's sample data. Used
  // to decide whether to nudge the user toward "加载示例" after switching
  // templates (e.g. monthly-revenue data on a pie chart looks wrong but isn't
  // a validation error, so we hint instead of blocking).
  const dataMatchesSample = useMemo(() => {
    const sample = templateDefinition.sampleData.table;
    if (tableData.length !== sample.length) return false;
    return tableData.every(
      (row, r) =>
        row.length === sample[r].length &&
        row.every((cell, c) => cell === sample[r][c]),
    );
  }, [tableData, templateDefinition.sampleData.table]);

  // Resolve the user's field-role bindings into the categoryColumn +
  // seriesColumns shape the renderers still consume. This is the single
  // adapter that lets the UI be role-driven while the renderers stay
  // unchanged. Behavior matches the legacy selectedCategory/effectiveSeries
  // fallbacks for the generic templates, and the per-template selectedColumns
  // fallbacks for scatter (X/Y) and diverging (left/right).
  const { categoryColumn, seriesColumns, sourceColumn, targetColumn, resolvedRoles } = useMemo(() => {
    const headers = parsed.headers;
    const numeric = parsed.numericHeaders;
    const firstNumeric = numeric[0] ?? "";

    const resolveCategory = () => {
      const bound = fieldRoles.category;
      if (typeof bound === "string" && headers.includes(bound)) return bound;
      return (
        headers.find((h) => !numeric.includes(h)) ?? headers[0] ?? ""
      );
    };

    const resolveSingle = (
      role: DataBindingRole,
      fallbackIndex: number,
    ): string => {
      const bound = fieldRoles[role];
      if (typeof bound === "string" && numeric.includes(bound)) return bound;
      return numeric[fallbackIndex] ?? firstNumeric;
    };

    const resolveHeader = (
      role: DataBindingRole,
      fallback: string,
    ): string => {
      const bound = fieldRoles[role];
      if (typeof bound === "string" && headers.includes(bound)) return bound;
      return fallback;
    };

    const categoryColumn = resolveCategory();
    // Per-role resolved values, so the single-column <select>s can display
    // exactly what the renderer will receive (including fallbacks), instead of
    // a raw (possibly undefined) binding that drifts from the rendered chart.
    const resolvedRoles: Partial<Record<DataBindingRole, string>> = {
      category: categoryColumn,
    };

    // Inspect the template's declared roles to decide how to assemble the
    // series columns. Each template family maps cleanly to one case.
    const roles = new Set(templateDefinition.dataBindings.map((b) => b.role));
    let seriesColumns: string[];
    let sourceColumn: string | undefined;
    let targetColumn: string | undefined;
    if (roles.has("source") || roles.has("target")) {
      const firstText = headers.find((h) => !numeric.includes(h)) ?? headers[0] ?? "";
      const secondText =
        headers.find((h) => h !== firstText && !numeric.includes(h)) ??
        headers.find((h) => h !== firstText) ??
        firstText;
      const source = resolveHeader("source", firstText);
      const target = resolveHeader("target", secondText);
      const value = resolveSingle("value", 0);
      sourceColumn = source;
      targetColumn = target;
      seriesColumns = [value];
      resolvedRoles.source = source;
      resolvedRoles.target = target;
      resolvedRoles.value = value;
    } else if (roles.has("x") || roles.has("y")) {
      // scatter: X then Y, mirroring the renderer's selectedColumns[0]/[1].
      const x = resolveSingle("x", 0);
      const y = resolveSingle("y", 1) || x;
      seriesColumns = [x, y];
      resolvedRoles.x = x;
      resolvedRoles.y = y;
    } else if (roles.has("leftValue") || roles.has("rightValue")) {
      // diverging / pyramid: left then right, mirroring dataSeries[0]/[1].
      const left = resolveSingle("leftValue", 0);
      const right = resolveSingle("rightValue", 1) || left;
      seriesColumns = [left, right];
      resolvedRoles.leftValue = left;
      resolvedRoles.rightValue = right;
    } else {
      // generic multi-series templates: value role, selection order preserved.
      const selected = (fieldRoles.value as string[] | undefined)?.filter(
        (header) => numeric.includes(header),
      ) ?? [];
      seriesColumns = selected.length ? selected : numeric.slice(0, 1);
    }

    return { categoryColumn, seriesColumns, sourceColumn, targetColumn, resolvedRoles };
  }, [
    fieldRoles,
    parsed.headers,
    parsed.numericHeaders,
    templateDefinition.dataBindings,
  ]);

  // P1-2 reference marks: parse the text inputs into structured arrays.
  // Bands: one per line as "start,end" or "start,end,label".
  // Lines: one per line as "value" or "value,label".
  type ReferenceBand = NonNullable<ChartConfig["referenceBands"]>[number];
  type ReferenceLine = NonNullable<ChartConfig["referenceLines"]>[number];
  const referenceBands = useMemo<ReferenceBand[]>(() => {
    const bands: ReferenceBand[] = [];
    for (const raw of referenceBandsText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const [start, end, label] = line.split(",").map((part) => part?.trim());
      if (start && end) bands.push({ start, end, label: label || undefined });
    }
    return bands;
  }, [referenceBandsText]);
  const referenceLines = useMemo<ReferenceLine[]>(() => {
    const lines: ReferenceLine[] = [];
    for (const raw of referenceLinesText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const [valueText, label] = line.split(",").map((part) => part?.trim());
      const value = Number(valueText);
      if (Number.isFinite(value)) lines.push({ value, label: label || undefined });
    }
    return lines;
  }, [referenceLinesText]);

  const option = useMemo(
    () =>
      buildChartOption({
        type: chartType,
        parsed,
        categoryColumn,
        seriesColumns,
        sourceColumn,
        targetColumn,
        title,
        subtitle,
        width,
        height,
        margins,
        theme,
        primaryColor,
        secondaryColor,
        paletteColors,
        colorOverrides,
        backgroundColor,
        transparent,
        showLabels,
        showLegend,
        showGrid,
        smooth,
        fontSize: labelStyle.fontSize,
        lineWidth,
        pointSize,
        barWidth,
        barRadius,
        sortCategories: sortCategories ?? undefined,
        showStackTotals: showStackTotals || undefined,
        stackOrder: stackOrder ?? undefined,
        barGap: barGap ?? undefined,
        barCategoryGap: barCategoryGap ?? undefined,
        connectNulls: connectNulls || undefined,
        endLabel: endLabel || undefined,
        referenceBands: referenceBands.length ? referenceBands : undefined,
        referenceLines: referenceLines.length ? referenceLines : undefined,
        pieLabelContent: pieLabelContent ?? undefined,
        donutInnerRadius: donutInnerRadius ?? undefined,
        pieSort: pieSort ?? undefined,
        startAngle: startAngle ?? undefined,
        pieOtherThreshold: pieOtherThreshold ?? undefined,
        sizeColumn: sizeColumn ?? undefined,
        colorColumn: colorColumn ?? undefined,
        shapeColumn: shapeColumn ?? undefined,
        scatterTrendLine: scatterTrendLine || undefined,
        comboDualAxis: comboDualAxis || undefined,
        y2AxisTitle: y2AxisTitle || undefined,
        comboAxisSync: comboAxisSync || undefined,
        streamTimeAxis: streamTimeAxis || undefined,
        markOpacity,
        areaOpacity,
        labelColor: labelStyle.color,
        labelStyle,
        labelPosition,
        showXAxis,
        showYAxis,
        xAxisTitle,
        yAxisTitle,
        axisLabelRotation,
        yAxisMin,
        yAxisMax,
        legendPosition,
        legendAlign,
        showTooltip,
        gridLineType,
        numberDecimals,
        numberPrefix,
        numberSuffix,
        useThousandsSeparator,
        titleAlign,
        titleStyle,
        subtitleStyle,
        xAxisTitleStyle,
        yAxisTitleStyle,
        xAxisLabelStyle,
        yAxisLabelStyle,
        seriesKind,
      }),
    [
      areaOpacity,
      axisLabelRotation,
      backgroundColor,
      barCategoryGap,
      barGap,
      barRadius,
      barWidth,
      categoryColumn,
      chartType,
      comboAxisSync,
      comboDualAxis,
      colorOverrides,
      connectNulls,
      donutInnerRadius,
      endLabel,
      gridLineType,
      height,
      xAxisLabelStyle,
      xAxisTitleStyle,
      yAxisLabelStyle,
      yAxisTitleStyle,
      labelStyle,
      labelPosition,
      legendAlign,
      legendPosition,
      lineWidth,
      margins,
      markOpacity,
      numberDecimals,
      numberPrefix,
      numberSuffix,
      paletteColors,
      parsed,
      pieLabelContent,
      pieOtherThreshold,
      pieSort,
      pointSize,
      primaryColor,
      referenceBands,
      referenceLines,
      scatterTrendLine,
      secondaryColor,
      shapeColumn,
      sizeColumn,
      colorColumn,
      sourceColumn,
      startAngle,
      streamTimeAxis,
      seriesColumns,
      seriesKind,
      showGrid,
      showLabels,
      showLegend,
      showStackTotals,
      showTooltip,
      showXAxis,
      showYAxis,
      smooth,
      sortCategories,
      stackOrder,
      subtitle,
      subtitleStyle,
      theme,
      title,
      titleAlign,
      titleStyle,
      targetColumn,
      transparent,
      useThousandsSeparator,
      width,
      xAxisTitle,
      y2AxisTitle,
      yAxisMax,
      yAxisMin,
      yAxisTitle,
    ],
  );
  // Run the current template's validators against the resolved field bindings.
  // The first non-null message wins and is shown as a preview overlay; while a
  // data error is present the chart is cleared and PNG export is skipped, so
  // the user never sees a blank or misleading chart from insufficient data.
  const dataError = useMemo(() => {
    const ctx = { parsed, categoryColumn, seriesColumns, sourceColumn, targetColumn };
    for (const validator of templateDefinition.validators) {
      const message = validator.validate(ctx);
      if (message) return message;
    }
    return null;
  }, [
    templateDefinition.validators,
    parsed,
    categoryColumn,
    seriesColumns,
    sourceColumn,
    targetColumn,
  ]);
  const supportsLineWidthControl = LINE_WIDTH_CONTROL_TYPES.has(chartType);
  const supportsSmoothControl = SMOOTH_CONTROL_TYPES.has(chartType);
  const supportsLineAreaExtras =
    LINE_AREA_EXTRA_CONTROL_TYPES.has(chartType);
  const supportsEndLabelControl = LINE_END_LABEL_TYPES.has(chartType);
  const supportsPointSizeControl = POINT_SIZE_CONTROL_TYPES.has(chartType);
  const supportsBarShapeControl = BAR_SHAPE_CONTROL_TYPES.has(chartType);
  const supportsAreaOpacityControl = AREA_OPACITY_CONTROL_TYPES.has(chartType);
  const supportsMarkOpacityControl = MARK_OPACITY_CONTROL_TYPES.has(chartType);
  const supportsLegendControl = templateDefinition.capabilities.legend;
  const markOpacityLabel =
    chartType === "sankey" ? "连线不透明度" : "图形不透明度";
  const { pngDownload, pngDownloadReady, exporting, copyPng } = usePngExport({
    option,
    width,
    height,
    pixelRatio,
    transparent,
    backgroundColor,
    dataError,
    requireDownloadAuth,
    setStatus,
  });
  const initialChartStateRef = useRef({ height, option, width });

  useEffect(() => {
    let cancelled = false;

    async function mountChart() {
      if (!chartElementRef.current || chartRef.current) return;
      if (cancelled || !chartElementRef.current) return;
      const initial = initialChartStateRef.current;
      const { init } = await import("echarts");
      if (cancelled || !chartElementRef.current || chartRef.current) return;
      chartRef.current = init(chartElementRef.current, undefined, {
        renderer: "svg",
        width: initial.width,
        height: initial.height,
      });
      chartRef.current.setOption(initial.option, true);
    }

    mountChart();
    return () => {
      cancelled = true;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      // When data validation fails, clear any previously rendered chart so the
      // preview overlay is the only thing visible (no stale/misleading chart).
      if (dataError) {
        chartRef.current?.clear();
        return;
      }
      chartRef.current?.resize({ width, height });
      chartRef.current?.setOption(option, true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dataError, height, option, width, workspaceMode]);

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host) return;

    const updateScale = () => {
      const availableWidth = Math.max(300, host.clientWidth - 54);
      const availableHeight = Math.max(280, host.clientHeight - 56);
      setFitPreviewScale(
        Math.min(1, availableWidth / width, availableHeight / height),
      );
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(host);
    updateScale();
    return () => observer.disconnect();
  }, [height, width, workspaceMode]);

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!settingsQuery.trim()) return;
    const frame = window.requestAnimationFrame(() => {
      settingsPanelRef.current
        ?.querySelector<HTMLElement>(".settings-section.is-search-match")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [settingsQuery]);

  useEffect(() => {
    if (templateOpen || authPanelOpen || resetConfirmOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authPanelOpen, redo, resetConfirmOpen, templateOpen, undo]);

  useEffect(() => {
    applyProjectRef.current = applyProject;
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        const restored = saved ? normalizeProject(JSON.parse(saved)) : null;
        if (restored) applyProjectRef.current?.(restored, "已恢复上次编辑");
      } catch {
        window.localStorage.removeItem(PROJECT_STORAGE_KEY);
      } finally {
        setProjectLoaded(true);
        setSaveState("已恢复");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!projectLoaded) return;
    const timeout = window.setTimeout(() => {
      setSaveState("保存中");
      const payload: ProjectFile = {
        app: PROJECT_FILE_APP,
        version: PROJECT_FILE_VERSION,
        savedAt: new Date().toISOString(),
        project: JSON.parse(currentProjectFingerprint) as ProjectState,
      };
      try {
        window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(payload));
        projectStorageWarningRef.current = false;
        setSaveState("已自动保存");
      } catch {
        setSaveState("保存失败");
        if (!projectStorageWarningRef.current) {
          projectStorageWarningRef.current = true;
          setStatus("自动保存失败，请手动保存项目文件");
        }
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [currentProjectFingerprint, projectLoaded]);

  function selectTheme(nextTheme: (typeof THEMES)[number]) {
    setThemeId(nextTheme.id);
    setPaletteColors([...nextTheme.colors]);
    setEditingPaletteId(null);
  }

  function updatePaletteColor(index: number, color: string) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    setThemeId("custom");
    setPaletteColors((current) =>
      current.map((candidate, colorIndex) =>
        colorIndex === index ? color : candidate,
      ),
    );
  }

  function collectProject(): ProjectState {
    return {
      tableData: tableData.map((row) => [...row]),
      chartType,
      fieldRoles: cloneFieldRoles(fieldRoles),
      seriesKind: { ...seriesKind },
      title,
      subtitle,
      width,
      height,
      margins: { ...margins },
      transparent,
      backgroundColor,
      themeId,
      paletteColors: [...paletteColors],
      colorOverridesText,
      showLabels,
      showLegend,
      showGrid,
      smooth,
      fontSize: labelStyle.fontSize,
      labelColor: labelStyle.color,
      labelPosition,
      legendPosition,
      legendAlign,
      showTooltip,
      gridLineType,
      lineWidth,
      pointSize,
      barWidth,
      barRadius,
      markOpacity,
      areaOpacity,
      showXAxis,
      showYAxis,
      xAxisTitle,
      yAxisTitle,
      axisLabelRotation,
      yAxisMin,
      yAxisMax,
      numberDecimals,
      numberPrefix,
      numberSuffix,
      useThousandsSeparator,
      titleAlign,
      titleStyle: { ...titleStyle },
      subtitleStyle: { ...subtitleStyle },
      xAxisTitleStyle: { ...xAxisTitleStyle },
      yAxisTitleStyle: { ...yAxisTitleStyle },
      xAxisLabelStyle: { ...xAxisLabelStyle },
      yAxisLabelStyle: { ...yAxisLabelStyle },
      labelStyle: { ...labelStyle },
      sortCategories: sortCategories ? { ...sortCategories } : null,
      showStackTotals,
      stackOrder,
      barGap,
      barCategoryGap,
      connectNulls,
      endLabel,
      referenceBandsText,
      referenceLinesText,
      pieLabelContent,
      donutInnerRadius,
      pieSort,
      startAngle,
      pieOtherThreshold,
      sizeColumn,
      colorColumn,
      shapeColumn,
      scatterTrendLine,
      comboDualAxis,
      y2AxisTitle,
      comboAxisSync,
      streamTimeAxis,
    };
  }

  function applyProject(project: ProjectState, message?: string) {
    setTableData(project.tableData.map((row) => [...row]));
    setChartType(project.chartType);
    setWorkspaceMode("preview");
    setTemplateOpen(false);
    setFieldRoles(cloneFieldRoles(project.fieldRoles));
    setSeriesKind({ ...project.seriesKind });
    setTitle(project.title);
    setSubtitle(project.subtitle);
    setWidth(project.width);
    setHeight(project.height);
    setWidthInput(String(project.width));
    setHeightInput(String(project.height));
    setThemeId(project.themeId);
    setPaletteColors([...project.paletteColors]);
    setPaletteName("我的配色");
    setEditingPaletteId(null);
    setColorOverridesText(project.colorOverridesText);
    setTransparent(project.transparent);
    setBackgroundColor(project.backgroundColor);
    setMargins({ ...project.margins });
    setMarginsLinked(false);
    setShowLabels(project.showLabels);
    setShowLegend(project.showLegend);
    setShowGrid(project.showGrid);
    setSmooth(project.smooth);
    setLineWidth(project.lineWidth);
    setPointSize(project.pointSize);
    setBarWidth(project.barWidth);
    setBarRadius(project.barRadius);
    setSortCategories(
      project.sortCategories ? { ...project.sortCategories } : null,
    );
    setShowStackTotals(project.showStackTotals);
    setStackOrder(project.stackOrder);
    setBarGap(project.barGap);
    setBarCategoryGap(project.barCategoryGap);
    setConnectNulls(project.connectNulls);
    setEndLabel(project.endLabel);
    setReferenceBandsText(project.referenceBandsText);
    setReferenceLinesText(project.referenceLinesText);
    setPieLabelContent(project.pieLabelContent);
    setDonutInnerRadius(project.donutInnerRadius);
    setPieSort(project.pieSort);
    setStartAngle(project.startAngle);
    setPieOtherThreshold(project.pieOtherThreshold);
    setSizeColumn(project.sizeColumn);
    setColorColumn(project.colorColumn);
    setShapeColumn(project.shapeColumn);
    setScatterTrendLine(project.scatterTrendLine);
    setComboDualAxis(project.comboDualAxis);
    setY2AxisTitle(project.y2AxisTitle);
    setComboAxisSync(project.comboAxisSync);
    setStreamTimeAxis(project.streamTimeAxis);
    setMarkOpacity(project.markOpacity);
    setAreaOpacity(project.areaOpacity);
    setLabelPosition(project.labelPosition);
    setShowXAxis(project.showXAxis);
    setShowYAxis(project.showYAxis);
    setXAxisTitle(project.xAxisTitle);
    setYAxisTitle(project.yAxisTitle);
    setAxisLabelRotation(project.axisLabelRotation);
    setYAxisMin(project.yAxisMin);
    setYAxisMax(project.yAxisMax);
    setLegendPosition(project.legendPosition);
    setLegendAlign(project.legendAlign);
    setShowTooltip(project.showTooltip);
    setGridLineType(project.gridLineType);
    setNumberDecimals(project.numberDecimals);
    setNumberPrefix(project.numberPrefix);
    setNumberSuffix(project.numberSuffix);
    setUseThousandsSeparator(project.useThousandsSeparator);
    setTitleAlign(project.titleAlign);
    setTitleStyle({ ...project.titleStyle });
    setSubtitleStyle({ ...project.subtitleStyle });
    setXAxisTitleStyle({ ...project.xAxisTitleStyle });
    setYAxisTitleStyle({ ...project.yAxisTitleStyle });
    setXAxisLabelStyle({ ...project.xAxisLabelStyle });
    setYAxisLabelStyle({ ...project.yAxisLabelStyle });
    setLabelStyle({ ...project.labelStyle });
    setSettingsQuery("");
    setSettingsOpen(DEFAULT_SETTINGS_OPEN);
    if (message) setStatus(message);
  }

  function saveProjectFile() {
    if (!requireDownloadAuth()) return;
    const payload: ProjectFile = {
      app: PROJECT_FILE_APP,
      version: PROJECT_FILE_VERSION,
      savedAt: new Date().toISOString(),
      project: collectProject(),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
      `${safeFilename(title || "图作项目")}.tuzuo.json`,
    );
    setStatus("项目文件已保存");
  }

  async function handleProjectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const project = normalizeProject(JSON.parse(await file.text()));
      if (!project) throw new Error("Invalid project file");
      applyProject(project, `已打开 ${file.name}`);
      setProjectLoaded(true);
    } catch {
      setStatus("项目文件读取失败");
    } finally {
      event.target.value = "";
    }
  }

  function toggleSettingsSection(id: SettingsSectionId) {
    setSettingsOpen((current) => ({ ...current, [id]: !current[id] }));
  }

  // Whether a settings section is declared for the current template. Driven by
  // the registry's settingsGroups so the panel only shows sections that mean
  // something for the current chart (e.g. pie/donut hide X/Y axis sections).
  function sectionInTemplate(id: SettingsSectionId) {
    if (id === "data") return true;
    return templateDefinition.settingsGroups.some((group) => group.id === id);
  }

  // Combined visibility for a section: hidden unless it both belongs to the
  // current template AND matches the settings search query.
  function sectionShown(id: SettingsSectionId) {
    return sectionInTemplate(id) && settingsSectionMatches(id, settingsQuery);
  }

  function selectTemplate(type: ChartType) {
    setChartType(type);
    setTemplateOpen(false);
    setWorkspaceMode("preview");
  }

  function loadSample() {
    // Load the current template's semantically appropriate sample data into the
    // editor. Replaces the table and role bindings, but leaves styling
    // (palette, canvas, margins) untouched.
    const { sampleData } = templateDefinition;
    const sampleHeaders = sampleData.table[0] ?? [];
    const sampleNumeric = sampleData.seriesColumns;
    const firstText =
      sampleHeaders.find((header) => !sampleNumeric.includes(header)) ??
      sampleData.categoryColumn;
    const secondText =
      sampleHeaders.find(
        (header) => header !== firstText && !sampleNumeric.includes(header),
      ) ??
      sampleHeaders.find((header) => header !== firstText) ??
      firstText;
    const nextRoles: FieldRoles = {};

    for (const binding of templateDefinition.dataBindings) {
      const roleDefault = sampleData.roleDefaults?.[binding.role];
      const stringDefault =
        typeof roleDefault === "string" ? roleDefault : undefined;
      if (binding.role === "category") {
        nextRoles.category = stringDefault ?? sampleData.categoryColumn;
      } else if (binding.role === "value") {
        nextRoles.value = binding.multiple
          ? Array.isArray(roleDefault)
            ? roleDefault
            : [...sampleNumeric]
          : stringDefault ?? sampleNumeric[0] ?? "";
      } else if (binding.role === "x") {
        nextRoles.x = stringDefault ?? sampleNumeric[0] ?? "";
      } else if (binding.role === "y") {
        nextRoles.y = stringDefault ?? sampleNumeric[1] ?? sampleNumeric[0] ?? "";
      } else if (binding.role === "leftValue") {
        nextRoles.leftValue = stringDefault ?? sampleNumeric[0] ?? "";
      } else if (binding.role === "rightValue") {
        nextRoles.rightValue =
          stringDefault ?? sampleNumeric[1] ?? sampleNumeric[0] ?? "";
      } else if (binding.role === "source") {
        nextRoles.source = stringDefault ?? firstText;
      } else if (binding.role === "target") {
        nextRoles.target = stringDefault ?? secondText;
      }
    }

    const sampleProject = cloneProject(currentProject);
    sampleProject.tableData = sampleData.table.map((row) => [...row]);
    sampleProject.fieldRoles = cloneFieldRoles(nextRoles);
    applyCheckpoint(
      sampleProject,
      JSON.stringify(sampleProject),
      "已加载示例数据",
    );
  }

  function toggleSeries(header: string) {
    setFieldRoles((current) => {
      const list = (current.value as string[] | undefined) ?? [];
      if (list.includes(header)) {
        return {
          ...current,
          value:
            list.length > 1
              ? list.filter((candidate) => candidate !== header)
              : list,
        };
      }
      return { ...current, value: [...list, header] };
    });
  }

  function updateMargin(side: keyof Margins, value: number) {
    const next = Math.min(240, Math.max(0, value || 0));
    setMargins((current) => {
      if (marginsLinked) {
        return { top: next, right: next, bottom: next, left: next };
      }
      return { ...current, [side]: next };
    });
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setTableData((current) => {
      const next = current.map((row) => [...row]);
      const previousHeader = next[0]?.[columnIndex] ?? "";
      next[rowIndex][columnIndex] = value;

      if (rowIndex === 0 && previousHeader !== value) {
        // Keep field-role bindings in sync when a column is renamed: rename
        // the header in every role that currently references it.
        setFieldRoles((roles) => {
          const next: FieldRoles = {};
          for (const [role, bound] of Object.entries(roles)) {
            if (typeof bound === "string") {
              next[role as DataBindingRole] =
                bound === previousHeader ? value : bound;
            } else {
              next[role as DataBindingRole] = bound?.map((column) =>
                column === previousHeader ? value : column,
              );
            }
          }
          return next;
        });
      }

      return next;
    });
  }

  function pasteIntoTable(
    event: React.ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startColumn: number,
  ) {
    const clipboardText = event.clipboardData.getData("text/plain");
    if (!clipboardText.includes("\t") && !clipboardText.includes("\n")) return;
    event.preventDefault();
    const pasted = parseDelimitedTable(clipboardText);

    setTableData((current) => {
      const requiredRows = Math.max(current.length, startRow + pasted.length);
      const requiredColumns = Math.max(
        current[0]?.length ?? 2,
        startColumn + Math.max(...pasted.map((row) => row.length)),
      );
      const next = Array.from({ length: requiredRows }, (_, rowIndex) =>
        Array.from(
          { length: requiredColumns },
          (_, columnIndex) => current[rowIndex]?.[columnIndex] ?? "",
        ),
      );

      pasted.forEach((row, rowOffset) => {
        row.forEach((value, columnOffset) => {
          next[startRow + rowOffset][startColumn + columnOffset] = value;
        });
      });
      return next;
    });
    setStatus(`已粘贴 ${pasted.length} 行数据`);
  }

  function addRow() {
    setTableData((current) => [
      ...current,
      Array.from({ length: current[0]?.length ?? 2 }, () => ""),
    ]);
  }

  function deleteRow(index: number) {
    setTableData((current) =>
      current.length > 2 ? current.filter((_, rowIndex) => rowIndex !== index) : current,
    );
  }

  function addColumn() {
    setTableData((current) =>
      current.map((row, rowIndex) => [
        ...row,
        rowIndex === 0 ? `系列 ${row.length}` : "",
      ]),
    );
  }

  function deleteColumn(index: number) {
    if ((tableData[0]?.length ?? 0) <= 2) return;
    const removedHeader = tableData[0]?.[index] ?? "";
    setTableData((current) =>
      current.map((row) => row.filter((_, columnIndex) => columnIndex !== index)),
    );
    // Drop the deleted header from every role binding. resolveFieldBindings
    // will fall back to the first available numeric/header column for any
    // role left empty, so no explicit reassignment is needed here.
    setFieldRoles((roles) => {
      const next: FieldRoles = {};
      for (const [role, bound] of Object.entries(roles)) {
        if (typeof bound === "string") {
          if (bound !== removedHeader) next[role as DataBindingRole] = bound;
        } else {
          const filtered = bound?.filter((header) => header !== removedHeader);
          if (filtered?.length) next[role as DataBindingRole] = filtered;
        }
      }
      return next;
    });
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const matrix = parseDelimitedTable(await file.text());
      setTableData(matrix);
      setWorkspaceMode("data");
      setStatus(`已载入 ${file.name}`);
    } catch {
      setStatus("文件读取失败");
    } finally {
      event.target.value = "";
    }
  }

  function exportSvg() {
    if (!requireDownloadAuth()) return;
    if (!chartRef.current) return;
    downloadBlob(
      new Blob([chartRef.current.renderToSVGString({ useViewBox: true })], {
        type: "image/svg+xml;charset=utf-8",
      }),
      `${safeFilename(title)}.svg`,
    );
    setStatus("SVG 已导出");
  }

  function resetAll() {
    const resetProject = cloneProject(DEFAULT_PROJECT);
    applyCheckpoint(resetProject, JSON.stringify(resetProject), "已恢复示例");
    setPixelRatio(2);
  }

  const dataFieldControls = (
    <>
      {!dataMatchesSample && (
        <div className="sample-hint" role="note">
          <span>
            当前数据可能不适合「{selectedTemplate.name}」，可加载专属示例数据。
          </span>
          <button
            type="button"
            className="sample-hint-button"
            onClick={loadSample}
          >
            加载示例
          </button>
        </div>
      )}
      {templateDefinition.dataBindings.map((binding) => {
        const acceptsAnyColumn =
          binding.role === "category" ||
          binding.role === "source" ||
          binding.role === "target";
        const options = acceptsAnyColumn ? parsed.headers : parsed.numericHeaders;
        if (binding.multiple) {
          // Multi-column value role: checkbox list, selection order preserved
          // (toggleSeries appends to the end).
          const selected = (fieldRoles.value as string[] | undefined) ?? [];
          return (
            <div key={binding.role} className="series-list">
              <span className="field-caption">
                {binding.label}
                {binding.hint ? ` · ${binding.hint}` : ""}
              </span>
              {parsed.numericHeaders.map((header, index) => {
                const isSelected = selected.includes(header);
                // Combo only: a per-series 柱/线 toggle lets the user assign
                // which selected columns render as bars vs lines.
                const kind =
                  seriesKind[header] ?? (index === 0 ? "bar" : "line");
                return (
                  <label
                    key={header}
                    className={`series-option${
                      isSelected && chartType === "combo"
                        ? " series-option-combo"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSeries(header)}
                    />
                    <span
                      className="series-color"
                      style={{
                        background:
                          index === 0
                            ? primaryColor
                            : index === 1
                              ? secondaryColor
                              : theme.colors[index % theme.colors.length],
                      }}
                    />
                    <span>{header}</span>
                    {isSelected && chartType === "combo" && (
                      <span
                        className="series-kind"
                        role="group"
                        aria-label={`${header} 图形`}
                      >
                        {(["bar", "line"] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`series-kind-btn${
                              kind === option ? " is-active" : ""
                            }`}
                            aria-pressed={kind === option}
                            onClick={(event) => {
                              event.preventDefault();
                              setSeriesKind((current) => ({
                                ...current,
                                [header]: option,
                              }));
                            }}
                          >
                            {option === "bar" ? "柱" : "线"}
                          </button>
                        ))}
                      </span>
                    )}
                    {isSelected && chartType !== "combo" && (
                      <Check size={13} />
                    )}
                  </label>
                );
              })}
            </div>
          );
        }

        // Scatter optional roles (size/color/shape) bind to dedicated
        // ChartConfig fields with a "无" option, not the generic role map.
        if (
          chartType === "scatter" &&
          (binding.role === "size" ||
            binding.role === "color" ||
            binding.role === "shape")
        ) {
          const isSize = binding.role === "size";
          const roleOptions = isSize ? parsed.numericHeaders : parsed.headers;
          const value =
            binding.role === "size"
              ? sizeColumn
              : binding.role === "color"
                ? colorColumn
                : shapeColumn;
          const setValue =
            binding.role === "size"
              ? setSizeColumn
              : binding.role === "color"
                ? setColorColumn
                : setShapeColumn;
          return (
            <label key={binding.role} className="field">
              <span>{binding.label}</span>
              <select
                value={value ?? ""}
                onChange={(event) => setValue(event.target.value || null)}
              >
                <option value="">无</option>
                {roleOptions.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        // Single-column role (category / x / y / leftValue / rightValue).
        // Display the resolved value (includes fallbacks) so the select always
        // matches what the renderer receives.
        const current = resolvedRoles[binding.role] ?? options[0] ?? "";
        return (
          <label key={binding.role} className="field">
            <span>{binding.label}</span>
            <select
              value={options.includes(current) ? current : (options[0] ?? "")}
              onChange={(event) =>
                setFieldRoles((roles) => ({
                  ...roles,
                  [binding.role]: event.target.value,
                }))
              }
            >
              {options.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <button
        type="button"
        className="text-button"
        onClick={loadSample}
        title="为当前图表加载示例数据"
      >
        <Sparkles size={14} />
        加载示例
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => setWorkspaceMode("data")}
      >
        <Table2 size={14} />
        编辑数据表
      </button>
    </>
  );

  const previewScale = previewScaleOverride ?? fitPreviewScale;
  const previewStyle = {
    "--preview-width": `${width * previewScale}px`,
    "--preview-height": `${height * previewScale}px`,
    "--chart-width": `${width}px`,
    "--chart-height": `${height}px`,
    "--preview-scale": previewScale,
    "--solid-background": backgroundColor,
  } as CSSProperties;

  const studioGridStyle = {
    "--left-panel-width": `${leftPanelWidth}px`,
    "--right-panel-width": `${rightPanelWidth}px`,
    "--data-panel-height": `${dataPanelHeight}px`,
  } as CSSProperties;

  function changePreviewZoom(delta: number) {
    setPreviewScaleOverride(
      Math.min(2.5, Math.max(0.2, previewScale + delta)),
    );
  }

  function updateCanvasDimensionDraft(
    raw: string,
    bounds: { min: number; max: number },
    setDraft: (value: string) => void,
    setDimension: (value: number) => void,
  ) {
    setDraft(raw);
    const candidate = numberCandidate(raw);
    if (Number.isFinite(candidate) && candidate >= bounds.min && candidate <= bounds.max) {
      setDimension(Math.round(candidate));
    }
  }

  function commitCanvasDimensionDraft(
    raw: string,
    current: number,
    bounds: { min: number; max: number },
    setDraft: (value: string) => void,
    setDimension: (value: number) => void,
  ) {
    const next = canvasDimensionValue(raw, current, bounds);
    setDimension(next);
    setDraft(String(next));
  }

  const studioGridClassName = [
    "studio-grid",
    leftPanelCollapsed ? "left-collapsed" : "",
    rightPanelCollapsed ? "right-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand-zone">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Image
                className="brand-logo"
                src="/favicon.svg"
                alt=""
                width={24}
                height={24}
                priority
              />
            </span>
            <span className="brand-name">图作</span>
            <span className="brand-subtitle">透明图表工具</span>
            <span className="save-state" aria-live="polite">
              {saveState}
            </span>
          </div>
          <div className="panel-toggle-group" aria-label="侧栏显示">
            <button
              type="button"
              className="icon-button panel-toggle-button"
              onClick={() => togglePanel("left")}
              aria-pressed={!leftPanelCollapsed}
              aria-label={leftPanelCollapsed ? "展开左侧栏" : "收起左侧栏"}
              title={leftPanelCollapsed ? "展开左侧栏" : "收起左侧栏"}
            >
              {leftPanelCollapsed ? (
                <PanelLeftOpen size={17} />
              ) : (
                <PanelLeftClose size={17} />
              )}
            </button>
            <button
              type="button"
              className="icon-button panel-toggle-button"
              onClick={() => togglePanel("right")}
              aria-pressed={!rightPanelCollapsed}
              aria-label={rightPanelCollapsed ? "展开右侧栏" : "收起右侧栏"}
              title={rightPanelCollapsed ? "展开右侧栏" : "收起右侧栏"}
            >
              {rightPanelCollapsed ? (
                <PanelRightOpen size={17} />
              ) : (
                <PanelRightClose size={17} />
              )}
            </button>
          </div>
        </div>

        <div className="workspace-controls">
          <div className="workspace-tabs" aria-label="工作区视图">
            <button
              type="button"
              className={workspaceMode === "preview" ? "active" : ""}
              onClick={() => setWorkspaceMode("preview")}
              aria-pressed={workspaceMode === "preview"}
            >
              <AreaChart size={16} />
              预览
            </button>
            <button
              type="button"
              className={workspaceMode === "data" ? "active" : ""}
              onClick={() => setWorkspaceMode("data")}
              aria-pressed={workspaceMode === "data"}
            >
              <Table2 size={16} />
              数据
            </button>
          </div>
          <div className="history-toolbar" aria-label="编辑历史">
            <button
              type="button"
              className="icon-button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="撤销"
              title="撤销"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="重做"
              title="重做"
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>

        <ExportToolbar
          requireAuthForExport={REQUIRE_AUTH_FOR_EXPORT}
          authLoading={authLoading}
          authUser={authUser}
          exporting={exporting}
          dataError={dataError}
          pixelRatio={pixelRatio}
          pngDownloadReady={pngDownloadReady}
          pngDownloadObjectUrl={pngDownload?.objectUrl}
          title={title}
          projectInputRef={projectInputRef}
          onOpenAuth={() => openAuthPanel("login")}
          onLogout={logout}
          onProjectFileChange={handleProjectFile}
          onSaveProject={saveProjectFile}
          onPixelRatioChange={setPixelRatio}
          onCopyPng={copyPng}
          onExportSvg={exportSvg}
          onPngDownloadClick={(event) => {
            if (dataError) {
              event.preventDefault();
              return;
            }
            if (!requireDownloadAuth()) {
              event.preventDefault();
              return;
            }
            if (!pngDownloadReady) {
              event.preventDefault();
              setStatus("PNG 正在准备，请稍候");
              return;
            }
            setStatus("PNG 已开始下载");
          }}
        />
      </header>

      <div className={studioGridClassName} style={studioGridStyle}>
        {isNarrowViewport &&
          (!leftPanelCollapsed || !rightPanelCollapsed) && (
            <button
              type="button"
              className="mobile-panel-backdrop"
              onClick={closePanels}
              aria-label="关闭侧栏"
            />
          )}
        <aside
          className={`panel panel-left ${leftPanelCollapsed ? "is-collapsed" : ""}`}
          aria-hidden={leftPanelCollapsed}
          inert={leftPanelCollapsed}
        >
          <section className="panel-section">
            <div className="section-heading">
              <span>图表模板</span>
            </div>
            <button
              type="button"
              className="current-template"
              onClick={() => setTemplateOpen(true)}
            >
              <span className="current-template-icon">
                <ChartFamilyIcon
                  family={selectedTemplate.family}
                  size={17}
                />
              </span>
              <span>
                <strong>{selectedTemplate.name}</strong>
                <small>{CHART_TEMPLATES.length} 种图表</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <span>内容</span>
            </div>
            <label className="field">
              <span>标题</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <TextStyleControls
              label="标题样式"
              style={titleStyle}
              fallbackColor={theme.text}
              onChange={setTitleStyle}
            />
            <span className="settings-caption">标题对齐</span>
            <div className="segmented-control three">
              {(
                [
                  ["left", "左"],
                  ["center", "中"],
                  ["right", "右"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={titleAlign === value ? "active" : ""}
                  onClick={() => setTitleAlign(value)}
                  aria-pressed={titleAlign === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>副标题</span>
              <input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
              />
            </label>
            <TextStyleControls
              label="副标题样式"
              style={subtitleStyle}
              fallbackColor="#68727d"
              onChange={setSubtitleStyle}
            />
          </section>

          <section className="panel-section panel-section-canvas">
            <div className="section-heading">
              <span>画布</span>
            </div>
            <div className="field-row canvas-size-row">
              <label className="field">
                <span>宽度（px）</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={`${CANVAS_WIDTH_BOUNDS.min}-${CANVAS_WIDTH_BOUNDS.max}`}
                  value={widthInput}
                  onChange={(event) =>
                    updateCanvasDimensionDraft(
                      event.target.value,
                      CANVAS_WIDTH_BOUNDS,
                      setWidthInput,
                      setWidth,
                    )
                  }
                  onBlur={() =>
                    commitCanvasDimensionDraft(
                      widthInput,
                      width,
                      CANVAS_WIDTH_BOUNDS,
                      setWidthInput,
                      setWidth,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitCanvasDimensionDraft(
                        widthInput,
                        width,
                        CANVAS_WIDTH_BOUNDS,
                        setWidthInput,
                        setWidth,
                      );
                    }
                    if (event.key === "Escape") {
                      setWidthInput(String(width));
                    }
                  }}
                />
              </label>
              <label className="field">
                <span>高度（px）</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={`${CANVAS_HEIGHT_BOUNDS.min}-${CANVAS_HEIGHT_BOUNDS.max}`}
                  value={heightInput}
                  onChange={(event) =>
                    updateCanvasDimensionDraft(
                      event.target.value,
                      CANVAS_HEIGHT_BOUNDS,
                      setHeightInput,
                      setHeight,
                    )
                  }
                  onBlur={() =>
                    commitCanvasDimensionDraft(
                      heightInput,
                      height,
                      CANVAS_HEIGHT_BOUNDS,
                      setHeightInput,
                      setHeight,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitCanvasDimensionDraft(
                        heightInput,
                        height,
                        CANVAS_HEIGHT_BOUNDS,
                        setHeightInput,
                        setHeight,
                      );
                    }
                    if (event.key === "Escape") {
                      setHeightInput(String(height));
                    }
                  }}
                />
              </label>
            </div>
            <Toggle
              label="透明背景"
              checked={transparent}
              onChange={setTransparent}
            />
            {!transparent && (
              <label className="background-field">
                <span>背景色</span>
                <span className="color-input-wrap">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    aria-label="背景色"
                  />
                  <span>{backgroundColor.toUpperCase()}</span>
                </span>
              </label>
            )}
            <div className="canvas-margin-block">
              <div className="margin-heading">
                <span>四周边距（px）</span>
                <button
                  type="button"
                  onClick={() => setMarginsLinked((current) => !current)}
                  title={marginsLinked ? "取消联动" : "联动四边"}
                  aria-label={marginsLinked ? "取消联动边距" : "联动四周边距"}
                >
                  {marginsLinked ? <Lock size={14} /> : <LockOpen size={14} />}
                </button>
              </div>
              <div className="margin-grid">
                {(
                  [
                    ["top", "上"],
                    ["right", "右"],
                    ["bottom", "下"],
                    ["left", "左"],
                  ] as [keyof Margins, string][]
                ).map(([side, label]) => (
                  <label key={side}>
                    <span>{label}</span>
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={margins[side]}
                      onChange={(event) =>
                        updateMargin(side, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>
          <button
            type="button"
            className="panel-resize-handle panel-resize-handle-left"
            onPointerDown={(event) => startPanelResize("left", event)}
            aria-label="调整左侧栏宽度"
            title="拖动调整左侧栏宽度"
          />
        </aside>

        <div
          className={`workspace-main ${
            workspaceMode === "data" ? "data-panel-open" : ""
          }`}
        >
        <section
          className="canvas-panel"
          ref={previewHostRef}
        >
            <div className="canvas-meta">
              <span className="canvas-size-meta">
                {width} × {height}
              </span>
              <div className="canvas-zoom-controls" aria-label="画布缩放">
                <button
                  type="button"
                  onClick={() => changePreviewZoom(-0.1)}
                  aria-label="缩小画布"
                  title="缩小"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  className="canvas-zoom-value"
                  onClick={() => setPreviewScaleOverride(null)}
                  aria-label="适应窗口"
                  title="适应窗口"
                >
                  {Math.round(previewScale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewScaleOverride(1)}
                  aria-label="按百分之百显示"
                  title="100%"
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={() => changePreviewZoom(0.1)}
                  aria-label="放大画布"
                  title="放大"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>
            <div className="preview-stage" style={previewStyle}>
              <div
                className={`preview-document ${
                  transparent ? "is-transparent" : "is-solid"
                }`}
              >
                <div
                  ref={chartElementRef}
                  className="chart-root"
                  style={{ display: dataError ? "none" : undefined }}
                />
                {dataError && (
                  <div className="chart-empty" role="alert">
                    <AlertTriangle size={22} />
                    <span>{dataError}</span>
                  </div>
                )}
              </div>
            </div>
        </section>

        <section
          className={`data-workspace ${
            workspaceMode !== "data" ? "workspace-hidden" : ""
          }`}
          aria-hidden={workspaceMode !== "data"}
        >
            <button
              type="button"
              className="workspace-splitter"
              onPointerDown={startDataResize}
              aria-label="调整数据面板高度"
              title="拖动调整数据面板高度"
            >
              <span />
            </button>
            <div className="data-toolbar">
              <div>
                <h2>数据表</h2>
                <span>
                  {parsed.rows.length} 行 · {parsed.headers.length} 列
                </span>
              </div>
              <div className="data-toolbar-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp size={16} />
                  上传 CSV / TSV
                </button>
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  onChange={handleFile}
                />
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={addColumn}
                >
                  <Columns3 size={16} />
                  添加列
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={addRow}
                >
                  <Plus size={16} />
                  添加行
                </button>
              </div>
            </div>

            <div className="sheet-shell">
              <div className="sheet-scroll">
                <table className="data-sheet">
                  <thead>
                    <tr>
                      <th className="row-gutter">
                        <Table2 size={15} />
                      </th>
                      {tableData[0]?.map((header, columnIndex) => (
                        <th key={`header-${columnIndex}`}>
                          <input
                            value={header}
                            onChange={(event) =>
                              updateCell(0, columnIndex, event.target.value)
                            }
                            onPaste={(event) =>
                              pasteIntoTable(event, 0, columnIndex)
                            }
                            aria-label={`第 ${columnIndex + 1} 列标题`}
                          />
                          <button
                            type="button"
                            onClick={() => deleteColumn(columnIndex)}
                            disabled={(tableData[0]?.length ?? 0) <= 2}
                            title="删除列"
                            aria-label={`删除第 ${columnIndex + 1} 列`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(1).map((row, rowOffset) => {
                      const rowIndex = rowOffset + 1;
                      return (
                        <tr key={`row-${rowIndex}`}>
                          <th className="row-gutter">
                            <span>{rowIndex}</span>
                            <button
                              type="button"
                              onClick={() => deleteRow(rowIndex)}
                              disabled={tableData.length <= 2}
                              title="删除行"
                              aria-label={`删除第 ${rowIndex} 行`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </th>
                          {tableData[0].map((_, columnIndex) => (
                            <td key={`cell-${rowIndex}-${columnIndex}`}>
                              <input
                                value={row[columnIndex] ?? ""}
                                onChange={(event) =>
                                  updateCell(
                                    rowIndex,
                                    columnIndex,
                                    event.target.value,
                                  )
                                }
                                onPaste={(event) =>
                                  pasteIntoTable(
                                    event,
                                    rowIndex,
                                    columnIndex,
                                  )
                                }
                                aria-label={`第 ${rowIndex} 行第 ${columnIndex + 1} 列`}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="add-row-bar" onClick={addRow}>
                <Plus size={15} />
                添加一行
              </button>
            </div>
            <p className="sheet-hint">可直接从 Excel 或表格软件复制后粘贴到任意单元格</p>
        </section>
        </div>

        <aside
          ref={settingsPanelRef}
          className={`panel panel-right ${rightPanelCollapsed ? "is-collapsed" : ""}`}
          aria-hidden={rightPanelCollapsed}
          inert={rightPanelCollapsed}
        >
          <button
            type="button"
            className="panel-resize-handle panel-resize-handle-right"
            onPointerDown={(event) => startPanelResize("right", event)}
            aria-label="调整右侧栏宽度"
            title="拖动调整右侧栏宽度"
          />
          <div className="settings-toolbar">
            <label className="settings-search">
              <Search size={14} />
              <input
                value={settingsQuery}
                onChange={(event) => setSettingsQuery(event.target.value)}
                placeholder="搜索设置"
                aria-label="搜索设置"
              />
              {settingsQuery && (
                <button
                  type="button"
                  onClick={() => setSettingsQuery("")}
                  aria-label="清除设置搜索"
                  title="清除"
                >
                  <X size={13} />
                </button>
              )}
            </label>
            <button
              type="button"
              className="settings-reset-icon"
              onClick={() => setResetConfirmOpen(true)}
              aria-label="恢复示例并重置当前项目"
              title="恢复示例并重置当前项目"
            >
              <RefreshCcw size={15} />
            </button>
          </div>

          <SettingsSection
            id="data"
            query={settingsQuery}
            icon={<Table2 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.data}
            hidden={!sectionShown("data")}
            onToggle={() => toggleSettingsSection("data")}
          >
            {dataFieldControls}
          </SettingsSection>

          <SettingsSection
            id="colors"
            query={settingsQuery}
            icon={<Palette size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.colors}
            hidden={!sectionShown("colors")}
            onToggle={() => toggleSettingsSection("colors")}
          >
            <span className="settings-caption">预设方案</span>
            <div className="theme-list compact">
              {THEMES.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={themeId === candidate.id ? "selected" : ""}
                  onClick={() => selectTheme(candidate)}
                  aria-pressed={themeId === candidate.id}
                >
                  <span className="theme-swatches" aria-hidden="true">
                    {candidate.colors.slice(0, 4).map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span>{candidate.name}</span>
                  {themeId === candidate.id && <Check size={13} />}
                </button>
              ))}
            </div>

            {customPalettes.length > 0 && (
              <>
                <span className="settings-caption custom-palette-caption">
                  已保存
                </span>
                <div className="saved-palette-list">
                  {customPalettes.map((palette) => (
                    <div key={palette.id} className="saved-palette-row">
                      <button
                        type="button"
                        className={
                          themeId === palette.id
                            ? "saved-palette-select selected"
                            : "saved-palette-select"
                        }
                        onClick={() => selectSavedPalette(palette)}
                        aria-pressed={themeId === palette.id}
                      >
                        <span className="palette-strip" aria-hidden="true">
                          {palette.colors.slice(0, 6).map((color, index) => (
                            <span
                              key={`${color}-${index}`}
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        <span>{palette.name}</span>
                      </button>
                      <button
                        type="button"
                        className="palette-row-action"
                        onClick={() => editSavedPalette(palette)}
                        aria-label={`编辑配色 ${palette.name}`}
                        title="编辑配色"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="palette-row-action palette-row-danger"
                        onClick={() => deleteSavedPalette(palette.id)}
                        aria-label={`删除配色 ${palette.name}`}
                        title="删除配色"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="palette-editor-heading">
              <span className="settings-caption">当前调色板</span>
              <button
                type="button"
                onClick={addPaletteColor}
                aria-label="添加颜色"
                title="添加颜色"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="palette-editor">
              {paletteColors.map((color, index) => (
                <div className="palette-color-row" key={`${index}-${color}`}>
                  <input
                    type="color"
                    value={color}
                    onChange={(event) =>
                      updatePaletteColor(index, event.target.value)
                    }
                    aria-label={`调色板颜色 ${index + 1}`}
                  />
                  <input
                    className="palette-hex"
                    value={color.toUpperCase()}
                    onChange={(event) =>
                      updatePaletteColor(index, event.target.value)
                    }
                    maxLength={7}
                    aria-label={`颜色 ${index + 1} 色值`}
                  />
                  <div className="palette-reorder">
                    <button
                      type="button"
                      onClick={() => movePaletteColor(index, -1)}
                      disabled={index === 0}
                      aria-label={`颜色 ${index + 1} 左移`}
                      title="左移"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePaletteColor(index, 1)}
                      disabled={index === paletteColors.length - 1}
                      aria-label={`颜色 ${index + 1} 右移`}
                      title="右移"
                    >
                      <ArrowRight size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePaletteColor(index)}
                      disabled={paletteColors.length <= 2}
                      aria-label={`删除颜色 ${index + 1}`}
                      title="删除颜色"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="save-palette-row">
              <input
                value={paletteName}
                onChange={(event) => setPaletteName(event.target.value)}
                placeholder="配色名称"
                aria-label="配色名称"
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={saveCurrentPalette}
              >
                <Save size={14} />
                {editingPaletteId ? "更新" : "保存"}
              </button>
            </div>

            <label className="field settings-field">
              <span>系列颜色覆盖</span>
              <textarea
                value={colorOverridesText}
                onChange={(event) => setColorOverridesText(event.target.value)}
                placeholder={"实际收入 :: #2563eb\n目标 :: #f15a3a"}
                aria-label="系列颜色覆盖"
              />
              <small>每行使用“系列名 :: #色值”</small>
            </label>
          </SettingsSection>

          <SettingsSection
            id="marks"
            query={settingsQuery}
            icon={<SlidersHorizontal size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.marks}
            hidden={!sectionShown("marks")}
            onToggle={() => toggleSettingsSection("marks")}
          >
            {supportsLineWidthControl && (
              <label className="range-field">
                <span>
                  线条宽度 <strong>{lineWidth}px</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={lineWidth}
                  onChange={(event) => setLineWidth(Number(event.target.value))}
                />
              </label>
            )}
            {supportsSmoothControl && (
              <Toggle
                label="平滑曲线"
                checked={smooth}
                onChange={setSmooth}
              />
            )}
            {supportsLineAreaExtras && (
              <>
                <Toggle
                  label="连接缺失值"
                  checked={connectNulls}
                  onChange={setConnectNulls}
                />
                {supportsEndLabelControl && (
                  <Toggle
                    label="末端标签"
                    checked={endLabel}
                    onChange={setEndLabel}
                  />
                )}
                <label className="field">
                  <span>参考区间（每行 起,止[,标签]）</span>
                  <textarea
                    className="marks-textarea"
                    rows={2}
                    value={referenceBandsText}
                    onChange={(event) => setReferenceBandsText(event.target.value)}
                    placeholder={"二月,四月"}
                  />
                </label>
                <label className="field">
                  <span>参考线（每行 数值[,标签]）</span>
                  <textarea
                    className="marks-textarea"
                    rows={2}
                    value={referenceLinesText}
                    onChange={(event) => setReferenceLinesText(event.target.value)}
                    placeholder={"150,目标"}
                  />
                </label>
              </>
            )}
            {supportsPointSizeControl && (
              <label className="range-field">
                <span>
                  数据点大小 <strong>{pointSize}px</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={pointSize}
                  onChange={(event) => setPointSize(Number(event.target.value))}
                />
              </label>
            )}
            {chartType === "scatter" && (
              <Toggle
                label="趋势线"
                checked={scatterTrendLine}
                onChange={setScatterTrendLine}
              />
            )}
            {chartType === "combo" && (
              <>
                <Toggle
                  label="双 Y 轴（柱左 / 线右）"
                  checked={comboDualAxis}
                  onChange={setComboDualAxis}
                />
                {comboDualAxis && (
                  <>
                    <label className="field settings-field">
                      <span>右轴标题</span>
                      <input
                        value={y2AxisTitle}
                        onChange={(event) => setY2AxisTitle(event.target.value)}
                        placeholder="如：增长率"
                      />
                    </label>
                    <Toggle
                      label="同步两轴范围"
                      checked={comboAxisSync}
                      onChange={setComboAxisSync}
                    />
                  </>
                )}
              </>
            )}
            {chartType === "streamgraph" && (
              <Toggle
                label="时间轴（按日期解析）"
                checked={streamTimeAxis}
                onChange={setStreamTimeAxis}
              />
            )}
            {supportsBarShapeControl && (
              <>
                <label className="range-field">
                  <span>
                    柱条宽度 <strong>{barWidth}px</strong>
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={96}
                    value={barWidth}
                    onChange={(event) => setBarWidth(Number(event.target.value))}
                  />
                </label>
                <label className="range-field">
                  <span>
                    圆角 <strong>{barRadius}px</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={barRadius}
                    onChange={(event) => setBarRadius(Number(event.target.value))}
                  />
                </label>
                {selectedTemplate.family === "bar" && (
                  <>
                    <label className="field">
                      <span>分类排序</span>
                      <select
                        value={sortCategories ? `${sortCategories.bySeries}:${sortCategories.order}` : ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) {
                            setSortCategories(null);
                            return;
                          }
                          const [bySeries, order] = value.split(":");
                          setSortCategories({
                            bySeries,
                            order: order === "desc" ? "desc" : "asc",
                          });
                        }}
                      >
                        <option value="">默认（原序）</option>
                        {seriesColumns.map((header) => (
                          <optgroup key={header} label={header}>
                            <option value={`${header}:asc`}>升序</option>
                            <option value={`${header}:desc`}>降序</option>
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    {(chartType === "stackedBar" ||
                      chartType === "stackedColumn" ||
                      chartType === "proportionalBar" ||
                      chartType === "proportionalColumn") && (
                      <>
                        <Toggle
                          label="堆叠总计"
                          checked={showStackTotals}
                          onChange={setShowStackTotals}
                        />
                        <label className="field">
                          <span>堆叠顺序</span>
                          <select
                            value={stackOrder ?? ""}
                            onChange={(event) =>
                              setStackOrder(
                                event.target.value === "asc" || event.target.value === "desc"
                                  ? event.target.value
                                  : null,
                              )
                            }
                          >
                            <option value="">默认（原序）</option>
                            <option value="asc">按总量升序</option>
                            <option value="desc">按总量降序</option>
                          </select>
                        </label>
                      </>
                    )}
                    <label className="range-field">
                      <span>
                        组内间距 <strong>{barGap ?? 30}%</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={barGap ?? 30}
                        onChange={(event) => setBarGap(Number(event.target.value))}
                      />
                    </label>
                    <label className="range-field">
                      <span>
                        组间间距 <strong>{barCategoryGap ?? 20}%</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={barCategoryGap ?? 20}
                        onChange={(event) => setBarCategoryGap(Number(event.target.value))}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {supportsAreaOpacityControl && (
              <label className="range-field">
                <span>
                  面积透明度 <strong>{areaOpacity}%</strong>
                </span>
	                <input
	                  type="range"
	                  min={5}
	                  max={100}
	                  value={areaOpacity}
	                  onChange={(event) => setAreaOpacity(Number(event.target.value))}
	                />
	              </label>
            )}
            {supportsMarkOpacityControl && (
              <label className="range-field">
                <span>
                  {markOpacityLabel} <strong>{markOpacity}%</strong>
                </span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={markOpacity}
                  onChange={(event) => setMarkOpacity(Number(event.target.value))}
                />
              </label>
            )}
          </SettingsSection>

          <SettingsSection
            id="labels"
            query={settingsQuery}
            icon={<Table2 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.labels}
            hidden={!sectionShown("labels")}
            onToggle={() => toggleSettingsSection("labels")}
          >
            <Toggle
              label="显示数据标签"
              checked={showLabels}
              onChange={setShowLabels}
            />
            <label className="field settings-field">
              <span>标签位置</span>
              <select
                value={labelPosition}
                onChange={(event) =>
                  setLabelPosition(event.target.value as LabelPosition)
                }
              >
                {LABEL_POSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <TextStyleControls
              label="标签样式"
              style={labelStyle}
              fallbackColor={theme.text}
              onChange={setLabelStyle}
            />
            {(chartType === "pie" || chartType === "donut") && (
              <>
                <label className="field settings-field">
                  <span>标签内容</span>
                  <select
                    value={pieLabelContent ?? ""}
                    onChange={(event) =>
                      setPieLabelContent(
                        event.target.value === "value" ||
                          event.target.value === "percent" ||
                          event.target.value === "both"
                          ? event.target.value
                          : null,
                      )
                    }
                  >
                    <option value="">默认（名称 + 百分比）</option>
                    <option value="value">数值</option>
                    <option value="percent">百分比</option>
                    <option value="both">数值 + 百分比</option>
                  </select>
                </label>
                <label className="field settings-field">
                  <span>扇区排序</span>
                  <select
                    value={pieSort ?? ""}
                    onChange={(event) =>
                      setPieSort(
                        event.target.value === "asc" || event.target.value === "desc"
                          ? event.target.value
                          : null,
                      )
                    }
                  >
                    <option value="">默认（原序）</option>
                    <option value="asc">按数值升序</option>
                    <option value="desc">按数值降序</option>
                  </select>
                </label>
                <label className="range-field">
                  <span>
                    起始角 <strong>{startAngle ?? 90}°</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={startAngle ?? 90}
                    onChange={(event) => setStartAngle(Number(event.target.value))}
                  />
                </label>
                <label className="range-field">
                  <span>
                    其他项阈值 <strong>{pieOtherThreshold ?? 0}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={pieOtherThreshold ?? 0}
                    onChange={(event) =>
                      setPieOtherThreshold(Number(event.target.value) || null)
                    }
                  />
                </label>
              </>
            )}
            {chartType === "donut" && (
              <label className="range-field">
                <span>
                  内径比例 <strong>{Math.round((donutInnerRadius ?? 0.56) * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={Math.round((donutInnerRadius ?? 0.56) * 100)}
                  onChange={(event) =>
                    setDonutInnerRadius(Number(event.target.value) / 100)
                  }
                />
              </label>
            )}
          </SettingsSection>

          <SettingsSection
            id="xAxis"
            query={settingsQuery}
            icon={<Columns3 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.xAxis}
            hidden={!sectionShown("xAxis")}
            onToggle={() => toggleSettingsSection("xAxis")}
          >
            <Toggle
              label="显示 X 轴"
              checked={showXAxis}
              onChange={setShowXAxis}
            />
            <label className="field settings-field">
              <span>轴标题</span>
              <input
                value={xAxisTitle}
                onChange={(event) => setXAxisTitle(event.target.value)}
                placeholder="留空则不显示"
              />
            </label>
            <TextStyleControls
              label="X 轴标题样式"
              style={xAxisTitleStyle}
              fallbackColor={theme.text}
              onChange={setXAxisTitleStyle}
            />
            <label className="range-field">
              <span>
                标签旋转 <strong>{axisLabelRotation}°</strong>
              </span>
              <input
                type="range"
                min={-90}
                max={90}
                step={15}
                value={axisLabelRotation}
                onChange={(event) =>
                  setAxisLabelRotation(Number(event.target.value))
                }
              />
            </label>
            <TextStyleControls
              label="X 轴刻度样式"
              style={xAxisLabelStyle}
              fallbackColor={theme.text}
              onChange={setXAxisLabelStyle}
            />
          </SettingsSection>

          <SettingsSection
            id="yAxis"
            query={settingsQuery}
            icon={<BarChart3 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.yAxis}
            hidden={!sectionShown("yAxis")}
            onToggle={() => toggleSettingsSection("yAxis")}
          >
            <Toggle
              label="显示 Y 轴"
              checked={showYAxis}
              onChange={setShowYAxis}
            />
            <label className="field settings-field">
              <span>轴标题</span>
              <input
                value={yAxisTitle}
                onChange={(event) => setYAxisTitle(event.target.value)}
                placeholder="留空则不显示"
              />
            </label>
            <TextStyleControls
              label="Y 轴标题样式"
              style={yAxisTitleStyle}
              fallbackColor={theme.text}
              onChange={setYAxisTitleStyle}
            />
            <div className="field-row">
              <label className="field settings-field">
                <span>最小值</span>
                <input
                  inputMode="decimal"
                  value={yAxisMin}
                  onChange={(event) => setYAxisMin(event.target.value)}
                  placeholder="自动"
                />
              </label>
              <label className="field settings-field">
                <span>最大值</span>
                <input
                  inputMode="decimal"
                  value={yAxisMax}
                  onChange={(event) => setYAxisMax(event.target.value)}
                  placeholder="自动"
                />
              </label>
            </div>
            <TextStyleControls
              label="Y 轴刻度样式"
              style={yAxisLabelStyle}
              fallbackColor={theme.text}
              onChange={setYAxisLabelStyle}
            />
            <Toggle
              label="显示网格线"
              checked={showGrid}
              onChange={setShowGrid}
            />
            <label className="field settings-field">
              <span>网格线样式</span>
              <select
                value={gridLineType}
                onChange={(event) =>
                  setGridLineType(
                    event.target.value as "solid" | "dashed" | "dotted",
                  )
                }
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
            </label>
          </SettingsSection>

          <SettingsSection
            id="legend"
            query={settingsQuery}
            icon={<LayoutGrid size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.legend}
            hidden={!sectionShown("legend")}
            onToggle={() => toggleSettingsSection("legend")}
          >
            {supportsLegendControl && (
              <>
                <Toggle
                  label="显示图例"
                  checked={showLegend}
                  onChange={setShowLegend}
                />
                <label className="field settings-field">
                  <span>图例位置</span>
                  <select
                    value={legendPosition}
                    onChange={(event) => {
                      const nextPosition = event.target.value as LegendPosition;
                      setLegendPosition(nextPosition);
                      setLegendAlign(defaultLegendAlignForPosition(nextPosition));
                    }}
                  >
                    <option value="top">顶部</option>
                    <option value="bottom">底部</option>
                    <option value="left">左侧</option>
                    <option value="right">右侧</option>
                  </select>
                </label>
                <label className="field settings-field">
                  <span>图例对齐</span>
                  <select
                    value={legendAlign}
                    onChange={(event) =>
                      setLegendAlign(event.target.value as LegendAlign)
                    }
                  >
                    {(legendPosition === "left" || legendPosition === "right"
                      ? LEGEND_VERTICAL_ALIGN_OPTIONS
                      : LEGEND_HORIZONTAL_ALIGN_OPTIONS
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <Toggle
              label="悬停提示"
              checked={showTooltip}
              onChange={setShowTooltip}
            />
          </SettingsSection>

          <SettingsSection
            id="numbers"
            query={settingsQuery}
            icon={<Settings2 size={15} />}
            open={Boolean(settingsQuery) || settingsOpen.numbers}
            hidden={!sectionShown("numbers")}
            onToggle={() => toggleSettingsSection("numbers")}
          >
            <label className="field settings-field">
              <span>小数位数</span>
              <select
                value={numberDecimals}
                onChange={(event) =>
                  setNumberDecimals(Number(event.target.value))
                }
              >
                {[0, 1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-row">
              <label className="field settings-field">
                <span>前缀</span>
                <input
                  value={numberPrefix}
                  onChange={(event) => setNumberPrefix(event.target.value)}
                  placeholder="如 ¥"
                />
              </label>
              <label className="field settings-field">
                <span>后缀</span>
                <input
                  value={numberSuffix}
                  onChange={(event) => setNumberSuffix(event.target.value)}
                  placeholder="如 万元"
                />
              </label>
            </div>
            <Toggle
              label="使用千分位"
              checked={useThousandsSeparator}
              onChange={setUseThousandsSeparator}
            />
          </SettingsSection>

          {settingsQuery &&
            !(Object.keys(SETTINGS_SECTION_META) as SettingsSectionId[]).some(
              sectionShown,
            ) && (
              <div className="settings-empty">没有匹配的设置</div>
            )}
        </aside>
      </div>

      <TemplateGallery
        open={templateOpen}
        selected={chartType}
        onClose={() => setTemplateOpen(false)}
        onSelect={selectTemplate}
      />

      {authPanelOpen && (
        <AuthDialog
          mode={authMode}
          email={authEmail}
          password={authPassword}
          message={authMessage}
          verificationUrl={authVerificationUrl}
          submitting={authSubmitting}
          onClose={() => setAuthPanelOpen(false)}
          onModeChange={openAuthPanel}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAuthPassword}
          onSubmit={submitAuthForm}
        />
      )}

      <ConfirmDialog
        open={resetConfirmOpen}
        title="确认恢复示例"
        description="这会重置当前数据、标题、画布和全部样式。操作完成后仍可使用撤销恢复。"
        confirmLabel="恢复示例"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={resetAll}
      />

      {status && (
        <div className="toast" role="status">
          <Check size={16} />
          {status}
        </div>
      )}
    </main>
  );
}
