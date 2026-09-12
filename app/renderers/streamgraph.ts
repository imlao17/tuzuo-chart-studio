/**
 * Streamgraph family renderer.
 *
 * Covers the single `streamgraph` type: a themeRiver series plotted against a
 * single value axis whose labels map back to the category names.
 *
 * Line-for-line port of the legacy buildChartOption streamgraph branch (legacy
 * lines 402-406, 407-411, 412-417, 536-565). Axes are cleared and a
 * singleAxis carries the layout; the assembler's `hasSingleAxis` check
 * handles omitting `grid`.
 *
 * NOTE: this preserves legacy behavior verbatim, including the known issue
 * that the "time" axis is just row indices, not real dates. Task 6 fixes it.
 */
import type { EChartsOption, SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import {
  themeInk,
  axisLabelTextStyle,
  LEGEND_HORIZONTAL_SPACE,
  LEGEND_VERTICAL_SPACE,
  type RendererResult,
} from "./shared";

export function buildStreamgraphOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { title, subtitle, margins, theme, fontSize, compact = false } = config;

  const textColor = themeInk(config);
  const singleAxisTextStyle = axisLabelTextStyle(
    config.xAxisLabelStyle,
    config,
    textColor,
    fontSize,
  );
  const legendPosition = config.legendPosition ?? "top";
  const legendVisible = !compact && config.showLegend && dataSeries.length > 1;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const gridTop =
    compact
      ? 6
      : margins.top +
        titleBlock +
        (legendVisible && legendPosition === "top"
          ? LEGEND_HORIZONTAL_SPACE
          : 0);
  const gridBottom =
    compact
      ? 6
      : margins.bottom +
        (legendVisible && legendPosition === "bottom"
          ? LEGEND_HORIZONTAL_SPACE
          : 0);
  const gridLeft =
    compact
      ? 6
      : margins.left +
        (legendVisible && legendPosition === "left"
          ? LEGEND_VERTICAL_SPACE
          : 0);
  const gridRight =
    compact
      ? 6
      : margins.right +
        (legendVisible && legendPosition === "right"
          ? LEGEND_VERTICAL_SPACE
          : 0);

  const splitLine = {
    show: compact ? false : config.showGrid,
    lineStyle: { color: theme.grid, type: config.gridLineType ?? "dashed" },
  };

  // P1-6 time axis: when the user opts in, try to parse each category as a
  // date. If every category parses, switch the axis to type:"time" and carry
  // timestamps in the data tuples; if any fail (e.g. Chinese month names,
  // plain labels), fall back to row indices so the chart still renders.
  const useTimeAxis = !compact && config.streamTimeAxis === true;
  const parsedTimes = useTimeAxis
    ? categories.map((c) => Date.parse(String(c)))
    : null;
  const allDates = parsedTimes !== null && parsedTimes.every((t) => Number.isFinite(t));

  // The x-coordinate for each category: a timestamp when the time axis is
  // active and parseable, otherwise the original row index.
  const xOf = (index: number) =>
    allDates ? parsedTimes[index] : index;

  const riverData = dataSeries.flatMap((item) =>
    item.data.map((value, index) => [xOf(index), value, item.name]),
  );

  // Date label formatter: pick a granularity based on the span. If the data
  // spans multiple years, show YYYY-MM; within a year, show MM-DD; otherwise
  // fall back to the raw category string.
  const formatTimeLabel = (value: number) => {
    const idx = parsedTimes ? parsedTimes.indexOf(value) : -1;
    if (idx >= 0) return categories[idx] ?? "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return allDates && parsedTimes ? `${y}-${m}-${day}` : `${y}-${m}`;
  };

  const singleAxis: EChartsOption["singleAxis"] = {
    type: allDates ? "time" : "value",
    top: gridTop,
    bottom: gridBottom,
    left: gridLeft,
    right: gridRight,
    axisLabel: {
      show: !compact,
      ...singleAxisTextStyle,
      formatter: allDates
        ? (value: number) => formatTimeLabel(value)
        : (value: number) => categories[Math.round(value)] ?? "",
    },
    axisTick: { show: false },
    splitLine,
    max: allDates ? undefined : Math.max(0, categories.length - 1),
  };

  const series: SeriesOption[] = [
    {
      type: "themeRiver",
      data: riverData,
      label: { show: false },
      emphasis: { focus: "series" },
    } as SeriesOption,
  ];

  // Axes cleared (legacy lines 573-574); singleAxis carries the layout.
  return { series, singleAxis };
}
