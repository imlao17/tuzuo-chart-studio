import type { EChartsOption } from "echarts";
import { buildWithRenderer, getTemplateDefinition } from "./template-definition";

export type ChartType =
  | "line"
  | "smoothLine"
  | "stepLine"
  | "area"
  | "stackedArea"
  | "proportionalArea"
  | "bar"
  | "stackedBar"
  | "proportionalBar"
  | "column"
  | "groupedColumn"
  | "stackedColumn"
  | "proportionalColumn"
  | "combo"
  | "donut"
  | "pie"
  | "scatter"
  | "divergingBar"
  | "populationPyramid"
  | "streamgraph";

export type ChartFamily = "line" | "area" | "bar" | "pie" | "other";

export type ChartTemplate = {
  id: ChartType;
  name: string;
  family: ChartFamily;
};

export type ThemePreset = {
  id: string;
  name: string;
  colors: string[];
  text: string;
  grid: string;
};

export type Margins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  numericHeaders: string[];
  error?: string;
};

export type ChartConfig = {
  type: ChartType;
  parsed: ParsedTable;
  categoryColumn: string;
  seriesColumns: string[];
  title: string;
  subtitle: string;
  width: number;
  height: number;
  margins: Margins;
  theme: ThemePreset;
  primaryColor: string;
  secondaryColor: string;
  paletteColors?: string[];
  colorOverrides?: Record<string, string>;
  backgroundColor: string;
  transparent: boolean;
  showLabels: boolean;
  showLegend: boolean;
  showGrid: boolean;
  smooth: boolean;
  fontSize: number;
  lineWidth?: number;
  pointSize?: number;
  barWidth?: number;
  barRadius?: number;
  markOpacity?: number;
  areaOpacity?: number;
  labelPosition?: "auto" | "inside" | "outside";
  showXAxis?: boolean;
  showYAxis?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  axisLabelRotation?: number;
  yAxisMin?: string;
  yAxisMax?: string;
  legendPosition?: "top" | "bottom" | "left" | "right";
  showTooltip?: boolean;
  gridLineType?: "solid" | "dashed" | "dotted";
  numberDecimals?: number;
  numberPrefix?: string;
  numberSuffix?: string;
  useThousandsSeparator?: boolean;
  titleAlign?: "left" | "center" | "right";
  // Combo chart only: per-series "bar" or "line" role. When unset for a series
  // the renderer falls back to the legacy rule (first series = bar, rest = line).
  seriesKind?: Record<string, "bar" | "line">;
  // Sort categories by a series' values. Undefined = original row order.
  sortCategories?: { bySeries?: string; order?: "asc" | "desc" };
  // Stacked bar/column only: show the column total on top of each stack.
  showStackTotals?: boolean;
  // Stacked bar/column only: reorder series within a stack by their total value.
  stackOrder?: "asc" | "desc";
  // Grouped/stacked bar spacing. Numbers are interpreted by ECharts (percent of bar width).
  barGap?: number;
  barCategoryGap?: number;
  // Line/area family: connect across missing (NaN) values instead of leaving a gap.
  connectNulls?: boolean;
  // Line family only: show a label at the last point of each series.
  endLabel?: boolean;
  // Line/area family: shaded vertical bands across a category range.
  referenceBands?: Array<{ start: string; end: string; label?: string }>;
  // Line/area family: horizontal reference lines at fixed Y values.
  referenceLines?: Array<{ value: number; label?: string }>;
  // Pie/donut family: what the slice labels show.
  pieLabelContent?: "value" | "percent" | "both";
  // Donut only: inner radius as a fraction of the outer radius (0–1).
  donutInnerRadius?: number;
  // Pie/donut: sort slices by value.
  pieSort?: "asc" | "desc";
  // Pie/donut: starting angle in degrees.
  startAngle?: number;
  // Pie/donut: merge slices below this percent of the total into an "其他" slice.
  pieOtherThreshold?: number;
  // Scatter only: column driving per-point size (bubble), color (categorical),
  // or shape (categorical). Undefined = single global size/color/shape.
  sizeColumn?: string;
  colorColumn?: string;
  shapeColumn?: string;
  // Scatter only: draw a least-squares trend line through the points.
  scatterTrendLine?: boolean;
  compact?: boolean;
};

export const INITIAL_TABLE = [
  ["月份", "实际收入", "目标"],
  ["一月", "128", "110"],
  ["二月", "146", "125"],
  ["三月", "138", "140"],
  ["四月", "172", "150"],
  ["五月", "189", "165"],
  ["六月", "218", "190"],
];

export const THEMES: ThemePreset[] = [
  {
    id: "editorial",
    name: "编辑蓝",
    colors: ["#2563eb", "#f15a3a", "#16a36a", "#e8ae17", "#9b51e0"],
    text: "#17202a",
    grid: "#dfe3e8",
  },
  {
    id: "fresh",
    name: "清新",
    colors: ["#0f8b8d", "#ff7a45", "#4c78df", "#f2b134", "#7b61a8"],
    text: "#163331",
    grid: "#dce7e5",
  },
  {
    id: "magazine",
    name: "杂志",
    colors: ["#171717", "#e5484d", "#168aad", "#f4a261", "#8661c1"],
    text: "#171717",
    grid: "#dedede",
  },
  {
    id: "soft",
    name: "柔和",
    colors: ["#6577c9", "#e07a5f", "#5a9367", "#e9b44c", "#9c6ade"],
    text: "#30343b",
    grid: "#e1e2e5",
  },
  {
    id: "mono",
    name: "黑白",
    colors: ["#222222", "#777777", "#a7a7a7", "#d0d0d0", "#525252"],
    text: "#191919",
    grid: "#dedede",
  },
];

export const CHART_TEMPLATES: ChartTemplate[] = [
  { id: "line", name: "折线图", family: "line" },
  { id: "smoothLine", name: "平滑折线图", family: "line" },
  { id: "stepLine", name: "阶梯折线图", family: "line" },
  { id: "area", name: "面积图", family: "area" },
  { id: "stackedArea", name: "堆叠面积图", family: "area" },
  { id: "proportionalArea", name: "百分比面积图", family: "area" },
  { id: "bar", name: "条形图", family: "bar" },
  { id: "stackedBar", name: "堆叠条形图", family: "bar" },
  { id: "proportionalBar", name: "百分比条形图", family: "bar" },
  { id: "column", name: "柱状图", family: "bar" },
  { id: "groupedColumn", name: "分组柱状图", family: "bar" },
  { id: "stackedColumn", name: "堆叠柱状图", family: "bar" },
  { id: "proportionalColumn", name: "百分比柱状图", family: "bar" },
  { id: "combo", name: "柱线组合图", family: "other" },
  { id: "donut", name: "环形图", family: "pie" },
  { id: "pie", name: "饼图", family: "pie" },
  { id: "scatter", name: "散点图", family: "other" },
  { id: "divergingBar", name: "发散条形图", family: "other" },
  { id: "populationPyramid", name: "人口金字塔", family: "other" },
  { id: "streamgraph", name: "河流图", family: "area" },
];

export function toNumber(value: string) {
  const normalized = value
    .trim()
    .replace(/[￥¥$,\s]/g, "")
    .replace(/%$/, "");
  const negative =
    normalized.startsWith("(") && normalized.endsWith(")")
      ? `-${normalized.slice(1, -1)}`
      : normalized;
  const number = Number(negative);
  return Number.isFinite(number) ? number : Number.NaN;
}

function countDelimiter(line: string, delimiter: "," | "\t") {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (!quoted && line[index] === delimiter) count += 1;
  }

  return count;
}

export function parseDelimitedTable(raw: string) {
  const input = raw.replace(/^\uFEFF/, "").trim();
  const firstLine = input.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const delimiter: "," | "\t" =
    countDelimiter(firstLine, "\t") > countDelimiter(firstLine, ",")
      ? "\t"
      : ",";

  if (!input) return [["分类", "数值"]];

  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index <= input.length; index += 1) {
    const character = input[index] ?? "\n";
    const nextCharacter = input[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && character === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value !== "")) matrix.push(row);
      row = [];
      continue;
    }

    cell += character;
  }

  const columnCount = Math.max(2, ...matrix.map((values) => values.length));
  return matrix.map((values) =>
    Array.from({ length: columnCount }, (_, index) => values[index] ?? ""),
  );
}

export function tableToParsed(table: string[][]): ParsedTable {
  const columnCount = Math.max(2, ...table.map((row) => row.length));
  const firstRow = table[0] ?? [];
  const usedHeaders = new Set<string>();
  const headers = Array.from({ length: columnCount }, (_, index) => {
    const base = firstRow[index]?.trim() || `列 ${index + 1}`;
    let candidate = base;
    let suffix = 2;
    while (usedHeaders.has(candidate)) {
      candidate = `${base} ${suffix}`;
      suffix += 1;
    }
    usedHeaders.add(candidate);
    return candidate;
  });
  const rows = table.slice(1).map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ""),
  );
  const numericHeaders = headers.filter((_, columnIndex) => {
    const populated = rows
      .map((row) => row[columnIndex])
      .filter((value) => value.trim() !== "");
    if (!populated.length) return false;
    return (
      populated.filter((value) => Number.isFinite(toNumber(value))).length /
        populated.length >=
      0.7
    );
  });

  return {
    headers,
    rows,
    numericHeaders,
    error: rows.length ? undefined : "至少需要一行数据",
  };
}

export function columnIndex(headers: string[], name: string) {
  return Math.max(0, headers.indexOf(name));
}

export function normalizeSeries(series: { name: string; data: number[] }[]) {
  if (!series.length) return series;
  return series.map((item) => ({
    ...item,
    data: item.data.map((value, rowIndex) => {
      const total = series.reduce((sum, candidate) => {
        const current = candidate.data[rowIndex];
        return sum + (Number.isFinite(current) ? Math.abs(current) : 0);
      }, 0);
      return total ? (value / total) * 100 : 0;
    }),
  }));
}

export function paletteFor(config: ChartConfig) {
  const custom = config.paletteColors?.filter(Boolean);
  return custom?.length
    ? custom
    : [
        config.primaryColor,
        config.secondaryColor,
        ...config.theme.colors.slice(2),
      ];
}

export function colorFor(index: number, config: ChartConfig, name?: string) {
  if (name && config.colorOverrides?.[name]) {
    return config.colorOverrides[name];
  }
  const palette = paletteFor(config);
  return palette[index % palette.length];
}

export function numberFormatter(config: ChartConfig, proportional: boolean) {
  return (rawValue: string | number) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return String(rawValue);
    const decimals = Math.min(6, Math.max(0, config.numberDecimals ?? 0));
    const formatted = value.toLocaleString("zh-CN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: config.useThousandsSeparator ?? true,
    });
    return `${config.numberPrefix ?? ""}${formatted}${
      proportional ? "%" : config.numberSuffix ?? ""
    }`;
  };
}

export function numericBound(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildChartOption(config: ChartConfig): EChartsOption {
  // All 20 templates are registered with a per-family renderer; the legacy
  // monolithic builder has been removed. buildWithRenderer assembles the
  // shared title/legend/tooltip/grid/textStyle around the renderer's output.
  return buildWithRenderer(config, getTemplateDefinition(config.type));
}

export function buildThumbnailOption(type: ChartType): EChartsOption {
  // Each template's thumbnail uses its own semantically appropriate sample
  // data, so the gallery previews show a meaningful shape (e.g. scatter shows
  // a real point cloud, pyramid shows age bands) instead of one generic table.
  const { sampleData } = getTemplateDefinition(type);
  const parsed = tableToParsed(sampleData.table);
  return buildChartOption({
    type,
    parsed,
    categoryColumn: sampleData.categoryColumn,
    seriesColumns: sampleData.seriesColumns,
    title: "",
    subtitle: "",
    width: 240,
    height: 116,
    margins: { top: 4, right: 4, bottom: 4, left: 4 },
    theme: THEMES[0],
    primaryColor: THEMES[0].colors[0],
    secondaryColor: "#4aa7f3",
    backgroundColor: "#ffffff",
    transparent: false,
    showLabels: false,
    showLegend: false,
    showGrid: false,
    smooth: true,
    fontSize: 9,
    compact: true,
  });
}
