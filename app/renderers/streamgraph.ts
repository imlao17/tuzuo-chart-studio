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
import type { RendererResult } from "./shared";

export function buildStreamgraphOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { title, subtitle, margins, theme, fontSize, compact = false } = config;

  const textColor = theme.text;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const gridTop = compact ? 6 : margins.top + titleBlock;
  const gridBottom = compact ? 6 : margins.bottom;
  const gridLeft = compact ? 6 : margins.left;
  const gridRight = compact ? 6 : margins.right;

  const splitLine = {
    show: compact ? false : config.showGrid,
    lineStyle: { color: theme.grid, type: config.gridLineType ?? "dashed" },
  };

  const riverData = dataSeries.flatMap((item) =>
    item.data.map((value, index) => [index, value, item.name]),
  );

  const singleAxis: EChartsOption["singleAxis"] = {
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
