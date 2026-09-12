/**
 * Line / area family renderer.
 *
 * Covers the 6 cartesian line types:
 *   line, smoothLine, stepLine (line family)
 *   area, stackedArea, proportionalArea (area family)
 *
 * Line-for-line port of the line-producing path inside the legacy
 * buildChartOption's catch-all `else` branch (legacy lines 451-463, 465-466,
 * 635-705). Bar/combo/scatter/diverging/streamgraph are NOT handled here.
 *
 * Like bar.ts, this port keeps the same field assignments as the legacy map
 * body. With `isLine` true the line-specific branches (smooth/step/symbol/
 * lineStyle/areaStyle) evaluate exactly as legacy did for line/area types,
 * and the bar-only branches (barMaxWidth/borderRadius) land on their legacy
 * no-op values, producing identical output.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import {
  themeInk,
  colorFor,
  dataLabelTextStyle,
  resolveDataLabelPosition,
} from "./shared";
import {
  buildCategoryAxis,
  buildValueAxis,
  type RendererResult,
} from "./shared";

const STACKED_TYPES = new Set(["stackedArea", "proportionalArea"]);
const AREA_TYPES = new Set([
  "area",
  "stackedArea",
  "proportionalArea",
  // Flourish parity batch 2: area variants ride the same path.
  "smoothArea",
  "stepArea",
]);
const SMOOTH_BY_DEFAULT = new Set([
  "smoothLine",
  "stackedArea",
  "proportionalArea",
  "smoothArea",
]);

export function buildLineAreaOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, formatNumber } = ctx;
  const { type, fontSize, compact = false } = config;

  // Legacy style defaults (legacy lines 399-404).
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const barWidth = config.barWidth ?? 48;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const areaOpacity = (config.areaOpacity ?? 22) / 100;

  const stacked = STACKED_TYPES.has(type);
  const isArea = AREA_TYPES.has(type);

  // Legacy axes (legacy lines 465-466): line/area are vertical, so
  // xAxis=categoryAxis, yAxis=valueAxis.
  const textColor = themeInk(config);
  const labelTextStyle = dataLabelTextStyle(config);
  const xAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);

  // Legacy line 643-644: `area` (and `column`, but column runs in bar.ts)
  // only render the first series; the other line/area types render all.
  const visibleDataSeries = type === "area" ? dataSeries.slice(0, 1) : dataSeries;

  // P1-2 marks: shaded vertical bands and horizontal reference lines. Both are
  // series-level in ECharts, so attach them to the first rendered series once.
  const markArea =
    config.referenceBands && config.referenceBands.length
      ? {
          silent: true,
          itemStyle: { color: "rgba(22, 99, 235, 0.08)" },
          data: config.referenceBands.map((band) => [
            { xAxis: band.start, label: band.label ? { show: true, formatter: band.label } : undefined },
            { xAxis: band.end },
          ]),
        }
      : undefined;
  const markLine =
    config.referenceLines && config.referenceLines.length
      ? {
          silent: true,
          symbol: ["none", "none"],
          lineStyle: { type: "dashed" as const },
          data: config.referenceLines.map((line) => ({
            yAxis: line.value,
            label: line.label ? { show: true, formatter: line.label } : undefined,
          })),
        }
      : undefined;

  // endLabel only applies to line series (ECharts ignores it on area). When
  // enabled, suppress the per-point label so only the end label shows.
  const endLabelEnabled = !compact && !isArea && config.endLabel;
  const showPerPointLabel = (compact ? false : config.showLabels) && !endLabelEnabled;

  // 点线图: oversized beads on deliberately thin lines.
  const isPointLine = type === "pointLine";

  const series: SeriesOption[] = visibleDataSeries.map((item, index) => {
    const color = colorFor(index, config, item.name);
    // In the legacy map `seriesType` was "line" when isLine/comboLine, else
    // "bar". This renderer only handles line/area types, so it is always
    // "line". The remaining field assignments mirror legacy lines 650-703
    // exactly; the bar-only conditions evaluate the same way they did for
    // line/area types.
    const seriesType = "line";
    return {
      name: item.name,
      type: seriesType,
      data: item.data,
      stack: stacked ? "total" : undefined,
      smooth:
        seriesType === "line" &&
        (SMOOTH_BY_DEFAULT.has(type) || config.smooth),
      step:
        type === "stepLine" || type === "stepArea" ? "middle" : undefined,
      // P1-2: optionally bridge missing (NaN) values instead of leaving a gap.
      connectNulls: config.connectNulls || undefined,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : isPointLine ? Math.max(pointSize, 10) : pointSize,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: {
        color,
        opacity: markOpacity,
        // seriesType is "line", so borderRadius lands on 0 as legacy did.
        borderRadius: 0,
      },
      lineStyle: {
        color,
        width: compact ? 1.5 : isPointLine ? 1.5 : lineWidth,
      },
      areaStyle: isArea
        ? {
            color,
            opacity: stacked ? Math.max(areaOpacity, 0.5) : areaOpacity,
          }
        : undefined,
      label: {
        show: showPerPointLabel,
        position: resolveDataLabelPosition(config, "top"),
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return formatNumber(entry.value);
        },
      },
      // P1-2: end-of-line label (series name) for line series.
      endLabel: endLabelEnabled
        ? {
            show: true,
            formatter: "{a}",
            color,
            fontSize: labelTextStyle.fontSize,
            fontWeight: labelTextStyle.fontWeight,
            fontStyle: labelTextStyle.fontStyle,
          }
        : undefined,
      // P1-2 marks attach to the first series only.
      markArea: index === 0 ? markArea : undefined,
      markLine: index === 0 ? markLine : undefined,
      emphasis: { focus: "series" },
    } as SeriesOption;
  });

  return { series, xAxis, yAxis };
}

// ---------------------------------------------------------------------------
// Flourish parity batch 2: line/area extensions.
// ---------------------------------------------------------------------------

/** 双轴折线图: first series on the left value axis, the rest on a right one. */
export function buildDualAxisLineOption(ctx: RenderContext): RendererResult {
  const result = buildLineAreaOption(ctx);
  const { config } = ctx;
  const { fontSize, compact = false } = config;
  const series = result.series.map((item, index) =>
    index === 0
      ? item
      : ({ ...item, yAxisIndex: 1 } as SeriesOption),
  );
  const rightAxis = buildValueAxis(ctx, themeInk(config), fontSize, compact);
  return {
    ...result,
    series,
    yAxis: [result.yAxis, rightAxis] as RendererResult["yAxis"],
  };
}

/** 斜率图: one line per row across exactly two period columns. */
export function buildSlopeOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { fontSize, compact = false } = config;
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const labelTextStyle = dataLabelTextStyle(config);

  const left = dataSeries[0] ?? { name: "期初", data: [] };
  const right = dataSeries[1] ?? { name: "期末", data: [] };
  const categoryAxis = {
    ...buildCategoryAxis(ctx, themeInk(config), fontSize, compact),
    data: [left.name, right.name],
  };
  const valueAxis = buildValueAxis(ctx, themeInk(config), fontSize, compact);

  // Transpose: each row (entity) becomes its own two-point series.
  const series: SeriesOption[] = categories.map((entity, rowIndex) => {
    const color = colorFor(rowIndex, config, entity);
    return {
      name: entity,
      type: "line",
      data: [left.data[rowIndex], right.data[rowIndex]],
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize + 2,
      itemStyle: { color, opacity: markOpacity },
      lineStyle: { color, width: compact ? 1.5 : lineWidth },
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
    } as SeriesOption;
  });
  return { series, xAxis: categoryAxis, yAxis: valueAxis };
}

/** 区间面积图: shaded band between lower/upper with a mid line on top. */
export function buildBandAreaOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { fontSize, compact = false } = config;
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const labelTextStyle = dataLabelTextStyle(config);

  const lower = dataSeries[0] ?? { name: "下限", data: [] };
  const upper = dataSeries[1] ?? { name: "上限", data: [] };
  const mid = dataSeries[2] ?? { name: "中值", data: [] };
  const bandColor = colorFor(0, config);
  const span = upper.data.map((value, i) =>
    Math.max(0, (Number.isFinite(value) ? value : 0) - (Number.isFinite(lower.data[i]) ? lower.data[i] : 0)),
  );

  const xAxis = buildCategoryAxis(ctx, themeInk(config), fontSize, compact);
  const yAxis = buildValueAxis(ctx, themeInk(config), fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: lower.name,
      type: "line",
      data: lower.data,
      stack: "band",
      silent: true,
      symbol: "none",
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      label: { show: false },
      tooltip: { show: false },
      emphasis: { focus: "none" },
    },
    {
      name: upper.name,
      type: "line",
      data: span,
      stack: "band",
      symbol: "none",
      lineStyle: { opacity: 0 },
      areaStyle: {
        color: bandColor,
        opacity: compact ? 0.35 : Math.min(0.9, ((config.areaOpacity ?? 22) / 100) * 1.6),
      },
      label: { show: false },
      emphasis: { focus: "series" },
    },
    {
      name: mid.name,
      type: "line",
      data: mid.data,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      itemStyle: { color: colorFor(1, config) },
      lineStyle: { color: colorFor(1, config), width: compact ? 1.5 : lineWidth },
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
    },
  ];
  return { series, xAxis, yAxis };
}

/** 脊线图: joyplot-style stacked ridges, one per numeric column, offset by a
 *  synthetic transparent base so each ridge sits below the previous one. */
export function buildRidgelineOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { fontSize, compact = false } = config;
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const areaOpacity = compact ? 0.5 : Math.min(0.9, (config.areaOpacity ?? 22) / 100 + 0.35);

  const allValues = dataSeries.flatMap((s) => s.data).filter(Number.isFinite);
  const maxAbs = allValues.length ? Math.max(...allValues.map(Math.abs)) : 1;
  const offsetStep = maxAbs * 0.45;

  const xAxis = buildCategoryAxis(ctx, themeInk(config), fontSize, compact);
  const yAxis = buildValueAxis(ctx, themeInk(config), fontSize, compact);
  const series: SeriesOption[] = [];
  dataSeries.forEach((item, index) => {
    const color = colorFor(index, config, item.name);
    series.push({
      name: item.name,
      type: "line",
      data: item.data.map(() => offsetStep * index),
      stack: `ridge-${index}`,
      silent: true,
      symbol: "none",
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      label: { show: false },
      tooltip: { show: false },
      emphasis: { focus: "none" },
    } as SeriesOption);
    series.push({
      name: item.name,
      type: "line",
      data: item.data,
      stack: `ridge-${index}`,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      itemStyle: { color },
      lineStyle: { color, width: compact ? 1.5 : lineWidth },
      areaStyle: { color, opacity: areaOpacity },
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
    } as SeriesOption);
  });
  return { series, xAxis, yAxis };
}

/** 凹凸图: values converted to per-period ranks, plotted on an inverted axis
 *  so rank 1 rides the top. */
export function buildBumpOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { fontSize, compact = false } = config;
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const labelTextStyle = dataLabelTextStyle(config);
  const rowCount = categories.length || 1;

  const xAxis = buildCategoryAxis(ctx, themeInk(config), fontSize, compact);
  const valueAxis = {
    ...buildValueAxis(ctx, themeInk(config), fontSize, compact),
    min: 1,
    max: rowCount,
    inverse: true,
    axisLabel: {
      ...(buildValueAxis(ctx, themeInk(config), fontSize, compact) as { axisLabel?: Record<string, unknown> }).axisLabel,
      formatter: (value: number) => `#${value}`,
    },
  };

  const series: SeriesOption[] = dataSeries.map((item, index) => {
    const color = colorFor(index, config, item.name);
    // Deterministic competition ranking per period: sort row indices by value
    // descending, ties broken by original row order.
    const indices = item.data.map((_, i) => i);
    indices.sort((a, b) => {
      const va = Number.isFinite(item.data[a]) ? item.data[a] : 0;
      const vb = Number.isFinite(item.data[b]) ? item.data[b] : 0;
      return vb - va || a - b;
    });
    const ranks = new Array<number>(item.data.length).fill(rowCount);
    indices.forEach((rowIndex, position) => ranks[rowIndex] = position + 1);
    return {
      name: item.name,
      type: "line",
      data: ranks,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize + 3,
      itemStyle: { color },
      lineStyle: { color, width: compact ? 2 : lineWidth + 1 },
      label: {
        show: compact ? false : config.showLabels,
        position: "top",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: number };
          return `#${entry.value}`;
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption;
  });
  return { series, xAxis, yAxis: valueAxis };
}
