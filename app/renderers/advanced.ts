/**
 * Advanced and high-demand chart renderers.
 *
 * These templates cover common Flourish / data-journalism chart needs beyond
 * the original line-bar-pie MVP while still using the same ECharts SVG renderer
 * path, so export behavior remains consistent.
 */
import type { EChartsOption, SeriesOption } from "echarts";
import { buildPieOption } from "./pie";
import { columnIndex, toNumber } from "../chart-model";
import type { RenderContext } from "../template-definition";
import {
  buildCategoryAxis,
  buildValueAxis,
  colorFor,
  dataLabelTextStyle,
  LEGEND_HORIZONTAL_SPACE,
  LEGEND_VERTICAL_SPACE,
  resolveDataLabelPosition,
  type RendererResult,
} from "./shared";

type LayoutBox = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function finiteValue(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function finiteValues(values: number[]) {
  return values.filter(Number.isFinite);
}

function contentBox(ctx: RenderContext, reserveLegend = false): LayoutBox {
  const { config, dataSeries } = ctx;
  const {
    compact = false,
    margins,
    title,
    subtitle,
  } = config;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const legendPosition = config.legendPosition ?? "top";
  const legendVisible =
    !compact && config.showLegend && reserveLegend && dataSeries.length > 1;
  return {
    top:
      compact
        ? 4
        : margins.top +
          titleBlock +
          (legendVisible && legendPosition === "top"
            ? LEGEND_HORIZONTAL_SPACE
            : 0),
    bottom:
      compact
        ? 4
        : margins.bottom +
          (legendVisible && legendPosition === "bottom"
            ? LEGEND_HORIZONTAL_SPACE
            : 0),
    left:
      compact
        ? 4
        : margins.left +
          (legendVisible && legendPosition === "left"
            ? LEGEND_VERTICAL_SPACE
            : 0),
    right:
      compact
        ? 4
        : margins.right +
          (legendVisible && legendPosition === "right"
            ? LEGEND_VERTICAL_SPACE
            : 0),
  };
}

function labelOption(
  ctx: RenderContext,
  defaultOutside: Parameters<typeof resolveDataLabelPosition>[1],
) {
  const { config, formatNumber } = ctx;
  const labelTextStyle = dataLabelTextStyle(config);
  return {
    show: config.compact ? false : config.showLabels,
    position: resolveDataLabelPosition(config, defaultOutside),
    ...labelTextStyle,
    formatter: (params: unknown) => {
      const value = (params as { value?: number | string | unknown[] }).value;
      if (Array.isArray(value)) {
        const last = value[value.length - 1];
        return typeof last === "number" || typeof last === "string"
          ? formatNumber(last)
          : "";
      }
      return typeof value === "number" || typeof value === "string"
        ? formatNumber(value)
        : "";
    },
  };
}

export function buildDotPlotOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const primary = dataSeries[0] ?? { name: "数值", data: [] };
  const pointSize = compact ? 6 : config.pointSize ?? 9;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const textColor = theme.text;

  const xAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const yAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: primary.name,
      type: "scatter",
      symbolSize: pointSize,
      itemStyle: {
        color: colorFor(0, config, primary.name),
        opacity: markOpacity,
      },
      label: labelOption(ctx, "right"),
      data: primary.data.map((value, index) => [value, categories[index]]),
    } as SeriesOption,
  ];

  return { series, xAxis, yAxis, tooltipTrigger: "item" };
}

export function buildWaterfallOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, formatNumber } = ctx;
  const { theme, fontSize, compact = false } = config;
  const primary = dataSeries[0] ?? { name: "变化", data: [] };
  const textColor = theme.text;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const xAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const positiveColor = colorFor(0, config, primary.name);
  const negativeColor = colorFor(1, config, primary.name);
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const helper: number[] = [];
  const bars: Array<{
    value: number;
    raw: number;
    itemStyle: { color: string; opacity: number; borderRadius: number[] };
  }> = [];
  let running = 0;

  for (const rawValue of primary.data) {
    const raw = finiteValue(rawValue);
    const isPositive = raw >= 0;
    helper.push(isPositive ? running : running + raw);
    bars.push({
      value: Math.abs(raw),
      raw,
      itemStyle: {
        color: isPositive ? positiveColor : negativeColor,
        opacity: markOpacity,
        borderRadius: [barRadius, barRadius, 0, 0],
      },
    });
    running += raw;
  }

  return {
    xAxis,
    yAxis,
    series: [
      {
        name: "基准",
        type: "bar",
        stack: "waterfall",
        itemStyle: { color: "transparent" },
        emphasis: { disabled: true },
        data: helper,
      } as SeriesOption,
      {
        name: primary.name,
        type: "bar",
        stack: "waterfall",
        barMaxWidth: compact ? 20 : barWidth,
        label: {
          ...labelOption(ctx, "top"),
          formatter: (params: unknown) => {
            const item = params as { data?: { raw?: number } };
            return formatNumber(item.data?.raw ?? 0);
          },
        },
        data: bars,
      } as SeriesOption,
    ],
  };
}

export function buildHeatmapOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, formatNumber } = ctx;
  const { theme, fontSize, compact = false } = config;
  const textColor = theme.text;
  const xAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
  const yAxis = {
    ...buildCategoryAxis(ctx, textColor, fontSize, compact),
    data: dataSeries.map((series) => series.name),
  };

  const data: Array<[number, number, number]> = [];
  const values: number[] = [];
  dataSeries.forEach((series, seriesIndex) => {
    series.data.forEach((value, categoryIndex) => {
      const safeValue = finiteValue(value);
      values.push(safeValue);
      data.push([categoryIndex, seriesIndex, safeValue]);
    });
  });
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const labelTextStyle = dataLabelTextStyle(config);

  return {
    xAxis,
    yAxis,
    visualMap: {
      show: !compact,
      min,
      max,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      inRange: {
        color: ["#f7fbff", colorFor(0, config), colorFor(1, config)],
      },
      textStyle: { color: textColor, fontSize },
    } as EChartsOption["visualMap"],
    tooltipTrigger: "item",
    series: [
      {
        name: "热力值",
        type: "heatmap",
        data,
        label: {
          show: compact ? false : config.showLabels,
          ...labelTextStyle,
          formatter: (params: unknown) => {
            const value = (params as { value?: [number, number, number] }).value;
            return value ? formatNumber(value[2]) : "";
          },
        },
        itemStyle: {
          borderWidth: compact ? 0 : 1,
          borderColor: config.transparent ? "rgba(255,255,255,0.72)" : config.backgroundColor,
        },
      } as SeriesOption,
    ],
  };
}

export function buildTreemapOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const primary = dataSeries[0] ?? { name: "数值", data: [] };
  const box = contentBox(ctx);
  const labelTextStyle = dataLabelTextStyle(config);
  const markOpacity = (config.markOpacity ?? 100) / 100;

  return {
    series: [
      {
        name: primary.name,
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        visibleMin: 1,
        itemStyle: {
          borderColor: config.transparent ? "rgba(255,255,255,0.86)" : config.backgroundColor,
          borderWidth: config.compact ? 1 : 2,
          gapWidth: config.compact ? 1 : 2,
          opacity: markOpacity,
        },
        label: {
          show: config.compact ? false : config.showLabels,
          ...labelTextStyle,
          formatter: "{b}",
        },
        data: categories.map((name, index) => ({
          name,
          value: Math.max(0, finiteValue(primary.data[index])),
          itemStyle: { color: colorFor(index, config, name) },
        })),
      } as SeriesOption,
    ],
  };
}

export function buildFunnelOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries, formatNumber } = ctx;
  const primary = dataSeries[0] ?? { name: "数值", data: [] };
  const box = contentBox(ctx);
  const labelTextStyle = dataLabelTextStyle(config);
  const values = finiteValues(primary.data);
  const markOpacity = (config.markOpacity ?? 100) / 100;

  return {
    series: [
      {
        name: primary.name,
        type: "funnel",
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 1,
        sort: "descending",
        gap: config.compact ? 1 : 2,
        label: {
          show: config.compact ? false : config.showLabels,
          position: resolveDataLabelPosition(config, "inside"),
          ...labelTextStyle,
          formatter: (params: unknown) => {
            const item = params as { name: string; value: number };
            return `${item.name} ${formatNumber(item.value)}`;
          },
        },
        itemStyle: {
          borderColor: config.transparent ? "rgba(255,255,255,0.82)" : config.backgroundColor,
          borderWidth: config.compact ? 1 : 2,
          opacity: markOpacity,
        },
        data: categories.map((name, index) => ({
          name,
          value: Math.max(0, finiteValue(primary.data[index])),
          itemStyle: { color: colorFor(index, config, name) },
        })),
      } as SeriesOption,
    ],
  };
}

export function buildGaugeOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries, formatNumber } = ctx;
  const primary = dataSeries[0] ?? { name: "完成率", data: [0] };
  const box = contentBox(ctx);
  const innerWidth = Math.max(80, config.width - box.left - box.right);
  const innerHeight = Math.max(80, config.height - box.top - box.bottom);
  const centerX = ((box.left + innerWidth / 2) / config.width) * 100;
  const centerY = ((box.top + innerHeight / 2) / config.height) * 100;
  const radius = Math.min(innerWidth, innerHeight) * 0.42;
  const value = finiteValue(primary.data[0]);
  const max = Math.max(100, value);
  const labelTextStyle = dataLabelTextStyle(config);

  return {
    series: [
      {
        name: primary.name,
        type: "gauge",
        center: [`${centerX}%`, `${centerY}%`],
        radius,
        min: 0,
        max,
        progress: {
          show: true,
          roundCap: true,
          itemStyle: { color: colorFor(0, config, primary.name) },
        },
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: config.compact ? 8 : 14,
            color: [[1, "rgba(120,128,140,0.18)"]],
          },
        },
        pointer: { width: config.compact ? 2 : 4 },
        axisTick: { show: false },
        splitLine: { length: config.compact ? 6 : 10 },
        axisLabel: { show: false },
        title: {
          show: !config.compact && config.showLabels,
          offsetCenter: [0, "46%"],
          ...labelTextStyle,
          fontWeight: 500,
        },
        detail: {
          show: !config.compact,
          offsetCenter: [0, "20%"],
          color: config.theme.text,
          fontSize: Math.max(config.fontSize + 10, 22),
          fontWeight: 700,
          formatter: (raw: number) => formatNumber(raw),
        },
        data: [{ value, name: categories[0] ?? primary.name }],
      } as SeriesOption,
    ],
  };
}

export function buildRadarOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const box = contentBox(ctx, true);
  const innerWidth = Math.max(80, config.width - box.left - box.right);
  const innerHeight = Math.max(80, config.height - box.top - box.bottom);
  const centerX = ((box.left + innerWidth / 2) / config.width) * 100;
  const centerY = ((box.top + innerHeight / 2) / config.height) * 100;
  const radius = Math.min(innerWidth, innerHeight) * 0.38;
  const labelTextStyle = dataLabelTextStyle(config);

  const indicator = categories.map((name, index) => {
    const maxValue = Math.max(
      1,
      ...dataSeries.map((series) => finiteValue(series.data[index])),
    );
    return { name, max: maxValue * 1.18 };
  });

  return {
    radar: {
      center: [`${centerX}%`, `${centerY}%`],
      radius,
      indicator,
      axisName: {
        color: config.theme.text,
        fontSize: config.compact ? 9 : config.fontSize,
      },
      splitLine: {
        lineStyle: { color: config.theme.grid },
      },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: config.theme.grid } },
    } as EChartsOption["radar"],
    series: [
      {
        type: "radar",
        symbolSize: config.compact ? 2 : config.pointSize ?? 5,
        lineStyle: { width: config.compact ? 1 : config.lineWidth ?? 2 },
        label: {
          show: config.compact ? false : config.showLabels,
          ...labelTextStyle,
        },
        data: dataSeries.map((series, index) => ({
          name: series.name,
          value: series.data.map((value) => finiteValue(value)),
          areaStyle: {
            opacity: Math.max(0.04, (config.areaOpacity ?? 16) / 100),
          },
          itemStyle: { color: colorFor(index, config, series.name) },
          lineStyle: { color: colorFor(index, config, series.name) },
        })),
      } as SeriesOption,
    ],
    tooltipTrigger: "item",
  };
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1];
  if (next === undefined) return sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function boxStats(values: number[]) {
  const sorted = finiteValues(values).sort((a, b) => a - b);
  if (!sorted.length) return [0, 0, 0, 0, 0];
  return [
    sorted[0],
    quantile(sorted, 0.25),
    quantile(sorted, 0.5),
    quantile(sorted, 0.75),
    sorted[sorted.length - 1],
  ];
}

export function buildBoxplotOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const textColor = theme.text;
  const xAxis = {
    ...buildCategoryAxis(ctx, textColor, fontSize, compact),
    data: dataSeries.map((series) => series.name),
  };
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);

  return {
    xAxis,
    yAxis,
    series: [
      {
        name: "分布",
        type: "boxplot",
        itemStyle: {
          color: "rgba(255,255,255,0.68)",
          borderColor: colorFor(0, config),
          borderWidth: config.compact ? 1 : 2,
        },
        label: labelOption(ctx, "top"),
        data: dataSeries.map((series) => boxStats(series.data)),
      } as SeriesOption,
    ],
  };
}

export function buildCandlestickOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { parsed, theme, fontSize, compact = false } = config;
  const textColor = theme.text;
  const xAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const columns = config.seriesColumns
    .filter((header) => parsed.numericHeaders.includes(header))
    .slice(0, 4);
  const [openName, closeName, lowName, highName] = columns;
  const indices = [openName, closeName, lowName, highName].map((name) =>
    columnIndex(parsed.headers, name ?? ""),
  );

  return {
    xAxis,
    yAxis,
    series: [
      {
        name: "价格",
        type: "candlestick",
        itemStyle: {
          color: colorFor(0, config, closeName),
          color0: colorFor(1, config, openName),
          borderColor: colorFor(0, config, closeName),
          borderColor0: colorFor(1, config, openName),
        },
        label: labelOption(ctx, "top"),
        data: parsed.rows.map((row) => [
          toNumber(row[indices[0]] ?? ""),
          toNumber(row[indices[1]] ?? ""),
          toNumber(row[indices[2]] ?? ""),
          toNumber(row[indices[3]] ?? ""),
        ]),
      } as SeriesOption,
    ],
  };
}

export function buildSankeyOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { parsed } = config;
  const box = contentBox(ctx);
  const sourceName = config.sourceColumn ?? config.categoryColumn;
  const targetName =
    config.targetColumn ??
    parsed.headers.find(
      (header) => header !== sourceName && !parsed.numericHeaders.includes(header),
    ) ??
    parsed.headers.find((header) => header !== sourceName) ??
    sourceName;
  const valueName =
    config.seriesColumns.find((header) => parsed.numericHeaders.includes(header)) ??
    parsed.numericHeaders[0] ??
    "";
  const sourceIndex = columnIndex(parsed.headers, sourceName);
  const targetIndex = columnIndex(parsed.headers, targetName);
  const valueIndex = columnIndex(parsed.headers, valueName);
  const nodeNames = new Set<string>();
  const links: Array<{ source: string; target: string; value: number }> = [];

  for (const row of parsed.rows) {
    const source = row[sourceIndex]?.trim();
    const target = row[targetIndex]?.trim();
    const value = Math.max(0, finiteValue(toNumber(row[valueIndex] ?? "")));
    if (!source || !target || value <= 0) continue;
    nodeNames.add(source);
    nodeNames.add(target);
    links.push({ source, target, value });
  }

  return {
    series: [
      {
        name: valueName || "流量",
        type: "sankey",
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        nodeAlign: "justify",
        layoutIterations: 32,
        data: [...nodeNames].map((name, index) => ({
          name,
          itemStyle: { color: colorFor(index, config, name) },
        })),
        links,
        label: {
          show: config.compact ? false : config.showLabels,
          ...dataLabelTextStyle(config),
        },
        lineStyle: {
          color: "gradient",
          curveness: 0.5,
          opacity: Math.max(0.18, (config.markOpacity ?? 64) / 100),
        },
      } as SeriesOption,
    ],
    tooltipTrigger: "item",
  };
}

// ---------------------------------------------------------------------------
// Flourish parity batch 6: statistical & distribution renderers.
// ---------------------------------------------------------------------------

/** Minimal shapes for custom-series renderItem callbacks (typed loosely in
 *  echarts, so we declare the surface we actually use). */
type CustomApi = {
  value: (dim: number) => number;
  coord: (point: [number, number]) => number[];
  style: (extra?: Record<string, unknown>) => Record<string, unknown>;
};
type CustomParams = { dataIndex: number };

function gaussianKde(values: number[], points: number[], std: number) {
  const n = values.length;
  if (!n || std <= 0) return points.map(() => 0);
  return points.map(
    (x) =>
      values.reduce((sum, v) => {
        const u = (v - x) / std;
        return sum + Math.exp(-0.5 * u * u);
      }, 0) /
        (n * std * Math.sqrt(2 * Math.PI)),
  );
}

/** 平行坐标图: each numeric column is a dimension; each row a polyline. */
export function buildParallelOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const lineWidth = config.lineWidth ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;

  const parallel = {
    top: compact ? "8%" : "18%",
    left: compact ? "8%" : "12%",
    right: compact ? "8%" : "12%",
    bottom: compact ? "8%" : "14%",
  };
  const parallelAxis = dataSeries.map((series, dim) => {
    const values = series.data.filter(Number.isFinite);
    return {
      dim,
      name: compact ? "" : series.name,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1,
      nameTextStyle: { color: theme.text, fontSize },
      axisLine: { show: !compact, lineStyle: { color: "#aeb6bf" } },
      axisTick: { show: false },
      axisLabel: { show: !compact, color: theme.text, fontSize },
    };
  });

  const series: SeriesOption[] = [
    {
      name: "样本",
      type: "parallel",
      smooth: config.smooth,
      lineStyle: {
        width: compact ? 1.5 : lineWidth,
        opacity: markOpacity,
        color: colorFor(0, config),
      },
      data: categories.map((name, rowIndex) => ({
        name,
        value: dataSeries.map((series) =>
          Number.isFinite(series.data[rowIndex]) ? series.data[rowIndex] : 0,
        ),
      })),
      emphasis: { lineStyle: { width: (compact ? 1.5 : lineWidth) + 2 } },
    },
  ];
  return { series, parallel, parallelAxis, tooltipTrigger: "item" };
}

/** 日历热力图: calendar coordinate + heatmap with per-day values. */
export function buildCalendarHeatmapOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const values = (dataSeries[0]?.data ?? []).map((v) => (Number.isFinite(v) ? v : 0));
  const maxValue = Math.max(1, ...values);
  const labelTextStyle = dataLabelTextStyle(config);

  // Calendar range: the year (or year-month span) implied by the dates.
  const dates = categories.map((date) => date.trim()).filter(Boolean);
  const parsed = dates
    .map((date) => new Date(date))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const years = [...new Set(parsed.map((d) => d.getFullYear()).filter((year) => year > 1990))];
  const range = years.length === 1 ? String(years[0]) : years.length > 1 ? [String(years[0]), String(years[years.length - 1])] : dates[0]?.slice(0, 4) || "2026";

  const calendar = {
    top: compact ? "10%" : "16%",
    left: compact ? "10%" : "14%",
    right: compact ? "6%" : "10%",
    cellSize: (compact ? ["auto", 8] : ["auto", 20]) as (number | "auto")[],
    range,
    itemStyle: { color: "transparent", borderColor: theme.grid, borderWidth: 1 },
    yearLabel: { show: !compact, color: theme.text, fontSize },
    monthLabel: { show: !compact, color: theme.text, fontSize: Math.max(9, fontSize - 1) },
    dayLabel: { show: !compact, color: theme.text, fontSize: Math.max(8, fontSize - 2), firstDay: 1 },
    splitLine: { show: false },
  };

  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "数值",
      type: "heatmap",
      coordinateSystem: "calendar",
      data: dates.map((date, index) => [date, values[index] ?? 0]),
      label: {
        show: compact ? false : config.showLabels,
        ...labelTextStyle,
        fontSize: Math.max(8, fontSize - 3),
        formatter: (params: unknown) => {
          const entry = params as { value: [string, number] };
          return ctx.formatNumber(entry.value[1]);
        },
      },
      itemStyle: { borderRadius: compact ? 1 : 3 },
    },
  ];
  return {
    series,
    calendar,
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: false,
      show: !compact,
      orient: "horizontal" as const,
      left: "center",
      bottom: 0,
      inRange: {
        color: [config.backgroundColor === "#ffffff" ? "#f0f4fa" : config.backgroundColor, colorFor(0, config)],
      },
      textStyle: { color: theme.text, fontSize },
    },
    tooltipTrigger: "item",
  };
}

/** 累计分布图: ECDF — step line of the sorted column's cumulative percent. */
export function buildEcdfOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const labelTextStyle = dataLabelTextStyle(config);

  const values = (dataSeries[0]?.data ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  const n = values.length;
  const data = values.map((value, index) => [value, ((index + 1) / n) * 100]);

  const xAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    name: compact ? "" : dataSeries[0]?.name ?? "",
  };
  const yAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    min: 0,
    max: 100,
  };
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "累计占比",
      type: "line",
      data,
      step: "end",
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      itemStyle: { color: colorFor(0, config) },
      lineStyle: { color: colorFor(0, config), width: compact ? 1.5 : lineWidth },
      label: {
        show: compact ? false : config.showLabels,
        position: "top",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number] };
          return `${Math.round(entry.value[1])}%`;
        },
      },
      emphasis: { focus: "series" },
    },
  ];
  return { series, xAxis, yAxis };
}

/** 误差线图: bars with custom-drawn whiskers for lower/upper error columns. */
export function buildErrorBarOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const values = dataSeries[0]?.data ?? [];
  const lower = dataSeries[1]?.data ?? [];
  const upper = dataSeries[2]?.data ?? [];

  const xAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const yAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "数值",
      type: "bar",
      data: values,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: {
        color: colorFor(0, config),
        opacity: markOpacity,
        borderRadius: [barRadius, barRadius, 0, 0],
      },
      label: {
        show: compact ? false : config.showLabels,
        position: "top",
        ...dataLabelTextStyle(config),
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return ctx.formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    },
    {
      name: "误差范围",
      type: "custom",
      silent: true,
      z: 5,
      data: values.map((_, index) => [
        index,
        Number.isFinite(values[index]) ? values[index] : 0,
        Number.isFinite(lower[index]) ? Math.min(lower[index], values[index] || 0) : 0,
        Number.isFinite(upper[index]) ? Math.max(upper[index], values[index] || 0) : 0,
      ]),
      renderItem: ((params: CustomParams, api: CustomApi) => {
        const catIndex = api.value(0);
        const high = api.coord([catIndex, api.value(3)]);
        const low = api.coord([catIndex, api.value(2)]);
        const x = high[0];
        const cap = Math.max(4, 10);
        const line = {
          type: "line",
          shape: { x1: x, y1: high[1], x2: x, y2: low[1] },
          style: { stroke: theme.text, lineWidth: 1.5 },
        };
        return {
          type: "group",
          children: [
            line,
            {
              type: "line",
              shape: { x1: x - cap / 2, y1: high[1], x2: x + cap / 2, y2: high[1] },
              style: { stroke: theme.text, lineWidth: 1.5 },
            },
            {
              type: "line",
              shape: { x1: x - cap / 2, y1: low[1], x2: x + cap / 2, y2: low[1] },
              style: { stroke: theme.text, lineWidth: 1.5 },
            },
          ],
        };
      }) as unknown as undefined,
    } as unknown as SeriesOption,
  ];
  return { series, xAxis, yAxis };
}

/** 相关性矩阵图: pairwise Pearson correlation rendered as a heatmap. */
export function buildCorrelationMatrixOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const names = dataSeries.map((series) => series.name);
  const columns = dataSeries.map((series) => series.data);
  const labelTextStyle = dataLabelTextStyle(config);

  const pearson = (a: number[], b: number[]) => {
    const pairs = a
      .map((value, index) => [value, b[index]] as [number, number])
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    const n = pairs.length;
    if (n < 2) return 0;
    const meanA = pairs.reduce((s, [x]) => s + x, 0) / n;
    const meanB = pairs.reduce((s, [, y]) => s + y, 0) / n;
    let cov = 0;
    let varA = 0;
    let varB = 0;
    for (const [x, y] of pairs) {
      cov += (x - meanA) * (y - meanB);
      varA += (x - meanA) * (x - meanA);
      varB += (y - meanB) * (y - meanB);
    }
    const denom = Math.sqrt(varA * varB);
    return denom === 0 ? 0 : Math.max(-1, Math.min(1, cov / denom));
  };

  const data: [number, number, number][] = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = 0; j < names.length; j += 1) {
      data.push([j, i, pearson(columns[i], columns[j])]);
    }
  }

  const categoryAxisStyle = {
    axisLine: { show: !compact, lineStyle: { color: "#aeb6bf" } },
    axisTick: { show: false },
    axisLabel: { show: !compact, color: theme.text, fontSize, rotate: 30 },
    splitLine: { show: false },
  };
  const xAxis = {
    type: "category" as const,
    data: names,
    ...categoryAxisStyle,
  };
  const yAxis = {
    type: "category" as const,
    data: names,
    ...categoryAxisStyle,
    axisLabel: { ...categoryAxisStyle.axisLabel, rotate: 0 },
  };
  const series: SeriesOption[] = [
    {
      name: "相关系数",
      type: "heatmap",
      data,
      label: {
        show: compact ? false : config.showLabels,
        ...labelTextStyle,
        fontSize: Math.max(8, fontSize - 2),
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number, number] };
          return entry.value[2].toFixed(2);
        },
      },
      itemStyle: {
        borderColor: config.transparent ? "rgba(255,255,255,0.6)" : config.backgroundColor,
        borderWidth: 1,
        borderRadius: compact ? 1 : 3,
      },
    },
  ];
  return {
    series,
    xAxis,
    yAxis,
    visualMap: {
      min: -1,
      max: 1,
      calculable: false,
      show: !compact,
      orient: "horizontal" as const,
      left: "center",
      bottom: 0,
      inRange: { color: ["#2166ac", "#f7f7f7", "#b2182b"] },
      textStyle: { color: theme.text, fontSize },
    },
    tooltipTrigger: "item",
  };
}

/** 小提琴图: mirrored KDE polygons per category, drawn as a custom series. */
export function buildViolinOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const values = dataSeries[0]?.data ?? [];

  // Group values by category, first-seen order.
  const groups: Array<{ name: string; values: number[] }> = [];
  const indexOfGroup: Record<string, number> = {};
  categories.forEach((name, rowIndex) => {
    const value = values[rowIndex];
    if (!Number.isFinite(value)) return;
    if (!(name in indexOfGroup)) {
      indexOfGroup[name] = groups.length;
      groups.push({ name, values: [] });
    }
    groups[indexOfGroup[name]].values.push(value);
  });

  const SAMPLE_POINTS = 24;
  const curves = groups.map((group) => {
    const n = group.values.length;
    const mean = group.values.reduce((s, v) => s + v, 0) / n;
    const variance =
      group.values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, n - 1);
    const std = Math.max(1e-6, Math.sqrt(variance));
    const h = 0.9 * std * Math.pow(n, -0.2);
    const min = Math.min(...group.values);
    const max = Math.max(...group.values);
    const lo = min - h * 1.5;
    const hi = max + h * 1.5;
    const grid = Array.from({ length: SAMPLE_POINTS }, (_, i) => lo + ((hi - lo) * i) / (SAMPLE_POINTS - 1));
    return { group, grid, density: gaussianKde(group.values, grid, h) };
  });
  const maxDensity = Math.max(1e-6, ...curves.flatMap((curve) => curve.density));

  const xAxis = {
    ...buildCategoryAxis(ctx, theme.text, fontSize, compact),
    data: groups.map((group) => group.name),
    min: -0.5,
    max: Math.max(0.5, groups.length - 0.5),
  };
  const yAxis = buildValueAxis(ctx, theme.text, fontSize, compact);

  const series: SeriesOption[] = [
    {
      name: "分布",
      type: "custom",
      renderItem: ((params: CustomParams, api: CustomApi) => {
        const index = params.dataIndex;
        const curve = curves[index];
        if (!curve) return;
        const center = api.coord([index, curve.grid[0]])[0];
        // Fixed relative width per violin: 38% of the category slot.
        const slotPixel = api.coord([index + 0.5, curve.grid[0]])[0] - api.coord([index - 0.5, curve.grid[0]])[0];
        const width = slotPixel * 0.38;
        const points: number[][] = [];
        curve.grid.forEach((y, i) => {
          const pixel = api.coord([index, y]);
          const offset = (curve.density[i] / maxDensity) * width;
          points.push([center + offset, pixel[1]]);
        });
        for (let i = curve.grid.length - 1; i >= 0; i -= 1) {
          const pixel = api.coord([index, curve.grid[i]]);
          const offset = (curve.density[i] / maxDensity) * width;
          points.push([center - offset, pixel[1]]);
        }
        return {
          type: "polygon",
          shape: { points },
          style: {
            fill: colorFor(index, config, curve.group.name),
            opacity: Math.max(0.25, markOpacity * 0.7),
            stroke: colorFor(index, config, curve.group.name),
          },
        };
      }) as unknown as undefined,
      data: curves.map((curve, index) => [
        index,
        0,
        ...curve.grid.map((y) => y),
      ]),
      itemStyle: { opacity: markOpacity },
      label: { show: false },
      emphasis: { focus: "self" },
      tooltip: { show: false },
    } as unknown as SeriesOption,
    {
      name: "数据点",
      type: "scatter",
      symbolSize: compact ? 0 : 5,
      itemStyle: { color: theme.text, opacity: 0.45 },
      data: (() => {
        const points: [number, number][] = [];
        curves.forEach((curve, groupIndex) => {
          curve.group.values.forEach((value, offset) => {
            // Deterministic jitter so coincident points stay visible.
            const jitter = ((offset % 5) - 2) * 0.02;
            points.push([groupIndex + jitter, value]);
          });
        });
        return points;
      })(),
      label: { show: false },
      emphasis: { focus: "self" },
    } as SeriesOption,
  ];
  return { series, xAxis, yAxis };
}

/** 马赛克图（Marimekko）: variable-width stacked columns over 0–100%. */
export function buildMarimekkoOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const labelTextStyle = dataLabelTextStyle(config);

  const rowsTotal = categories.map((_, rowIndex) =>
    dataSeries.reduce((sum, series) => sum + (Number.isFinite(series.data[rowIndex]) ? series.data[rowIndex] : 0), 0),
  );
  const grandTotal = rowsTotal.reduce((sum, value) => sum + value, 0) || 1;
  // Row x-intervals (0-100) and within-row segment shares.
  const intervals: Array<{ start: number; width: number; shares: number[] }> = [];
  let cursor = 0;
  categories.forEach((_, rowIndex) => {
    const width = (rowsTotal[rowIndex] / grandTotal) * 100;
    const shares = dataSeries.map((series) =>
      rowsTotal[rowIndex] ? (series.data[rowIndex] / rowsTotal[rowIndex]) * 100 : 0,
    );
    intervals.push({ start: cursor, width, shares });
    cursor += width;
  });

  const xAxis = {
    type: "value" as const,
    min: 0,
    max: 100,
    show: !compact,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      show: !compact,
      color: theme.text,
      fontSize,
      formatter: (value: number) => {
        // Label each row at its interval midpoint.
        for (let index = 0; index < intervals.length; index += 1) {
          const { start, width } = intervals[index];
          if (value >= start && value <= start + width) {
            return categories[index] ?? "";
          }
        }
        return "";
      },
    },
    splitLine: { show: false },
  };
  const yAxis = {
    type: "value" as const,
    min: 0,
    max: 100,
    show: !compact,
    axisLabel: { show: true, color: theme.text, fontSize, formatter: (value: number) => `${value}%` },
    splitLine: config.showGrid
      ? { show: true, lineStyle: { color: theme.grid, type: (config.gridLineType ?? "dashed") as "solid" | "dashed" | "dotted" } }
      : { show: false },
  };

  const series: SeriesOption[] = [
    {
      name: "马赛克",
      type: "custom",
      renderItem: ((params: CustomParams, api: CustomApi) => {
        const index = params.dataIndex;
        const interval = intervals[index];
        if (!interval) return;
        const children: Array<Record<string, unknown>> = [];
        let bottom = 0;
        interval.shares.forEach((share, seriesIndex) => {
          const topLeft = api.coord([interval.start, bottom + share]);
          const bottomRight = api.coord([interval.start + interval.width, bottom]);
          children.push({
            type: "rect",
            shape: {
              x: topLeft[0],
              y: topLeft[1],
              width: Math.max(0, bottomRight[0] - topLeft[0]),
              height: Math.max(0, bottomRight[1] - topLeft[1]),
            },
            style: {
              fill: colorFor(seriesIndex, config, dataSeries[seriesIndex]?.name),
              opacity: config.transparent ? 0.9 : 0.92,
              stroke: config.transparent ? "rgba(255,255,255,0.82)" : config.backgroundColor,
              lineWidth: 1,
            },
          });
          bottom += share;
        });
        return { type: "group", children };
      }) as unknown as undefined,
      data: intervals.map((interval, index) => [
        index,
        interval.start,
        interval.width,
        ...interval.shares,
      ]),
      label: { show: false },
      emphasis: { focus: "self" },
    } as unknown as SeriesOption,
  ];
  void labelTextStyle;
  return { series, xAxis, yAxis };
}

// ---------------------------------------------------------------------------
// Flourish parity batch 7: OHLC bar and candle+volume combo.
// ---------------------------------------------------------------------------

/** OHLC 条形图: classic open-high-low-close bars via a custom series. */
export function buildOhlcBarOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const barWidth = config.barWidth ?? 48;
  const open = dataSeries[0]?.data ?? [];
  const close = dataSeries[1]?.data ?? [];
  const low = dataSeries[2]?.data ?? [];
  const high = dataSeries[3]?.data ?? [];
  const upColor = colorFor(0, config);
  const downColor = colorFor(1, config);

  const xAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const yAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: "OHLC",
      type: "custom",
      renderItem: ((params: { dataIndex: number }, api: {
        value: (dim: number) => number;
        coord: (point: [number, number]) => number[];
      }) => {
        const index = api.value(0);
        const openValue = api.value(1);
        const closeValue = api.value(2);
        const lowValue = api.value(3);
        const highValue = api.value(4);
        const x = api.coord([index, highValue])[0];
        const openPoint = api.coord([index, openValue]);
        const closePoint = api.coord([index, closeValue]);
        const lowPoint = api.coord([index, lowValue]);
        const highPoint = api.coord([index, highValue]);
        const half = Math.max(3, barWidth / 4);
        const rising = closeValue >= openValue;
        const color = rising ? upColor : downColor;
        return {
          type: "group",
          children: [
            {
              type: "line",
              shape: { x1: x, y1: highPoint[1], x2: x, y2: lowPoint[1] },
              style: { stroke: color, lineWidth: 1.5 },
            },
            {
              type: "line",
              shape: { x1: x - half, y1: openPoint[1], x2: x, y2: openPoint[1] },
              style: { stroke: color, lineWidth: 1.5 },
            },
            {
              type: "line",
              shape: { x1: x, y1: closePoint[1], x2: x + half, y2: closePoint[1] },
              style: { stroke: color, lineWidth: 1.5 },
            },
          ],
        };
      }) as unknown as undefined,
      data: open.map((_, index) => [
        index,
        Number.isFinite(open[index]) ? open[index] : 0,
        Number.isFinite(close[index]) ? close[index] : 0,
        Number.isFinite(low[index]) ? low[index] : 0,
        Number.isFinite(high[index]) ? high[index] : 0,
      ]),
      label: { show: false },
      emphasis: { focus: "self" },
    } as unknown as SeriesOption,
  ];
  void compact;
  return { series, xAxis, yAxis };
}

/** 蜡烛+成交量组合图: candlestick over a bar volume panel (two grids). */
export function buildCandleVolumeOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const barWidth = config.barWidth ?? 48;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  // Pad to exactly four OHLC columns so partial selections render (validators
  // surface the error, but the option builder must not throw).
  const ohlc = [0, 1, 2, 3].map((columnIndex) => {
    const source = dataSeries[columnIndex]?.data ?? [];
    return source.map((value) => (Number.isFinite(value) ? value : 0));
  });
  // ECharts candlestick data layout: [open, close, low, high] per row.
  const candleData = ohlc[0].map((_, rowIndex) => [
    ohlc[0][rowIndex],
    ohlc[1][rowIndex],
    ohlc[2][rowIndex],
    ohlc[3][rowIndex],
  ]);
  const volume = (dataSeries[4]?.data ?? []).map((value) => (Number.isFinite(value) ? value : 0));
  const maxVolume = Math.max(1, ...volume);
  const labelTextStyle = dataLabelTextStyle(config);

  const categoryAxisBottom = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const categoryAxisTop = {
    ...buildCategoryAxis(ctx, theme.text, fontSize, compact),
    show: false,
    axisLine: { show: false },
    axisLabel: { show: false },
  };
  const valueAxisTop = buildValueAxis(ctx, theme.text, fontSize, compact);
  const valueAxisBottom = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    max: maxVolume * 3.2,
    axisLabel: {
      ...((buildValueAxis(ctx, theme.text, fontSize, compact) as { axisLabel?: Record<string, unknown> }).axisLabel ?? {}),
      formatter: (value: number) => ctx.formatNumber(value),
    },
  };

  const series: SeriesOption[] = [
    {
      name: "K 线",
      type: "candlestick",
      data: candleData,
      xAxisIndex: 0,
      yAxisIndex: 0,
      barMaxWidth: compact ? 14 : barWidth,
      itemStyle: {
        color: colorFor(0, config),
        color0: colorFor(1, config),
        borderColor: colorFor(0, config),
        borderColor0: colorFor(1, config),
      },
      emphasis: { focus: "series" },
    },
    {
      name: dataSeries[4]?.name ?? "成交量",
      type: "bar",
      data: volume,
      xAxisIndex: 1,
      yAxisIndex: 1,
      barMaxWidth: compact ? 14 : barWidth,
      itemStyle: {
        color: colorFor(2, config),
        opacity: markOpacity,
        borderRadius: [2, 2, 0, 0],
      },
      label: {
        show: compact ? false : config.showLabels,
        position: "top",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: number | string };
          return ctx.formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    },
  ];
  const grid: RendererResult["grid"] = compact
    ? [{ top: 6, left: 6, right: 6, bottom: 6, containLabel: false }]
    : [
        { top: config.margins.top + 74, left: config.margins.left, right: config.margins.right, height: "48%", containLabel: true },
        { left: config.margins.left, right: config.margins.right, bottom: config.margins.bottom + 26, height: "18%", containLabel: true },
      ];
  return {
    series,
    grid,
    xAxis: [categoryAxisTop, { ...categoryAxisBottom, data: categories }],
    yAxis: [valueAxisTop, valueAxisBottom],
  };
}

// ---------------------------------------------------------------------------
// Flourish parity batch 8: pie/donut & boxplot extensions.
// ---------------------------------------------------------------------------

/** 半环形图: donut swept over the top half circle. */
export function buildHalfDonutOption(ctx: RenderContext): RendererResult {
  const result = buildPieOption(ctx);
  const [pie] = result.series as Array<Record<string, unknown>>;
  pie.startAngle = 180;
  pie.endAngle = 360;
  // Donut-style band pulled toward the top so the flat edge sits at the bottom.
  pie.center = ["50%", "72%"];
  pie.radius = ["46%", "74%"];
  return result;
}

/** 多层环形图: one concentric ring per numeric column. */
export function buildMultiRingOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries, formatNumber } = ctx;
  const { backgroundColor, transparent, compact = false } = config;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const { width, height, margins, title, subtitle } = config;
  const legendVisible = !compact && config.showLegend;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const legendPosition = config.legendPosition ?? "top";
  const innerTop =
    margins.top +
    titleBlock +
    (legendVisible && legendPosition === "top" ? LEGEND_HORIZONTAL_SPACE : 0);
  const innerBottom =
    margins.bottom +
    (legendVisible && legendPosition === "bottom" ? LEGEND_HORIZONTAL_SPACE : 0);
  const innerLeft =
    margins.left +
    (legendVisible && legendPosition === "left" ? LEGEND_VERTICAL_SPACE : 0);
  const innerRight =
    margins.right +
    (legendVisible && legendPosition === "right" ? LEGEND_VERTICAL_SPACE : 0);
  const innerHeight = Math.max(80, height - innerTop - innerBottom);
  const innerWidth = Math.max(80, width - innerLeft - innerRight);
  const centerX = ((innerLeft + innerWidth / 2) / width) * 100;
  const centerY = ((innerTop + innerHeight / 2) / height) * 100;
  const radiusPx = Math.max(42, Math.min(innerWidth, innerHeight) * 0.4);

  const labelTextStyle = dataLabelTextStyle(config);
  const ringCount = Math.max(1, dataSeries.length);
  const innerHole = 0.18;
  const bandThickness = (1 - innerHole) / ringCount;

  const series: SeriesOption[] = dataSeries.map((series, index) => {
    const innerRadius = radiusPx * (innerHole + index * bandThickness);
    const outerRadius = radiusPx * (innerHole + (index + 1) * bandThickness) - 2;
    const color = colorFor(index, config, series.name);
    return {
      name: series.name,
      type: "pie",
      radius: [innerRadius, Math.max(innerRadius + 4, outerRadius)],
      center: [`${centerX}%`, `${centerY}%`],
      data: categories.map((name, rowIndex) => ({
        name,
        value: Number.isFinite(series.data[rowIndex]) ? series.data[rowIndex] : 0,
        itemStyle: { color, opacity: markOpacity },
      })),
      itemStyle: {
        borderColor: transparent ? "rgba(255,255,255,0.82)" : backgroundColor,
        borderWidth: compact ? 1 : 2,
        borderRadius: compact ? 1 : 2,
      },
      label: {
        show: !compact && config.showLabels && index === dataSeries.length - 1,
        position: "outside",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const item = params as { name: string; value: number };
          return `${item.name} ${formatNumber(item.value)}`;
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption;
  });
  return { series };
}

/** 水平箱线图: the boxplot path with value/category axes swapped. */
export function buildBoxplotHorizontalOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const textColor = theme.text;
  const xAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const yAxis = {
    ...buildCategoryAxis(ctx, textColor, fontSize, compact),
    data: dataSeries.map((series) => series.name),
  };

  return {
    xAxis,
    yAxis,
    series: [
      {
        name: "分布",
        type: "boxplot",
        itemStyle: {
          color: "rgba(255,255,255,0.68)",
          borderColor: colorFor(0, config),
          borderWidth: compact ? 1 : 2,
        },
        label: labelOption(ctx, "right"),
        data: dataSeries.map((series) => boxStats(series.data)),
      } as SeriesOption,
    ],
  };
}

/** 密度热力散点图: 2-D binning of x/y pairs rendered as a heatmap. */
export function buildDensityHeatmapOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const xs = dataSeries[0]?.data ?? [];
  const ys = dataSeries[1]?.data ?? [];
  const BINS = 10;
  const xValues = xs.filter(Number.isFinite);
  const yValues = ys.filter(Number.isFinite);
  const xMin = xValues.length ? Math.min(...xValues) : 0;
  const xMax = xValues.length ? Math.max(...xValues) : 1;
  const yMin = yValues.length ? Math.min(...yValues) : 0;
  const yMax = yValues.length ? Math.max(...yValues) : 1;
  const xWidth = xMax > xMin ? (xMax - xMin) / BINS : 1;
  const yWidth = yMax > yMin ? (yMax - yMin) / BINS : 1;

  const counts = new Map<string, number>();
  xs.forEach((x, index) => {
    const y = ys[index];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const xi = Math.min(BINS - 1, Math.floor((x - xMin) / xWidth));
    const yi = Math.min(BINS - 1, Math.floor((y - yMin) / yWidth));
    const key = `${xi}-${yi}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const maxCount = Math.max(1, ...counts.values());
  const data = [...counts.entries()].map(([key, count]) => {
    const [xi, yi] = key.split("-").map(Number);
    return [xi, yi, count];
  });
  const labelTextStyle = dataLabelTextStyle(config);

  const xAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    min: xMin,
    max: xMax,
    name: compact ? "" : dataSeries[0]?.name ?? "",
  };
  const yAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    min: yMin,
    max: yMax,
    name: compact ? "" : dataSeries[1]?.name ?? "",
  };
  const series: SeriesOption[] = [
    {
      name: "密度",
      type: "heatmap",
      data,
      label: {
        show: !compact && config.showLabels,
        ...labelTextStyle,
        fontSize: Math.max(8, fontSize - 2),
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number, number] };
          return entry.value[2] > 0 ? String(entry.value[2]) : "";
        },
      },
      itemStyle: {
        borderColor: config.transparent ? "rgba(255,255,255,0.6)" : config.backgroundColor,
        borderWidth: 1,
        borderRadius: compact ? 1 : 3,
      },
    },
  ];
  return {
    series,
    xAxis,
    yAxis,
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: false,
      show: !compact,
      orient: "horizontal" as const,
      left: "center",
      bottom: 0,
      inRange: {
        color: [config.backgroundColor === "#ffffff" ? "#f0f4fa" : config.backgroundColor, colorFor(0, config)],
      },
      textStyle: { color: theme.text, fontSize },
    },
    tooltipTrigger: "item",
  };
}

// ---------------------------------------------------------------------------
// Flourish parity batch 10: timeline & small multiples.
// ---------------------------------------------------------------------------

/** 时间线图: events plotted along a horizontal axis with alternating labels. */
export function buildTimelineOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const pointSize = config.pointSize ?? 7;
  const values = dataSeries[0]?.data ?? [];
  const labelTextStyle = dataLabelTextStyle(config);

  const xAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    min: Math.min(0, ...values.filter(Number.isFinite)),
    splitLine: { show: false },
    axisLine: { show: !compact, lineStyle: { color: "#aeb6bf" } },
    axisTick: { show: false },
  };
  const yAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    min: -1,
    max: 1,
    splitLine: { show: false },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
  };
  const series: SeriesOption[] = [
    {
      name: "事件",
      type: "scatter",
      symbol: "circle",
      symbolSize: compact ? 6 : pointSize + 4,
      itemStyle: { color: colorFor(0, config) },
      data: categories.map((name, index) => ({
        value: [Number.isFinite(values[index]) ? values[index] : index, 0],
        label: {
          show: compact ? false : config.showLabels,
          position: index % 2 === 0 ? ("top" as const) : ("bottom" as const),
          ...labelTextStyle,
          formatter: () => name,
        },
      })),
      emphasis: { focus: "self" },
    } as SeriesOption,
  ];
  return { series, xAxis, yAxis };
}

/** 小倍数分面图: one mini chart (grid) per numeric column, bar sub-shape. */
export function buildSmallMultiplesOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false, theme, fontSize } = config;
  const barWidth = config.barWidth ?? 48;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const panelCount = Math.max(1, dataSeries.length);
  const labelTextStyle = dataLabelTextStyle(config);

  const gapPercent = compact ? 1.5 : 5;
  const panelWidth = (100 - gapPercent * (panelCount - 1)) / panelCount;
  const grids = dataSeries.map((_, index) => ({
    left: `${index * (panelWidth + gapPercent)}%`,
    width: `${panelWidth}%`,
    top: compact ? "10%" : "20%",
    bottom: compact ? "8%" : "16%",
    containLabel: !compact,
  }));
  const xAxes = dataSeries.map((_, index) => ({
    ...buildCategoryAxis(ctx, theme.text, fontSize, compact),
    gridIndex: index,
    axisLabel: {
      show: false,
    },
    axisTick: { show: false },
  }));
  const yAxes = dataSeries.map((series, index) => ({
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    gridIndex: index,
    name: compact ? "" : series.name,
    nameLocation: "middle" as const,
    nameGap: compact ? 12 : 24,
    nameTextStyle: { color: theme.text, fontSize: Math.max(9, fontSize - 1) },
  }));
  const series: SeriesOption[] = dataSeries.map((item, index) => ({
    name: item.name,
    type: "bar",
    data: item.data,
    xAxisIndex: index,
    yAxisIndex: index,
    barMaxWidth: compact ? 12 : Math.max(8, barWidth / Math.max(1, panelCount / 2)),
    itemStyle: {
      color: colorFor(index, config, item.name),
      opacity: markOpacity,
      borderRadius: [3, 3, 0, 0],
    },
    label: {
      show: compact ? false : config.showLabels,
      position: "top",
      ...labelTextStyle,
      formatter: (params: unknown) => {
        const entry = params as { value: string | number };
        return ctx.formatNumber(entry.value);
      },
    },
    emphasis: { focus: "series" },
  } as SeriesOption));
  // Panel titles ride each grid's value-axis name (middle), no graphic needed.
  return { series, grid: grids, xAxis: xAxes, yAxis: yAxes };
}
