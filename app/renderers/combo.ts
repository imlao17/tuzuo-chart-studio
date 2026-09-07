/**
 * Combo (bar + line) family renderer.
 *
 * Covers the single `combo` type: series 0 is a bar, the remaining selected
 * series are lines, sharing a vertical cartesian layout.
 *
 * Line-for-line port of the combo path inside the legacy buildChartOption's
 * catch-all `else` branch (legacy lines 451-463, 465-466, 635-705). The
 * `comboLine = type === "combo" && index > 0` rule is what makes index 0 a
 * bar and the rest lines.
 *
 * NOTE: this preserves legacy behavior verbatim, including the known
 * "silent" issues (no explicit bar/line role mapping, no dual Y-axis). Task 6
 * is where those get fixed.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import {
  colorFor,
  dataLabelTextStyle,
  resolveDataLabelPosition,
} from "./shared";
import {
  buildCategoryAxis,
  buildValueAxis,
  type RendererResult,
} from "./shared";

export function buildComboOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, formatNumber } = ctx;
  const { theme, fontSize, compact = false } = config;

  // Legacy style defaults (legacy lines 399-404).
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;

  // Combo is vertical cartesian: xAxis=categoryAxis, yAxis=valueAxis.
  // P1-5 dual Y axis: when comboDualAxis is on, split bar/line series across
  // left (index 0) and right (index 1) value axes. Default (undefined) keeps a
  // single yAxis so default output is unchanged.
  const textColor = theme.text;
  const labelTextStyle = dataLabelTextStyle(config);
  const xAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
  const dualAxis = !compact && config.comboDualAxis;
  const leftAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const rightAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  // Optional axis sync: derive a shared min/max from every series' values and
  // apply it to both axes so they share a scale.
  if (dualAxis && config.comboAxisSync) {
    let min = Infinity;
    let max = -Infinity;
    for (const s of dataSeries) {
      for (const v of s.data) {
        if (Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (Number.isFinite(min) && Number.isFinite(max)) {
      (leftAxis as { min?: number; max?: number }).min = min;
      (leftAxis as { min?: number; max?: number }).max = max;
      (rightAxis as { min?: number; max?: number }).min = min;
      (rightAxis as { min?: number; max?: number }).max = max;
    }
  }
  const yAxis = dualAxis ? [leftAxis, rightAxis] : leftAxis;

  // Legacy line 643-644: combo is not in the slice condition, so all selected
  // series render.
  const visibleDataSeries = dataSeries;

  const series: SeriesOption[] = visibleDataSeries.map((item, index) => {
    const color = colorFor(index, config, item.name);
    // Per-series bar/line role. Explicit seriesKind wins; otherwise fall back
    // to the legacy rule (first series = bar, the rest = lines) so default
    // output is unchanged when no role is assigned.
    const seriesType =
      config.seriesKind?.[item.name] ?? (index === 0 ? "bar" : "line");
    return {
      name: item.name,
      type: seriesType,
      data: item.data,
      // P1-5: route bar series to the left axis (0) and line series to the
      // right axis (1) when dual-axis is on. Omit yAxisIndex otherwise so the
      // default single-axis output is unchanged.
      yAxisIndex: dualAxis ? (seriesType === "line" ? 1 : 0) : undefined,
      // Legacy `stacked` flag does not include combo, so always undefined.
      stack: undefined,
      // Legacy smooth logic: `seriesType === "line" && (...smoothLine... ||
      // smooth)`. Combo is never in the smoothLine set, so it reduces to
      // whether the global smooth flag is on for the line series only.
      smooth: seriesType === "line" && config.smooth,
      step: undefined,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: {
        color,
        opacity: markOpacity,
        // isHorizontal is false for combo, so vertical bar radius.
        borderRadius: seriesType === "bar" ? [barRadius, barRadius, 0, 0] : 0,
      },
      lineStyle: { color, width: compact ? 1.5 : lineWidth },
      // combo is not in the areaStyle condition, so always undefined.
      areaStyle: undefined,
      label: {
        show: compact ? false : config.showLabels,
        position: resolveDataLabelPosition(config, "top"),
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption;
  });

  return { series, xAxis, yAxis };
}

/** 帕累托图: descending bars plus a cumulative-percentage line on a 0–100%
 *  right axis. Flourish parity batch 1. */
export function buildParetoOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, categories } = ctx;
  const { theme, fontSize, compact = false } = config;

  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const labelTextStyle = dataLabelTextStyle(config);
  const textColor = theme.text;

  // Pareto always ranks categories by value descending unless the user picked
  // an explicit sort (which buildRenderContext has already applied).
  let orderedCategories = categories;
  let values = dataSeries[0]?.data ?? [];
  if (!config.sortCategories?.bySeries && values.length) {
    const indices = values.map((_, i) => i);
    indices.sort((a, b) => {
      const va = Number.isFinite(values[a]) ? values[a] : 0;
      const vb = Number.isFinite(values[b]) ? values[b] : 0;
      return vb - va;
    });
    orderedCategories = indices.map((i) => categories[i]);
    values = indices.map((i) => values[i]);
  }
  const total = values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  let running = 0;
  const cumulative = values.map((v) => {
    running += Number.isFinite(v) ? v : 0;
    return total ? (running / total) * 100 : 0;
  });

  const leftAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const rightAxis = {
    ...buildValueAxis(ctx, textColor, fontSize, compact),
    min: 0,
    max: 100,
    axisLabel: {
      ...(leftAxis as { axisLabel?: Record<string, unknown> }).axisLabel,
      formatter: (value: number) => `${value}%`,
    },
  };
  const xAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
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
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return ctx.formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    },
    {
      name: "累计占比",
      type: "line",
      data: cumulative,
      yAxisIndex: 1,
      smooth: false,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      itemStyle: { color: colorFor(1, config) },
      lineStyle: { color: colorFor(1, config), width: compact ? 1.5 : lineWidth },
      label: { show: false },
      emphasis: { focus: "series" },
    },
  ];
  return { series, xAxis: { ...xAxis, data: orderedCategories }, yAxis: [leftAxis, rightAxis] as RendererResult["yAxis"] };
}
