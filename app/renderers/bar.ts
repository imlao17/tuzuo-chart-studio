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

  // Optional stack-order reorder. Each entry carries its original index so
  // colorFor still maps to the same palette slot regardless of stack position.
  type OrderedItem = { item: (typeof visibleDataSeries)[number]; originalIndex: number };
  let ordered: OrderedItem[] = visibleDataSeries.map((item, originalIndex) => ({
    item,
    originalIndex,
  }));
  if (stacked && config.stackOrder) {
    const dir = config.stackOrder === "desc" ? -1 : 1;
    const totalOf = (item: (typeof visibleDataSeries)[number]) =>
      item.data.reduce(
        (sum, v) => sum + (Number.isFinite(v) ? Math.abs(v) : 0),
        0,
      );
    ordered = [...ordered].sort((a, b) => (totalOf(a.item) - totalOf(b.item)) * dir);
  }

  // Per-column totals for the stack-total label (stacked only). The label is
  // attached to the topmost stack member so it renders once per column.
  const showTotals = !compact && stacked && config.showStackTotals;
  const columnTotals = showTotals
    ? ordered[0].item.data.map((_, colIdx) =>
        ordered.reduce(
          (sum, entry) =>
            sum + (Number.isFinite(entry.item.data[colIdx]) ? entry.item.data[colIdx] : 0),
          0,
        ),
      )
    : [];

  const labelTextStyle = dataLabelTextStyle(config);
  const showLabels = compact ? false : config.showLabels;

  const series: SeriesOption[] = ordered.map(({ item, originalIndex }, topIndex) => {
    const color = colorFor(originalIndex, config, item.name);
    const isTopOfStack = stacked && topIndex === ordered.length - 1;
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
      barGap: config.barGap,
      barCategoryGap: config.barCategoryGap,
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
        show: showLabels,
        position: resolveDataLabelPosition(
          config,
          isHorizontal ? "right" : "top",
        ),
        ...labelTextStyle,
        formatter: (params: unknown) => {
          // Stack totals replace the segment value on the topmost series so
          // each column shows one sum instead of per-segment labels.
          if (isTopOfStack && showTotals) {
            const entry = params as { dataIndex: number };
            return formatNumber(columnTotals[entry.dataIndex] ?? 0);
          }
          const entry = params as { value: string | number };
          return formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption;
  });

  return { series, xAxis, yAxis };
}
