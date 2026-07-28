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

  // P1-4 optional roles: per-point size (bubble), color (categorical), and
  // shape (categorical). Each is a column name; undefined = single global
  // style. Any of them switches the data array from the legacy flat [x,y]
  // form to ECharts' object form so we can carry per-point styling.
  const sizeName = config.sizeColumn;
  const colorName = config.colorColumn;
  const shapeName = config.shapeColumn;
  const sizeIndex = sizeName ? columnIndex(parsed.headers, sizeName) : -1;
  const colorIndex = colorName ? columnIndex(parsed.headers, colorName) : -1;
  const shapeIndex = shapeName ? columnIndex(parsed.headers, shapeName) : -1;
  const useObjectForm = Boolean(sizeName || colorName || shapeName);

  // Size normalization: map the size column's [min,max] to a pixel range.
  const SYMBOL_MIN = 6;
  const SYMBOL_MAX = 40;
  let sizeMin = Infinity;
  let sizeMax = -Infinity;
  if (sizeIndex >= 0) {
    for (const row of parsed.rows) {
      const v = toNumber(row[sizeIndex]);
      if (Number.isFinite(v)) {
        if (v < sizeMin) sizeMin = v;
        if (v > sizeMax) sizeMax = v;
      }
    }
  }
  const sizeRange = sizeMax - sizeMin;

  // Categorical color/shape lookups: assign distinct palette entries / symbols
  // to the unique values of the bound column in first-seen order.
  const palette = [
    config.primaryColor,
    config.secondaryColor,
    ...config.theme.colors.slice(2),
  ];
  const SHAPES = ["circle", "rect", "triangle", "diamond", "pin", "arrow", "roundRect"];
  const colorOfCategory: Record<string, string> = {};
  const shapeOfCategory: Record<string, string> = {};
  let nextColor = 0;
  let nextShape = 0;
  const resolveColor = (raw: string) => {
    if (!(raw in colorOfCategory)) {
      colorOfCategory[raw] = palette[nextColor % palette.length];
      nextColor += 1;
    }
    return colorOfCategory[raw];
  };
  const resolveShape = (raw: string) => {
    if (!(raw in shapeOfCategory)) {
      shapeOfCategory[raw] = SHAPES[nextShape % SHAPES.length];
      nextShape += 1;
    }
    return shapeOfCategory[raw];
  };

  const rawData = parsed.rows.map((row) => ({
    x: toNumber(row[xIndex]),
    y: toNumber(row[yIndex]),
    size: sizeIndex >= 0 ? toNumber(row[sizeIndex]) : NaN,
    color: colorIndex >= 0 ? (row[colorIndex] ?? "") : "",
    shape: shapeIndex >= 0 ? (row[shapeIndex] ?? "") : "",
  }));

  const data = useObjectForm
    ? rawData.map((point) => {
        const entry: {
          value: [number, number];
          symbolSize?: number;
          itemStyle?: { color?: string };
          symbol?: string;
        } = { value: [point.x, point.y] };
        if (sizeIndex >= 0 && Number.isFinite(point.size)) {
          entry.symbolSize =
            sizeRange > 0
              ? SYMBOL_MIN + ((point.size - sizeMin) / sizeRange) * (SYMBOL_MAX - SYMBOL_MIN)
              : (SYMBOL_MIN + SYMBOL_MAX) / 2;
        }
        if (colorIndex >= 0) {
          entry.itemStyle = { color: resolveColor(point.color) };
        }
        if (shapeIndex >= 0) {
          entry.symbol = resolveShape(point.shape);
        }
        return entry;
      })
    : rawData.map((point) => [point.x, point.y]);

  // P1-4 trend line: least-squares fit over the valid (x,y) points. Drawn as a
  // two-point markLine across the x range. Requires at least 2 valid points.
  let markLine: SeriesOption["markLine"] = undefined;
  if (!compact && config.scatterTrendLine) {
    const fitPoints = rawData.filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
    );
    if (fitPoints.length >= 2) {
      const n = fitPoints.length;
      const sumX = fitPoints.reduce((s, p) => s + p.x, 0);
      const sumY = fitPoints.reduce((s, p) => s + p.y, 0);
      const sumXX = fitPoints.reduce((s, p) => s + p.x * p.x, 0);
      const sumXY = fitPoints.reduce((s, p) => s + p.x * p.y, 0);
      const denom = n * sumXX - sumX * sumX;
      if (denom !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const xs = fitPoints.map((p) => p.x);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        markLine = {
          silent: true,
          symbol: ["none", "none"],
          lineStyle: { type: "dashed" },
          data: [
            [
              { coord: [xMin, slope * xMin + intercept] },
              { coord: [xMax, slope * xMax + intercept] },
            ],
          ],
        };
      }
    }
  }

  const series: SeriesOption[] = [
    {
      name: yName,
      type: "scatter",
      // Per-point symbolSize/itemStyle/symbol come from object-form entries;
      // otherwise the series-level default applies (legacy behavior).
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
      data,
      markLine,
    } as SeriesOption,
  ];

  return { series, xAxis, yAxis };
}
