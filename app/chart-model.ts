import type { EChartsOption } from "echarts";
import { buildWithRenderer, getTemplateDefinition } from "./template-definition";

export type ChartType =
  | "line"
  | "smoothLine"
  | "stepLine"
  | "pointLine"
  | "dualAxisLine"
  | "slopeChart"
  | "bump"
  | "area"
  | "stackedArea"
  | "proportionalArea"
  | "smoothArea"
  | "stepArea"
  | "bandArea"
  | "ridgeline"
  | "bar"
  | "stackedBar"
  | "proportionalBar"
  | "column"
  | "groupedColumn"
  | "stackedColumn"
  | "proportionalColumn"
  | "histogram"
  | "densityHistogram"
  | "rangeBar"
  | "rangeColumn"
  | "bulletBar"
  | "lollipop"
  | "pictorialColumn"
  | "progressBar"
  | "rankingBar"
  | "pareto"
  | "combo"
  | "donut"
  | "pie"
  | "rose"
  | "roseArea"
  | "radialBar"
  | "radialStackedBar"
  | "progressRing"
  | "polarLine"
  | "polarArea"
  | "scatter"
  | "bubble"
  | "groupedScatter"
  | "quadrant"
  | "trendScatter"
  | "beeswarm"
  | "sunburst"
  | "dendrogram"
  | "radialTree"
  | "orgChart"
  | "networkGraph"
  | "chord"
  | "adjacencyMatrix"
  | "alluvial"
  | "divergingBar"
  | "populationPyramid"
  | "streamgraph"
  | "dotPlot"
  | "waterfall"
  | "heatmap"
  | "treemap"
  | "funnel"
  | "gauge"
  | "radar"
  | "boxplot"
  | "candlestick"
  | "sankey"
  | "parallelCoordinates"
  | "calendarHeatmap"
  | "ecdf"
  | "errorBar"
  | "correlationMatrix"
  | "violin"
  | "marimekko"
  | "groupedBar"
  | "capsuleBar"
  | "arrowBar"
  | "dumbbell"
  | "stackedDot"
  | "ohlcBar"
  | "candleVolume"
  | "splitAxisBar"
  | "halfDonut"
  | "multiRing"
  | "boxplotHorizontal"
  | "densityHeatmap"
  | "kpiCard"
  | "kpiCardRow"
  | "sparklineCard"
  | "barTable"
  | "wordCloud"
  | "gantt"
  | "timeline"
  | "smallMultiples"
  | "worldChoropleth"
  | "chinaChoropleth"
  | "symbolMap"
  | "geoHeatmap"
  | "flowMap";

export type ChartFamily = "line" | "area" | "bar" | "pie" | "other";

export type ChartTemplate = {
  id: ChartType;
  name: string;
  family: ChartFamily;
  /** Gallery grouping label (display only; rendering behavior keys on family). */
  category: string;
};

/** Gallery category order + labels. Aligned with the README family table. */
export const TEMPLATE_CATEGORIES: string[] = [
  "柱/条",
  "折线/面积",
  "饼/环",
  "组合",
  "散点/分布",
  "发散",
  "层级",
  "网络",
  "高级常用",
  "统计/分布",
  "金融/比较",
  "卡片/文字",
  "时间/分面",
  "地图",
];

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

export type LabelPosition =
  | "auto"
  | "outside"
  | "outsideTop"
  | "outsideRight"
  | "outsideBottom"
  | "outsideLeft"
  | "inside"
  | "insideCenter"
  | "insideLeft"
  | "insideRight"
  | "insideTop"
  | "insideBottom";

export type LegendPosition = "top" | "bottom" | "left" | "right";
export type LegendAlign = "start" | "center" | "end";

export function defaultLegendAlignForPosition(
  position: LegendPosition = "top",
): LegendAlign {
  return position === "top" ? "end" : "center";
}

export type TextStyleConfig = {
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
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
  sourceColumn?: string;
  targetColumn?: string;
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
  labelColor?: string;
  labelPosition?: LabelPosition;
  showXAxis?: boolean;
  showYAxis?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
  axisLabelRotation?: number;
  yAxisMin?: string;
  yAxisMax?: string;
  legendPosition?: LegendPosition;
  legendAlign?: LegendAlign;
  showTooltip?: boolean;
  gridLineType?: "solid" | "dashed" | "dotted";
  numberDecimals?: number;
  numberPrefix?: string;
  numberSuffix?: string;
  useThousandsSeparator?: boolean;
  titleAlign?: "left" | "center" | "right";
  titleStyle?: TextStyleConfig;
  subtitleStyle?: TextStyleConfig;
  axisTitleStyle?: TextStyleConfig;
  axisLabelStyle?: TextStyleConfig;
  xAxisTitleStyle?: TextStyleConfig;
  yAxisTitleStyle?: TextStyleConfig;
  xAxisLabelStyle?: TextStyleConfig;
  yAxisLabelStyle?: TextStyleConfig;
  labelStyle?: TextStyleConfig;
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
  // Quadrant chart only: reference lines use the median (default) or the mean.
  quadrantCenter?: "median" | "mean";
  // Pictorial column only: value each unit glyph represents. Undefined lets
  // the renderer pick an adaptive unit from the data (max ÷ 10).
  pictorialUnitValue?: number;
  // Scatter only: draw a least-squares trend line through the points.
  scatterTrendLine?: boolean;
  // Combo only: split bar/line series across left and right Y axes.
  comboDualAxis?: boolean;
  // Combo only: title for the right (secondary) Y axis.
  y2AxisTitle?: string;
  // Combo only: link the two Y axes to a shared min/max.
  comboAxisSync?: boolean;
  // Streamgraph only: parse the category column as dates and use a time axis.
  streamTimeAxis?: boolean;
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
    id: "flourish",
    name: "Flourish",
    colors: [
      "#0053d7",
      "#098efa",
      "#8a4bcf",
      "#f2457f",
      "#f9591c",
      "#f1af2d",
      "#0b7d8a",
      "#1ba05e",
      "#d82731",
      "#9da1a5",
      "#757575",
    ],
    text: "#17202a",
    grid: "#dfe3e8",
  },
  {
    id: "flourish-alternate",
    name: "Flourish Alternate",
    colors: [
      "#0053d7",
      "#f2457f",
      "#098efa",
      "#f1af2d",
      "#8a4bcf",
      "#0b7d8a",
      "#f9591c",
      "#1ba05e",
      "#d82731",
      "#9da1a5",
      "#757575",
    ],
    text: "#17202a",
    grid: "#dfe3e8",
  },
  {
    id: "flourish-light",
    name: "Flourish Light",
    colors: [
      "#296ad7",
      "#5bb2fb",
      "#a95fcf",
      "#fe6d8a",
      "#f98f56",
      "#f1bb43",
      "#37949d",
      "#50b98b",
      "#d95254",
      "#9da1a5",
      "#757575",
    ],
    text: "#17202a",
    grid: "#dfe3e8",
  },
  {
    id: "flourish-light-alternate",
    name: "Flourish Light Alternate",
    colors: [
      "#296ad7",
      "#fe6d8a",
      "#5bb2fb",
      "#f1bb43",
      "#a95fcf",
      "#37949d",
      "#f98f56",
      "#50b98b",
      "#d95254",
      "#9da1a5",
      "#757575",
    ],
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
  { id: "line", name: "折线图", family: "line", category: "折线/面积" },
  { id: "smoothLine", name: "平滑折线图", family: "line", category: "折线/面积" },
  { id: "stepLine", name: "阶梯折线图", family: "line", category: "折线/面积" },
  { id: "pointLine", name: "点线图", family: "line", category: "折线/面积" },
  { id: "dualAxisLine", name: "双轴折线图", family: "line", category: "折线/面积" },
  { id: "slopeChart", name: "斜率图", family: "line", category: "折线/面积" },
  { id: "bump", name: "凹凸图", family: "line", category: "折线/面积" },
  { id: "area", name: "面积图", family: "area", category: "折线/面积" },
  { id: "stackedArea", name: "堆叠面积图", family: "area", category: "折线/面积" },
  { id: "proportionalArea", name: "百分比面积图", family: "area", category: "折线/面积" },
  { id: "smoothArea", name: "平滑面积图", family: "area", category: "折线/面积" },
  { id: "stepArea", name: "阶梯面积图", family: "area", category: "折线/面积" },
  { id: "bandArea", name: "区间面积图", family: "area", category: "折线/面积" },
  { id: "ridgeline", name: "脊线图", family: "area", category: "折线/面积" },
  { id: "bar", name: "条形图", family: "bar", category: "柱/条" },
  { id: "stackedBar", name: "堆叠条形图", family: "bar", category: "柱/条" },
  { id: "proportionalBar", name: "百分比条形图", family: "bar", category: "柱/条" },
  { id: "column", name: "柱状图", family: "bar", category: "柱/条" },
  { id: "groupedColumn", name: "分组柱状图", family: "bar", category: "柱/条" },
  { id: "stackedColumn", name: "堆叠柱状图", family: "bar", category: "柱/条" },
  { id: "proportionalColumn", name: "百分比柱状图", family: "bar", category: "柱/条" },
  { id: "histogram", name: "直方图", family: "bar", category: "柱/条" },
  { id: "densityHistogram", name: "密度直方图", family: "bar", category: "柱/条" },
  { id: "rangeBar", name: "区间条形图", family: "bar", category: "柱/条" },
  { id: "rangeColumn", name: "区间柱状图", family: "bar", category: "柱/条" },
  { id: "bulletBar", name: "子弹图", family: "bar", category: "柱/条" },
  { id: "lollipop", name: "滑珠图", family: "bar", category: "柱/条" },
  { id: "pictorialColumn", name: "象形柱状图", family: "bar", category: "柱/条" },
  { id: "progressBar", name: "进度条形图", family: "bar", category: "柱/条" },
  { id: "rankingBar", name: "排名条形图", family: "bar", category: "柱/条" },
  { id: "pareto", name: "帕累托图", family: "bar", category: "柱/条" },
  { id: "combo", name: "柱线组合图", family: "other", category: "组合" },
  { id: "donut", name: "环形图", family: "pie", category: "饼/环" },
  { id: "halfDonut", name: "半环形图", family: "pie", category: "饼/环" },
  { id: "multiRing", name: "多层环形图", family: "pie", category: "饼/环" },
  { id: "pie", name: "饼图", family: "pie", category: "饼/环" },
  { id: "rose", name: "玫瑰图", family: "pie", category: "饼/环" },
  { id: "roseArea", name: "面积玫瑰图", family: "pie", category: "饼/环" },
  { id: "radialBar", name: "径向条形图", family: "pie", category: "饼/环" },
  { id: "radialStackedBar", name: "径向堆叠条形图", family: "pie", category: "饼/环" },
  { id: "progressRing", name: "进度环形图", family: "pie", category: "饼/环" },
  { id: "polarLine", name: "极坐标折线图", family: "pie", category: "饼/环" },
  { id: "polarArea", name: "极坐标面积图", family: "pie", category: "饼/环" },
  { id: "scatter", name: "散点图", family: "other", category: "散点/分布" },
  { id: "bubble", name: "气泡图", family: "other", category: "散点/分布" },
  { id: "groupedScatter", name: "分组散点图", family: "other", category: "散点/分布" },
  { id: "quadrant", name: "象限图", family: "other", category: "散点/分布" },
  { id: "trendScatter", name: "回归散点图", family: "other", category: "散点/分布" },
  { id: "beeswarm", name: "蜂群图", family: "other", category: "散点/分布" },
  { id: "sunburst", name: "旭日图", family: "other", category: "层级" },
  { id: "dendrogram", name: "树状图", family: "other", category: "层级" },
  { id: "radialTree", name: "径向树图", family: "other", category: "层级" },
  { id: "orgChart", name: "组织架构图", family: "other", category: "层级" },
  { id: "networkGraph", name: "力导向网络图", family: "other", category: "网络" },
  { id: "chord", name: "弦图", family: "other", category: "网络" },
  { id: "adjacencyMatrix", name: "邻接矩阵图", family: "other", category: "网络" },
  { id: "alluvial", name: "冲积图", family: "other", category: "网络" },
  { id: "divergingBar", name: "发散条形图", family: "other", category: "发散" },
  { id: "populationPyramid", name: "人口金字塔", family: "other", category: "发散" },
  { id: "streamgraph", name: "河流图", family: "area", category: "折线/面积" },
  { id: "dotPlot", name: "点图", family: "other", category: "高级常用" },
  { id: "waterfall", name: "瀑布图", family: "other", category: "高级常用" },
  { id: "heatmap", name: "热力图", family: "other", category: "高级常用" },
  { id: "treemap", name: "矩形树图", family: "other", category: "层级" },
  { id: "funnel", name: "漏斗图", family: "other", category: "高级常用" },
  { id: "gauge", name: "仪表盘", family: "other", category: "高级常用" },
  { id: "radar", name: "雷达图", family: "other", category: "高级常用" },
  { id: "boxplot", name: "箱线图", family: "other", category: "高级常用" },
  { id: "boxplotHorizontal", name: "水平箱线图", family: "other", category: "高级常用" },
  { id: "densityHeatmap", name: "密度热力散点图", family: "other", category: "散点/分布" },
  { id: "candlestick", name: "蜡烛图", family: "other", category: "高级常用" },
  { id: "sankey", name: "桑基图", family: "other", category: "网络" },
  { id: "kpiCard", name: "大数字卡", family: "other", category: "卡片/文字" },
  { id: "kpiCardRow", name: "指标卡组", family: "other", category: "卡片/文字" },
  { id: "sparklineCard", name: "趋势迷你卡", family: "other", category: "卡片/文字" },
  { id: "barTable", name: "条形表格图", family: "other", category: "卡片/文字" },
  { id: "wordCloud", name: "词云", family: "other", category: "卡片/文字" },
  { id: "gantt", name: "甘特图", family: "bar", category: "时间/分面" },
  { id: "timeline", name: "时间线图", family: "other", category: "时间/分面" },
  { id: "smallMultiples", name: "小倍数分面图", family: "other", category: "时间/分面" },
  { id: "worldChoropleth", name: "世界分级统计地图", family: "other", category: "地图" },
  { id: "chinaChoropleth", name: "中国分级统计地图", family: "other", category: "地图" },
  { id: "symbolMap", name: "符号地图", family: "other", category: "地图" },
  { id: "geoHeatmap", name: "地点热力地图", family: "other", category: "地图" },
  { id: "flowMap", name: "流向地图", family: "other", category: "地图" },
  { id: "groupedBar", name: "分组条形图", family: "bar", category: "柱/条" },
  { id: "capsuleBar", name: "胶囊条形图", family: "bar", category: "柱/条" },
  { id: "arrowBar", name: "箭头条形图", family: "bar", category: "柱/条" },
  { id: "dumbbell", name: "哑铃图", family: "other", category: "金融/比较" },
  { id: "stackedDot", name: "堆叠点图", family: "other", category: "金融/比较" },
  { id: "ohlcBar", name: "OHLC 条形图", family: "other", category: "金融/比较" },
  { id: "candleVolume", name: "蜡烛+成交量组合图", family: "other", category: "金融/比较" },
  { id: "splitAxisBar", name: "断轴条形图", family: "bar", category: "柱/条" },
  { id: "parallelCoordinates", name: "平行坐标图", family: "other", category: "统计/分布" },
  { id: "calendarHeatmap", name: "日历热力图", family: "other", category: "统计/分布" },
  { id: "ecdf", name: "累计分布图", family: "other", category: "统计/分布" },
  { id: "errorBar", name: "误差线图", family: "other", category: "统计/分布" },
  { id: "correlationMatrix", name: "相关性矩阵图", family: "other", category: "统计/分布" },
  { id: "violin", name: "小提琴图", family: "other", category: "统计/分布" },
  { id: "marimekko", name: "马赛克图", family: "other", category: "统计/分布" },
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
  // Every template is registered with a per-family renderer; the legacy
  // monolithic builder has been removed. buildWithRenderer assembles the shared
  // title/legend/tooltip/grid/textStyle around the renderer's output.
  return buildWithRenderer(config, getTemplateDefinition(config.type));
}

export function buildThumbnailOption(type: ChartType): EChartsOption {
  // Each template's thumbnail uses its own semantically appropriate sample
  // data, so the gallery previews show a meaningful shape (e.g. scatter shows
  // a real point cloud, pyramid shows age bands) instead of one generic table.
  const { sampleData } = getTemplateDefinition(type);
  const parsed = tableToParsed(sampleData.table);
  const sourceDefault = sampleData.roleDefaults?.source;
  const targetDefault = sampleData.roleDefaults?.target;
  return buildChartOption({
    type,
    parsed,
    categoryColumn: sampleData.categoryColumn,
    seriesColumns: sampleData.seriesColumns,
    sourceColumn: typeof sourceDefault === "string" ? sourceDefault : undefined,
    targetColumn: typeof targetDefault === "string" ? targetDefault : undefined,
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
