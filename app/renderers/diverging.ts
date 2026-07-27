/**
 * Diverging bar / population pyramid renderer.
 *
 * Covers two `other`-family types that share one layout: a symmetric value
 * axis (X) with absolute-value labels, and a category axis (Y) that inverts
 * for the pyramid. Two stacked bar series render on opposite sides — the
 * first series is negated, the second is positive — with their palette
 * indices swapped (first uses index 1, second uses index 0).
 *
 * Line-for-line port of the legacy buildChartOption diverging branch (legacy
 * lines 451-466, 566-625).
 *
 * NOTE: this preserves legacy behavior verbatim, including the known "silent"
 * issues (no explicit left/right role mapping; with one series both sides
 * show the same data). Task 6 is where those get fixed.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import { colorFor } from "./shared";
import {
  buildCategoryAxis,
  buildValueAxis,
  type RendererResult,
} from "./shared";

export function buildDivergingOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, formatNumber } = ctx;
  const { type, theme, fontSize, compact = false } = config;

  // Legacy style defaults.
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;

  const textColor = theme.text;
  const valueAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);

  const first = dataSeries[0] ?? { name: "系列 A", data: [] };
  const second = dataSeries[1] ?? first;
  const maxValue = Math.max(
    1,
    ...first.data.map((value) => Math.abs(value)),
    ...second.data.map((value) => Math.abs(value)),
  );

  // Legacy lines 583-591: symmetric value axis on X with absolute-value labels.
  // Route through formatNumber so numberDecimals / thousands separator /
  // prefix/suffix apply (the symmetric axis prints the absolute value).
  const divergingValueAxis = {
    ...valueAxis,
    min: -maxValue,
    max: maxValue,
    axisLabel: {
      ...valueAxis.axisLabel,
      formatter: (value: number) => formatNumber(Math.abs(value)),
    },
  };
  const xAxis = divergingValueAxis;
  // Legacy lines 593-596: category axis on Y, inverted for the pyramid.
  const yAxis = {
    ...categoryAxis,
    inverse: type === "populationPyramid",
  };

  // Horizontal diverging bars: round the leading/trailing corners only, like
  // the bar renderer does for horizontal bars.
  const borderRadius: [number, number, number, number] = [0, barRadius, barRadius, 0];
  const insideLabel = {
    show: compact ? false : config.showLabels,
    position: "inside" as const,
    color: "#ffffff",
    formatter: (params: unknown) => {
      const item = params as { value: number };
      return formatNumber(Math.abs(item.value));
    },
  };

  const series: SeriesOption[] = [
    {
      name: first.name,
      type: "bar",
      stack: "diverging",
      barMaxWidth: compact ? 12 : barWidth,
      data: first.data.map((value) => -Math.abs(value)),
      itemStyle: {
        color: colorFor(1, config, first.name),
        opacity: markOpacity,
        borderRadius,
      },
      label: insideLabel,
    },
    {
      name: second.name,
      type: "bar",
      stack: "diverging",
      barMaxWidth: compact ? 12 : barWidth,
      data: second.data.map((value) => Math.abs(value)),
      itemStyle: {
        color: colorFor(0, config, second.name),
        opacity: markOpacity,
        borderRadius,
      },
      label: insideLabel,
    },
  ];

  return { series, xAxis, yAxis };
}
