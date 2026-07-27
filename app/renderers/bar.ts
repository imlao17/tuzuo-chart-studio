/**
 * Bar / column family renderer.
 *
 * Covers the 7 cartesian bar types:
 *   horizontal: bar, stackedBar, proportionalBar
 *   vertical:   column, groupedColumn, stackedColumn, proportionalColumn
 *
 * This is a line-for-line port of the bar-producing path inside the legacy
 * buildChartOption's catch-all `else` branch (legacy lines 451-463, 465-466,
 * 626-696). Line/area/combo types are NOT handled here — they still run legacy.
 *
 * Because the legacy map handled both line and bar series in one body, this
 * port keeps the same field assignments; with `isLine`/`comboLine` forced to
 * false the line-specific branches (smooth/step/symbol/lineStyle/areaStyle)
 * evaluate exactly as legacy did for bar types, producing identical output.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import { colorFor } from "./shared";
import {
  buildCategoryAxis,
  buildValueAxis,
  type RendererResult,
} from "./shared";

const HORIZONTAL_TYPES = new Set(["bar", "stackedBar", "proportionalBar"]);
const STACKED_TYPES = new Set([
  "stackedBar",
  "proportionalBar",
  "stackedColumn",
  "proportionalColumn",
]);

export function buildBarOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, formatNumber } = ctx;
  const { type, theme, fontSize, compact = false } = config;

  // Legacy style defaults (legacy lines 390-400).
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const pointSize = config.pointSize ?? 7;

  // Legacy orientation/stack flags (legacy lines 451-463), restricted to the
  // bar types this renderer owns.
  const isHorizontal = HORIZONTAL_TYPES.has(type);
  const stacked = STACKED_TYPES.has(type);

  // Legacy axes (legacy lines 465-466).
  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const xAxis = isHorizontal ? valueAxis : categoryAxis;
  const yAxis = isHorizontal ? categoryAxis : valueAxis;

  // Legacy line 634-635: `column` (and `area`, but area runs legacy here) only
  // render the first series; the other bar/column types render all selected.
  const visibleDataSeries =
    type === "column" ? dataSeries.slice(0, 1) : dataSeries;

  const textColor = theme.text;

  const series: SeriesOption[] = visibleDataSeries.map((item, index) => {
    const color = colorFor(index, config, item.name);
    // In the legacy map `seriesType` was "line" when isLine/comboLine, else
    // "bar". This renderer only handles bar types, so it is always "bar". The
    // remaining field assignments mirror legacy lines 645-694 exactly; the
    // line-only conditions evaluate the same way they did for bar types.
    const seriesType = "bar";
    return {
      name: item.name,
      type: seriesType,
      data: item.data,
      stack: stacked ? "total" : undefined,
      smooth: false,
      step: undefined,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: {
        color,
        opacity: markOpacity,
        borderRadius: isHorizontal
          ? [0, barRadius, barRadius, 0]
          : [barRadius, barRadius, 0, 0],
      },
      lineStyle: { color, width: compact ? 1.5 : 3 },
      areaStyle: undefined,
      label: {
        show: compact ? false : config.showLabels,
        position:
          config.labelPosition === "inside" ? "inside" : isHorizontal ? "right" : "top",
        color: textColor,
        fontSize,
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
