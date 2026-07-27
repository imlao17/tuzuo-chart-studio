/**
 * Scatter family renderer.
 *
 * Covers the single `scatter` type: X is the first selected numeric column,
 * Y is the second, points are labeled by the category column.
 *
 * Line-for-line port of the legacy buildChartOption scatter branch (legacy
 * lines 451-466, 504-544). Both axes are value axes.
 *
 * NOTE: this preserves legacy behavior verbatim, including the known "silent"
 * issues (no explicit X/Y/size/color role mapping; with one column X=Y).
 * Task 6 is where those get fixed.
 */
import type { SeriesOption } from "echarts";
import { columnIndex, toNumber } from "../chart-model";
import type { RenderContext } from "../template-definition";
import { colorFor } from "./shared";
import { buildValueAxis, type RendererResult } from "./shared";

export function buildScatterOption(ctx: RenderContext): RendererResult {
  const { config, categories } = ctx;
  const { parsed, theme, fontSize, compact = false } = config;

  // Legacy style defaults.
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;

  // Legacy lines 380-385: re-derive the pre-normalization selected columns.
  // scatter uses the column NAMES (not the normalized dataSeries) so it can
  // pick X and Y independently and read raw row values.
  const validSeriesColumns = config.seriesColumns.filter((header) =>
    parsed.numericHeaders.includes(header),
  );
  const selectedColumns = validSeriesColumns.length
    ? validSeriesColumns
    : parsed.numericHeaders.slice(0, 1);

  const textColor = theme.text;
  // Both axes are value axes (legacy lines 543-544).
  const xAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);

  const xName = selectedColumns[0] ?? parsed.numericHeaders[0];
  const yName = selectedColumns[1] ?? parsed.numericHeaders[1] ?? xName;
  const xIndex = columnIndex(parsed.headers, xName);
  const yIndex = columnIndex(parsed.headers, yName);

  const series: SeriesOption[] = [
    {
      name: yName,
      type: "scatter",
      symbolSize: compact ? 7 : pointSize,
      itemStyle: {
        color: colorFor(0, config, yName),
        opacity: markOpacity,
      },
      label: {
        show: compact ? false : config.showLabels,
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

  return { series, xAxis, yAxis };
}
