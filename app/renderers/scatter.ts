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
import {
  themeInk,
  colorFor,
  dataLabelTextStyle,
  resolveDataLabelPosition,
} from "./shared";
import { buildValueAxis, type RendererResult } from "./shared";

export function buildScatterOption(ctx: RenderContext): RendererResult {
  const { config, categories } = ctx;
  const { parsed, fontSize, compact = false } = config;

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

  const textColor = themeInk(config);
  const labelTextStyle = dataLabelTextStyle(config);
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
        position: resolveDataLabelPosition(config, "top"),
        ...labelTextStyle,
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

// ---------------------------------------------------------------------------
// Flourish parity batch 4: scatter/bubble extensions.
// ---------------------------------------------------------------------------

/** Numeric columns actually selected (names), in order. Shared by wrappers. */
function selectedNumericColumns(ctx: RenderContext): string[] {
  const valid = ctx.config.seriesColumns.filter((header) =>
    ctx.config.parsed.numericHeaders.includes(header),
  );
  return valid.length ? valid : ctx.config.parsed.numericHeaders.slice(0, 1);
}

/** 气泡图: scatter where the third numeric column (or an explicit sizeColumn)
 *  drives per-point bubble size. */
export function buildBubbleOption(ctx: RenderContext): RendererResult {
  const selected = selectedNumericColumns(ctx);
  const sizeCandidate = selected[2];
  return buildScatterOption({
    ...ctx,
    config: { ...ctx.config, sizeColumn: ctx.config.sizeColumn ?? sizeCandidate },
  });
}

/** 回归散点图: scatter with the least-squares trend line forced on. */
export function buildTrendScatterOption(ctx: RenderContext): RendererResult {
  return buildScatterOption({
    ...ctx,
    config: { ...ctx.config, scatterTrendLine: true },
  });
}

/** 象限图: scatter with median (or mean) cross lines shading the four quadrants. */
export function buildQuadrantOption(ctx: RenderContext): RendererResult {
  const result = buildScatterOption(ctx);
  const { config } = ctx;
  const selected = selectedNumericColumns(ctx);
  const xIndex = columnIndex(config.parsed.headers, selected[0] ?? "");
  const yIndex = columnIndex(config.parsed.headers, selected[1] ?? "");
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of config.parsed.rows) {
    const x = toNumber(row[xIndex]);
    const y = toNumber(row[yIndex]);
    if (Number.isFinite(x)) xs.push(x);
    if (Number.isFinite(y)) ys.push(y);
  }
  const center = config.quadrantCenter === "mean" ? "mean" : "median";
  const centerOf = (values: number[]) => {
    if (!values.length) return 0;
    if (center === "mean") {
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const medX = centerOf(xs);
  const medY = centerOf(ys);
  const [scatterSeries] = result.series;
  (scatterSeries as { markLine?: unknown }).markLine = {
    silent: true,
    symbol: ["none", "none"],
    lineStyle: { type: "dashed" as const, color: config.theme.grid },
    label: { show: false },
    data: [{ xAxis: medX }, { yAxis: medY }],
  };
  (scatterSeries as { markArea?: unknown }).markArea = {
    silent: true,
    data: [
      [
        { itemStyle: { color: "rgba(22, 99, 235, 0.06)" }, xAxis: medX, yAxis: medY },
        { xAxis: "max", yAxis: "max" },
      ],
      [
        { itemStyle: { color: "rgba(22, 99, 235, 0.06)" }, xAxis: "min", yAxis: "min" },
        { xAxis: medX, yAxis: medY },
      ],
    ],
  };
  return result;
}

/** 分组散点图: one series per category value so groups get legend entries and
 *  their own palette slot. */
export function buildGroupedScatterOption(ctx: RenderContext): RendererResult {
  const { config, categories } = ctx;
  const { parsed, fontSize, compact = false } = config;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const selected = selectedNumericColumns(ctx);
  const xIndex = columnIndex(parsed.headers, selected[0] ?? "");
  const yIndex = columnIndex(parsed.headers, selected[1] ?? "");

  const textColor = themeInk(config);
  const labelTextStyle = dataLabelTextStyle(config);
  const xAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);

  // Group rows by category value in first-seen order; deterministic mapping.
  const groups: Array<{ name: string; points: [number, number][] }> = [];
  const indexOfGroup: Record<string, number> = {};
  parsed.rows.forEach((row, rowIndex) => {
    const name = categories[rowIndex] ?? "";
    if (!(name in indexOfGroup)) {
      indexOfGroup[name] = groups.length;
      groups.push({ name, points: [] });
    }
    groups[indexOfGroup[name]].points.push([
      toNumber(row[xIndex]),
      toNumber(row[yIndex]),
    ]);
  });

  const series: SeriesOption[] = groups.map((group, index) => ({
    name: group.name,
    type: "scatter",
    symbolSize: compact ? 7 : pointSize,
    itemStyle: { color: colorFor(index, config, group.name), opacity: markOpacity },
    label: {
      show: compact ? false : config.showLabels,
      position: resolveDataLabelPosition(config, "top"),
      ...labelTextStyle,
      formatter: () => group.name,
    },
    data: group.points.map(([x, y]) => [x, y]),
  } as SeriesOption));
  return { series, xAxis, yAxis };
}

/** 蜂群图: deterministic one-dimensional beeswarm. Within each category the
 *  points are sorted and greedily nudged sideways so circles never overlap. */
export function buildBeeswarmOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { fontSize, compact = false } = config;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const values = dataSeries[0]?.data ?? [];
  const categoryIndex: Record<string, number> = {};
  categories.forEach((name) => {
    if (!(name in categoryIndex)) categoryIndex[name] = Object.keys(categoryIndex).length;
  });

  const finite = values.filter(Number.isFinite);
  const valueMax = finite.length ? Math.max(...finite) : 1;
  const valueMin = finite.length ? Math.min(...finite) : 0;
  const valueRange = Math.max(valueMax - valueMin, 1);
  const maxPerCategory = (() => {
    const counts: Record<string, number> = {};
    for (const name of categories) counts[name] = (counts[name] ?? 0) + 1;
    return Math.max(1, ...Object.values(counts));
  })();
  // Half a slot-width as the point radius keeps stacked circles inside their
  // category band; the sideways unit matches value units for collision math.
  const slotWidth = valueRange / maxPerCategory;
  const radius = slotWidth / 2;

  const placedByCategory: Record<string, Array<{ y: number; x: number }>> = {};
  const data = values.map((value, rowIndex) => {
    const category = categories[rowIndex] ?? "";
    const bucket = (placedByCategory[category] ??= []);
    if (!Number.isFinite(value)) return [categoryIndex[category] ?? 0, value];
    // Greedy beeswarm: try offsets 0, ±step, ±2step ... pick the first with
    // no overlap against already-placed points of the same category.
    const step = radius * 0.9;
    let chosenX = 0;
    outer: for (let k = 0; k < 64; k += 1) {
      for (const candidate of (k === 0 ? [0] : [k * step, -k * step])) {
        const collides = bucket.some(
          (placed) =>
            (placed.y - value) * (placed.y - value) +
              (placed.x - candidate) * (placed.x - candidate) <
            (2 * radius) * (2 * radius) * 0.98,
        );
        if (!collides) {
          chosenX = candidate;
          break outer;
        }
      }
    }
    bucket.push({ y: value, x: chosenX });
    return [(categoryIndex[category] ?? 0) + chosenX / slotWidth, value];
  });

  const textColor = themeInk(config);
  const labelTextStyle = dataLabelTextStyle(config);
  const xAxis = {
    ...buildValueAxis(ctx, textColor, fontSize, compact),
    max: Math.max(0.5, Object.keys(categoryIndex).length - 0.5),
    min: -0.5,
    interval: 1,
    axisLabel: {
      ...((buildValueAxis(ctx, textColor, fontSize, compact) as { axisLabel?: Record<string, unknown> }).axisLabel ?? {}),
      formatter: (value: number) => {
        const names = Object.keys(categoryIndex);
        const index = Math.round(value);
        return names[index] ?? "";
      },
    },
  };
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "数值",
      type: "scatter",
      symbolSize: compact ? 6 : pointSize + 5,
      itemStyle: { color: colorFor(0, config), opacity: markOpacity },
      label: {
        show: compact ? false : config.showLabels,
        position: "top",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const item = params as { dataIndex: number };
          return categories[item.dataIndex] ?? "";
        },
      },
      data,
    } as SeriesOption,
  ];
  return { series, xAxis, yAxis };
}
