/**
 * Advanced and high-demand chart renderers.
 *
 * These templates cover common Flourish / data-journalism chart needs beyond
 * the original line-bar-pie MVP while still using the same ECharts SVG renderer
 * path, so export behavior remains consistent.
 */
import type { EChartsOption, SeriesOption } from "echarts";
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
