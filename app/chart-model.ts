import type { EChartsOption, SeriesOption } from "echarts";

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
  backgroundColor: string;
  transparent: boolean;
  showLabels: boolean;
  showLegend: boolean;
  showGrid: boolean;
  smooth: boolean;
  fontSize: number;
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

function columnIndex(headers: string[], name: string) {
  return Math.max(0, headers.indexOf(name));
}

function normalizeSeries(series: { name: string; data: number[] }[]) {
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

function colorFor(index: number, config: ChartConfig) {
  const palette = [
    config.primaryColor,
    config.secondaryColor,
    ...config.theme.colors.slice(2),
  ];
  return palette[index % palette.length];
}

export function buildChartOption(config: ChartConfig): EChartsOption {
  const {
    type,
    parsed,
    categoryColumn,
    title,
    subtitle,
    width,
    height,
    margins,
    theme,
    backgroundColor,
    transparent,
    showLabels,
    showLegend,
    showGrid,
    smooth,
    fontSize,
    compact = false,
  } = config;
  const categoryIndex = columnIndex(parsed.headers, categoryColumn);
  const categories = parsed.rows.map((row) => row[categoryIndex]);
  const validSeriesColumns = config.seriesColumns.filter((header) =>
    parsed.numericHeaders.includes(header),
  );
  const selectedColumns = validSeriesColumns.length
    ? validSeriesColumns
    : parsed.numericHeaders.slice(0, 1);
  let dataSeries = selectedColumns.map((name) => {
    const index = columnIndex(parsed.headers, name);
    return {
      name,
      data: parsed.rows.map((row) => toNumber(row[index])),
    };
  });
  const proportional =
    type === "proportionalArea" ||
    type === "proportionalBar" ||
    type === "proportionalColumn";
  if (proportional) dataSeries = normalizeSeries(dataSeries);

  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const gridTop = compact ? 6 : margins.top + titleBlock;
  const gridBottom = compact ? 6 : margins.bottom;
  const gridLeft = compact ? 6 : margins.left;
  const gridRight = compact ? 6 : margins.right;
  const textColor = theme.text;
  const splitLine = {
    show: compact ? false : showGrid,
    lineStyle: { color: theme.grid, type: "dashed" as const },
  };
  const axisLabel = {
    show: !compact,
    color: textColor,
    fontSize,
    hideOverlap: true,
    formatter: proportional ? "{value}%" : undefined,
  };
  const valueAxis = {
    type: "value" as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel,
    splitLine,
    max: proportional ? 100 : undefined,
  };
  const categoryAxis = {
    type: "category" as const,
    data: categories,
    axisLine: {
      show: !compact,
      lineStyle: { color: "#aeb6bf" },
    },
    axisTick: { show: false },
    axisLabel,
  };
  const isHorizontal =
    type === "bar" ||
    type === "stackedBar" ||
    type === "proportionalBar" ||
    type === "divergingBar" ||
    type === "populationPyramid";
  const stacked =
    type === "stackedArea" ||
    type === "proportionalArea" ||
    type === "stackedBar" ||
    type === "proportionalBar" ||
    type === "stackedColumn" ||
    type === "proportionalColumn";
  let series: SeriesOption[] = [];
  let xAxis: EChartsOption["xAxis"] = isHorizontal ? valueAxis : categoryAxis;
  let yAxis: EChartsOption["yAxis"] = isHorizontal ? categoryAxis : valueAxis;
  let singleAxis: EChartsOption["singleAxis"];

  if (type === "pie" || type === "donut") {
    const innerTop = margins.top + titleBlock;
    const innerHeight = Math.max(80, height - innerTop - margins.bottom);
    const innerWidth = Math.max(80, width - margins.left - margins.right);
    const centerX = ((margins.left + innerWidth / 2) / width) * 100;
    const centerY = ((innerTop + innerHeight / 2) / height) * 100;
    const radius = Math.max(42, Math.min(innerWidth, innerHeight) * 0.38);
    const primary = dataSeries[0] ?? { name: "数值", data: [] };
    series = [
      {
        name: primary.name,
        type: "pie",
        radius: type === "donut" ? [radius * 0.56, radius] : [0, radius],
        center: [`${centerX}%`, `${centerY}%`],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: transparent ? "rgba(255,255,255,0.82)" : backgroundColor,
          borderWidth: compact ? 1 : 2,
          borderRadius: compact ? 1 : 3,
        },
        label: {
          show: compact ? false : showLabels,
          color: textColor,
          fontSize,
          formatter: "{b}\n{d}%",
          lineHeight: fontSize + 5,
        },
        data: categories.map((name, index) => ({
          name,
          value: primary.data[index],
        })),
      },
    ];
    xAxis = undefined;
    yAxis = undefined;
  } else if (type === "scatter") {
    const xName = selectedColumns[0] ?? parsed.numericHeaders[0];
    const yName = selectedColumns[1] ?? parsed.numericHeaders[1] ?? xName;
    const xIndex = columnIndex(parsed.headers, xName);
    const yIndex = columnIndex(parsed.headers, yName);
    series = [
      {
        name: yName,
        type: "scatter",
        symbolSize: compact ? 7 : 13,
        itemStyle: { color: colorFor(0, config), opacity: 0.82 },
        label: {
          show: compact ? false : showLabels,
          position: "top",
          color: textColor,
          fontSize,
          formatter: (params: unknown) => {
            const item = params as { dataIndex: number };
            return categories[item.dataIndex] ?? "";
          },
        },
        data: parsed.rows.map((row) => [
          toNumber(row[xIndex]),
          toNumber(row[yIndex]),
        ]),
      },
    ];
    xAxis = valueAxis;
    yAxis = valueAxis;
  } else if (type === "streamgraph") {
    const riverData = dataSeries.flatMap((item) =>
      item.data.map((value, index) => [index, value, item.name]),
    );
    singleAxis = {
      type: "value",
      top: gridTop,
      bottom: gridBottom,
      left: gridLeft,
      right: gridRight,
      axisLabel: {
        show: !compact,
        color: textColor,
        fontSize,
        formatter: (value: number) => categories[Math.round(value)] ?? "",
      },
      axisTick: { show: false },
      splitLine,
      max: Math.max(0, categories.length - 1),
    };
    series = [
      {
        type: "themeRiver",
        data: riverData,
        label: { show: false },
        emphasis: { focus: "series" },
      } as SeriesOption,
    ];
    xAxis = undefined;
    yAxis = undefined;
  } else if (type === "divergingBar" || type === "populationPyramid") {
    const first = dataSeries[0] ?? { name: "系列 A", data: [] };
    const second = dataSeries[1] ?? first;
    const maxValue = Math.max(
      1,
      ...first.data.map((value) => Math.abs(value)),
      ...second.data.map((value) => Math.abs(value)),
    );
    const divergingValueAxis = {
      ...valueAxis,
      min: -maxValue,
      max: maxValue,
      axisLabel: {
        ...axisLabel,
        formatter: (value: number) => Math.abs(value).toString(),
      },
    };
    xAxis = divergingValueAxis;
    yAxis = {
      ...categoryAxis,
      inverse: type === "populationPyramid",
    };
    series = [
      {
        name: first.name,
        type: "bar",
        stack: "diverging",
        barMaxWidth: compact ? 12 : 26,
        data: first.data.map((value) => -Math.abs(value)),
        itemStyle: { color: colorFor(1, config) },
        label: {
          show: compact ? false : showLabels,
          position: "inside",
          color: "#ffffff",
          formatter: (params: unknown) => {
            const item = params as { value: number };
            return Math.abs(item.value).toString();
          },
        },
      },
      {
        name: second.name,
        type: "bar",
        stack: "diverging",
        barMaxWidth: compact ? 12 : 26,
        data: second.data.map((value) => Math.abs(value)),
        itemStyle: { color: colorFor(0, config) },
        label: {
          show: compact ? false : showLabels,
          position: "inside",
          color: "#ffffff",
        },
      },
    ];
  } else {
    const isLine =
      type === "line" ||
      type === "smoothLine" ||
      type === "stepLine" ||
      type === "area" ||
      type === "stackedArea" ||
      type === "proportionalArea";
    const visibleDataSeries =
      type === "column" || type === "area" ? dataSeries.slice(0, 1) : dataSeries;

    series = visibleDataSeries.map((item, index) => {
      const color = colorFor(index, config);
      const comboLine = type === "combo" && index > 0;
      const seriesType = isLine || comboLine ? "line" : "bar";
      return {
        name: item.name,
        type: seriesType,
        data: item.data,
        stack: stacked ? "total" : undefined,
        smooth:
          seriesType === "line" &&
          (type === "smoothLine" ||
            type === "stackedArea" ||
            type === "proportionalArea" ||
            smooth),
        step: type === "stepLine" ? "middle" : undefined,
        symbol: compact ? "none" : "circle",
        symbolSize: compact ? 0 : 7,
        barMaxWidth: compact ? 20 : 48,
        itemStyle: {
          color,
          borderRadius:
            seriesType === "bar"
              ? isHorizontal
                ? [0, 3, 3, 0]
                : [3, 3, 0, 0]
              : 0,
        },
        lineStyle: { color, width: compact ? 1.5 : 3 },
        areaStyle:
          type === "area" ||
          type === "stackedArea" ||
          type === "proportionalArea"
            ? { color, opacity: stacked ? 0.64 : 0.22 }
            : undefined,
        label: {
          show: compact ? false : showLabels,
          position: isHorizontal ? "right" : "top",
          color: textColor,
          fontSize,
          formatter: proportional ? "{c}%" : undefined,
        },
        emphasis: { focus: "series" },
      } as SeriesOption;
    });
  }

  return {
    animation: !compact,
    animationDuration: 480,
    animationEasing: "cubicOut",
    backgroundColor: transparent ? "transparent" : backgroundColor,
    color: [
      config.primaryColor,
      config.secondaryColor,
      ...theme.colors.slice(2),
    ],
    textStyle: {
      fontFamily:
        '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      color: textColor,
    },
    title: {
      show: compact ? false : Boolean(title || subtitle),
      left: margins.left,
      top: margins.top,
      text: title,
      subtext: subtitle,
      itemGap: 7,
      textStyle: {
        color: textColor,
        fontSize: Math.max(22, fontSize + 10),
        fontWeight: 700,
      },
      subtextStyle: {
        color: "#68727d",
        fontSize: Math.max(12, fontSize - 1),
      },
    },
    legend: {
      show:
        !compact &&
        showLegend &&
        (dataSeries.length > 1 || type === "pie" || type === "donut"),
      top: margins.top + 3,
      right: margins.right,
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: textColor, fontSize },
    },
    tooltip: compact
      ? { show: false }
      : {
          trigger: type === "pie" || type === "donut" ? "item" : "axis",
          backgroundColor: "rgba(24, 28, 33, 0.94)",
          borderWidth: 0,
          textStyle: { color: "#ffffff", fontSize },
          padding: [10, 12],
        },
    grid:
      type === "pie" ||
      type === "donut" ||
      type === "streamgraph"
        ? undefined
        : {
            top: gridTop,
            right: gridRight,
            bottom: gridBottom,
            left: gridLeft,
            containLabel: !compact,
          },
    singleAxis,
    xAxis,
    yAxis,
    series,
  };
}

export function buildThumbnailOption(type: ChartType): EChartsOption {
  const parsed = tableToParsed(INITIAL_TABLE);
  return buildChartOption({
    type,
    parsed,
    categoryColumn: "月份",
    seriesColumns: ["实际收入", "目标"],
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
