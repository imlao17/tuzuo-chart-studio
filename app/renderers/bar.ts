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

const HORIZONTAL_TYPES = new Set([
  "bar",
  "stackedBar",
  "proportionalBar",
  // Flourish parity batch 7: grouped horizontal bars.
  "groupedBar",
]);
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

// ---------------------------------------------------------------------------
// Flourish parity batch 1: bar-family extensions.
//
// Each builder serves one new template id and follows the same conventions as
// buildBarOption: shared axis primitives, colorFor palette mapping, config-
// driven labels (showLabels must always flow through — the behavior suite
// toggles it for every template), and compact-thumbnail awareness.
// ---------------------------------------------------------------------------

/** Minimal surface of the custom-series renderItem API used below. */
type CustomApi2 = {
  value: (dim: number) => number;
  coord: (point: [number, number]) => number[];
};
type CustomParams2 = { dataIndex: number };

/** Local tick formatter for bin edges: up to 2 decimals, no forced grouping. */
function formatBinEdge(value: number) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

type HistogramBins = { labels: string[]; counts: number[]; centers: number[]; width: number };

/** Equal-width binning with Sturges' rule clamped to 5–15 bins. */
function computeHistogramBins(values: number[]): HistogramBins {
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 1;
  const binCount =
    min === max
      ? 1
      : Math.min(15, Math.max(5, Math.ceil(1 + Math.log2(Math.max(finite.length, 2)))));
  const width = min === max ? 1 : (max - min) / binCount;
  const counts = new Array<number>(binCount).fill(0);
  for (const value of finite) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width));
    counts[index] += 1;
  }
  const labels = counts.map((_, index) => {
    const low = min + index * width;
    const high = index === binCount - 1 ? max : min + (index + 1) * width;
    return `${formatBinEdge(low)}–${formatBinEdge(high)}`;
  });
  const centers = counts.map((_, index) => min + (index + 0.5) * width);
  return { labels, counts, centers, width };
}

/** Silverman kernel-density scaled to bin counts so it overlays the bars. */
function densityCurve(values: number[], bins: HistogramBins) {
  const finite = values.filter(Number.isFinite);
  const n = finite.length;
  if (n < 2 || bins.width <= 0) return bins.centers.map(() => 0);
  const mean = finite.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    finite.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (n - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return bins.centers.map(() => 0);
  const h = 0.9 * std * Math.pow(n, -0.2);
  return bins.centers.map((center) => {
    let density = 0;
    for (const value of finite) {
      const u = (value - center) / h;
      density += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
    }
    density /= n * h;
    return density * n * bins.width;
  });
}

/** Sort helper shared by the ranking-style builders: descending by the first
 *  series unless the user already chose an explicit category sort. */
function rankOrdered(ctx: RenderContext) {
  const { categories, dataSeries } = ctx;
  if (ctx.config.sortCategories?.bySeries || !dataSeries.length) {
    return { categories, dataSeries };
  }
  const dir = -1;
  const values = dataSeries[0].data;
  const indices = values.map((_, i) => i);
  indices.sort((a, b) => {
    const va = Number.isFinite(values[a]) ? values[a] : 0;
    const vb = Number.isFinite(values[b]) ? values[b] : 0;
    return (va - vb) * dir;
  });
  return {
    categories: indices.map((i) => categories[i]),
    dataSeries: dataSeries.map((s) => ({ name: s.name, data: indices.map((i) => s.data[i]) })),
  };
}

/** 直方图: bins a single numeric column into equal-width interval bars. */
export function buildHistogramOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const values = dataSeries[0]?.data ?? [];
  const bins = computeHistogramBins(values);

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = {
    ...buildCategoryAxis(ctx, theme.text, fontSize, compact),
    data: bins.labels,
  };
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "频数",
      type: "bar",
      data: bins.counts,
      barCategoryGap: 0,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: {
        color: colorFor(0, config, dataSeries[0]?.name),
        opacity: markOpacity,
        borderRadius: [barRadius, barRadius, 0, 0],
      },
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
    },
  ];
  return { series, xAxis: categoryAxis, yAxis: valueAxis };
}

/** 密度直方图: histogram bars + a kernel-density curve scaled to counts. */
export function buildDensityHistogramOption(ctx: RenderContext): RendererResult {
  const result = buildHistogramOption(ctx);
  const { config, dataSeries } = ctx;
  const { compact = false } = config;
  const lineWidth = config.lineWidth ?? 3;
  const values = dataSeries[0]?.data ?? [];
  const bins = computeHistogramBins(values);
  const curve = densityCurve(values, bins);
  const color = colorFor(1, config);
  result.series = [
    ...result.series,
    {
      name: "密度曲线",
      type: "line",
      data: curve,
      smooth: true,
      symbol: "none",
      silent: true,
      z: 3,
      itemStyle: { color },
      lineStyle: { color, width: compact ? 1.5 : lineWidth },
      label: { show: false },
      emphasis: { focus: "none" },
    } as SeriesOption,
  ];
  return result;
}

/** 区间条形图 / 区间柱状图: lower+upper columns drawn as a floating range bar
 *  via a transparent stacked base. */
export function buildRangeOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const { type } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const isHorizontal = type === "rangeBar";
  const lower = dataSeries[0] ?? { name: "下限", data: [] };
  const upper = dataSeries[1] ?? { name: "上限", data: [] };
  const color = colorFor(0, config);

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const xAxis = isHorizontal ? valueAxis : categoryAxis;
  const yAxis = isHorizontal ? categoryAxis : valueAxis;
  const visibleRadius: [number, number, number, number] = isHorizontal
    ? [0, barRadius, barRadius, 0]
    : [barRadius, barRadius, 0, 0];

  const series: SeriesOption[] = [
    {
      name: lower.name,
      type: "bar",
      data: lower.data,
      stack: "range",
      silent: true,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color: "transparent" },
      label: { show: false },
      emphasis: { focus: "none" },
    },
    {
      name: upper.name,
      type: "bar",
      data: upper.data,
      stack: "range",
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color, opacity: (config.markOpacity ?? 100) / 100, borderRadius: visibleRadius },
      label: {
        show: compact ? false : config.showLabels,
        position: isHorizontal ? "right" : "top",
        ...dataLabelTextStyle(config),
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

/** 子弹图: a wide actual bar with a narrow target strip overlaid on it. */
export function buildBulletOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const actual = dataSeries[0] ?? { name: "实际值", data: [] };
  const target = dataSeries[1] ?? { name: "目标值", data: [] };

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: actual.name,
      type: "bar",
      data: actual.data,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color: colorFor(0, config, actual.name), opacity: markOpacity, borderRadius: [0, barRadius, barRadius, 0] },
      label: {
        show: compact ? false : config.showLabels,
        position: "right",
        ...dataLabelTextStyle(config),
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return ctx.formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    },
    {
      name: target.name,
      type: "bar",
      data: target.data,
      barGap: "-100%",
      barMaxWidth: compact ? 8 : Math.max(4, Math.round(barWidth * 0.22)),
      z: 3,
      itemStyle: { color: colorFor(1, config, target.name), opacity: markOpacity, borderRadius: [2, 2, 2, 2] },
      label: { show: false },
      emphasis: { focus: "series" },
    },
  ];
  return { series, xAxis: valueAxis, yAxis: categoryAxis };
}

/** 滑珠图: thin stems with a bead at each value; one stem+bead pair per series. */
export function buildLollipopOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const stemWidth = Math.min(12, Math.max(2, Math.round(barWidth * 0.18)));

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const labelTextStyle = dataLabelTextStyle(config);
  const series: SeriesOption[] = [];
  dataSeries.forEach((item, index) => {
    const color = colorFor(index, config, item.name);
    series.push({
      name: item.name,
      type: "bar",
      data: item.data,
      barMaxWidth: stemWidth,
      itemStyle: { color, opacity: markOpacity, borderRadius: [0, stemWidth / 2, stemWidth / 2, 0] },
      label: { show: false },
      emphasis: { focus: "series" },
    } as SeriesOption);
    series.push({
      name: item.name,
      type: "scatter",
      data: item.data.map((value, rowIndex) => [value, rowIndex]),
      symbolSize: compact ? 0 : pointSize + 3,
      itemStyle: { color, opacity: Math.min(1, markOpacity + 0.1) },
      label: {
        show: compact ? false : config.showLabels,
        position: "right",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number] };
          return ctx.formatNumber(entry.value?.[0] ?? 0);
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption);
  });
  return { series, xAxis: valueAxis, yAxis: { ...categoryAxis, data: categories } };
}

/** 象形柱状图: repeated unit glyphs clipped to each value. */
export function buildPictorialOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const item = dataSeries[0] ?? { name: "数值", data: [] };
  const color = colorFor(0, config, item.name);

  // Unit sizing: a fixed pictorialUnitValue gives exact "one glyph = N units"
  // semantics; the adaptive default keeps each column's glyph count ≈ value/max.
  const values = item.data.filter(Number.isFinite);
  const maxValue = values.length ? Math.max(...values.map(Math.abs)) : 1;
  const adaptiveUnit = maxValue / 10;
  const unitValue =
    config.pictorialUnitValue !== undefined && config.pictorialUnitValue > 0
      ? config.pictorialUnitValue
      : adaptiveUnit;
  const unitPixelHeight = Math.round(unitValue * 10) / 10;

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: item.name,
      type: "pictorialBar",
      data: item.data,
      symbol: "rect",
      symbolRepeat: true,
      symbolClip: true,
      // Glyph height derives from the unit value so the on-screen density
      // stays proportional between adaptive and explicit configurations.
      symbolSize: [
        Math.max(10, Math.round(barWidth * 0.6)),
        Math.max(4, Math.min(40, Math.round((unitValue / maxValue) * 220))),
      ],
      symbolMargin: 2,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color, opacity: markOpacity },
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
    },
  ];
  return { series, xAxis: { ...categoryAxis, data: categories }, yAxis: valueAxis };
}

/** 进度条形图: horizontal progress bars against a full track background. */
export function buildProgressOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const ordered = rankOrdered(ctx);
  const values = ordered.dataSeries[0]?.data ?? [];
  const withinHundred = values.every((v) => !Number.isFinite(v) || v <= 100);

  const valueAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    max: withinHundred ? 100 : undefined,
  };
  const categoryAxis = { ...buildCategoryAxis(ctx, theme.text, fontSize, compact), data: ordered.categories };
  const series: SeriesOption[] = [
    {
      name: ordered.dataSeries[0]?.name ?? "进度",
      type: "bar",
      data: values,
      barMaxWidth: compact ? 20 : barWidth,
      showBackground: !compact,
      backgroundStyle: { color: theme.grid, borderRadius: [0, barRadius, barRadius, 0] },
      itemStyle: { color: colorFor(0, config), opacity: markOpacity, borderRadius: [0, barRadius, barRadius, 0] },
      label: {
        show: compact ? false : config.showLabels,
        position: "right",
        ...dataLabelTextStyle(config),
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return ctx.formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    },
  ];
  return { series, xAxis: valueAxis, yAxis: categoryAxis };
}

/** 排名条形图: descending bars whose end labels carry the 1. 2. 3. rank. */
export function buildRankingOption(ctx: RenderContext): RendererResult {
  const result = buildProgressOption(ctx);
  const formatNumber = ctx.formatNumber;
  const [barSeries] = result.series as Array<Record<string, unknown>>;
  const label = barSeries.label as { formatter?: (params: unknown) => string };
  label.formatter = (params: unknown) => {
    const entry = params as { dataIndex: number; value: string | number };
    return `${entry.dataIndex + 1}. ${formatNumber(entry.value)}`;
  };
  return result;
}

// ---------------------------------------------------------------------------
// Flourish parity batch 7: bar/column variants.
// ---------------------------------------------------------------------------

/** 胶囊条形图: horizontal bars whose ends are fully rounded. */
export function buildCapsuleOption(ctx: RenderContext): RendererResult {
  const result = buildProgressOption(ctx);
  // Same descending-with-track layout, but every corner rounded to half the
  // bar thickness so each bar reads as a capsule.
  const { config } = ctx;
  const barWidth = config.barWidth ?? 48;
  const half = Math.max(2, Math.round(barWidth / 2));
  const [barSeries] = result.series as Array<Record<string, unknown>>;
  barSeries.itemStyle = {
    ...(barSeries.itemStyle as Record<string, unknown>),
    borderRadius: [half, half, half, half],
  };
  const background = barSeries.backgroundStyle as Record<string, unknown> | undefined;
  if (background) background.borderRadius = [half, half, half, half];
  return result;
}

/** 箭头条形图: bars tipped with an arrow marker at each value end. */
export function buildArrowOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const pointSize = config.pointSize ?? 7;
  const item = dataSeries[0] ?? { name: "数值", data: [] };
  const color = colorFor(0, config, item.name);
  const labelTextStyle = dataLabelTextStyle(config);

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: item.name,
      type: "bar",
      data: item.data,
      barMaxWidth: compact ? 20 : Math.max(6, Math.round(barWidth * 0.45)),
      itemStyle: { color, opacity: markOpacity, borderRadius: [0, barRadius, barRadius, 0] },
      label: {
        show: compact ? false : config.showLabels,
        position: "right",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return ctx.formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    },
    {
      name: "箭头",
      type: "scatter",
      symbol: "arrow",
      symbolRotate: 90,
      symbolSize: compact ? 0 : Math.max(10, pointSize * 1.8),
      itemStyle: { color },
      data: item.data.map((value, rowIndex) => [value, rowIndex]),
      label: { show: false },
      tooltip: { show: false },
      emphasis: { focus: "none" },
    } as SeriesOption,
  ];
  return { series, xAxis: valueAxis, yAxis: categoryAxis };
}

/** 哑铃图: a connector line from start to end with a bead at each end. */
export function buildDumbbellOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const start = dataSeries[0] ?? { name: "起点", data: [] };
  const end = dataSeries[1] ?? { name: "终点", data: [] };
  const startColor = colorFor(0, config, start.name);
  const endColor = colorFor(1, config, end.name);
  const labelTextStyle = dataLabelTextStyle(config);

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: "连接线",
      type: "custom",
      silent: true,
      z: 1,
      data: start.data.map((value, index) => [index, value, end.data[index] ?? value]),
      renderItem: ((params: CustomParams2, api: CustomApi2) => {
        const index = api.value(0);
        const left = api.coord([Math.min(api.value(1), api.value(2)), index]);
        const right = api.coord([Math.max(api.value(1), api.value(2)), index]);
        return {
          type: "line",
          shape: { x1: left[0], y1: left[1], x2: right[0], y2: right[1] },
          style: { stroke: theme.grid, lineWidth: compact ? 2 : 4 },
        };
      }) as unknown as undefined,
      label: { show: false },
      tooltip: { show: false },
      emphasis: { focus: "none" },
    } as unknown as SeriesOption,
    {
      name: start.name,
      type: "scatter",
      symbolSize: compact ? 6 : pointSize + 4,
      itemStyle: { color: startColor, opacity: markOpacity },
      data: start.data.map((value, index) => [value, index]),
      label: {
        show: compact ? false : config.showLabels,
        position: "left",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number] };
          return ctx.formatNumber(entry.value?.[0] ?? 0);
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption,
    {
      name: end.name,
      type: "scatter",
      symbolSize: compact ? 6 : pointSize + 4,
      itemStyle: { color: endColor, opacity: markOpacity },
      data: end.data.map((value, index) => [value, index]),
      label: {
        show: compact ? false : config.showLabels,
        position: "right",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number] };
          return ctx.formatNumber(entry.value?.[0] ?? 0);
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption,
  ];
  return { series, xAxis: valueAxis, yAxis: categoryAxis };
}

/** 堆叠点图: each point is one unit, stacked per category (isotype dots). */
export function buildStackedDotOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const pointSize = config.pointSize ?? 7;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const values = dataSeries[0]?.data ?? [];
  const MAX_UNITS = 40;
  const labelTextStyle = dataLabelTextStyle(config);

  const data: [number, number][] = [];
  values.forEach((value, rowIndex) => {
    const units = Math.min(MAX_UNITS, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
    for (let unit = 1; unit <= units; unit += 1) {
      data.push([rowIndex, unit]);
    }
  });

  const valueAxis = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    max: Math.max(1, ...values.map((v) => Math.min(MAX_UNITS, Math.round(Number.isFinite(v) ? v : 0)))) + 1,
    min: 0,
    interval: 1,
    axisLabel: { show: false },
    splitLine: { show: false },
  };
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "计数",
      type: "scatter",
      data,
      symbol: "circle",
      symbolSize: compact ? 3 : Math.max(5, pointSize),
      itemStyle: { color: colorFor(0, config), opacity: markOpacity },
      label: {
        show: compact ? false : config.showLabels,
        position: "top",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number] };
          return entry.value[1] === 1 ? `${entry.value[0] + 1}` : "";
        },
      },
      emphasis: { focus: "self" },
    } as SeriesOption,
  ];
  return { series, xAxis: categoryAxis, yAxis: valueAxis };
}

/** 甘特图: horizontal bars floating between start and end columns. */
export function buildGanttOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const start = dataSeries[0] ?? { name: "开始", data: [] };
  const end = dataSeries[1] ?? { name: "结束", data: [] };
  const durations = end.data.map((value, index) =>
    Math.max(0, (Number.isFinite(value) ? value : 0) - (Number.isFinite(start.data[index]) ? start.data[index] : 0)),
  );
  const labelTextStyle = dataLabelTextStyle(config);

  const valueAxis = buildValueAxis(ctx, theme.text, fontSize, compact);
  const categoryAxis = buildCategoryAxis(ctx, theme.text, fontSize, compact);
  const series: SeriesOption[] = [
    {
      name: start.name,
      type: "bar",
      data: start.data,
      stack: "gantt",
      silent: true,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color: "transparent" },
      label: { show: false },
      tooltip: { show: false },
      emphasis: { focus: "none" },
    },
    {
      name: end.name,
      type: "bar",
      data: durations,
      stack: "gantt",
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color: colorFor(0, config), opacity: (config.markOpacity ?? 100) / 100, borderRadius: [0, barRadius, barRadius, 0] },
      label: {
        show: compact ? false : config.showLabels,
        position: "right",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { dataIndex: number };
          return `${ctx.formatNumber(start.data[entry.dataIndex] ?? 0)} – ${ctx.formatNumber(end.data[entry.dataIndex] ?? 0)}`;
        },
      },
      emphasis: { focus: "series" },
    },
  ];
  return { series, xAxis: valueAxis, yAxis: categoryAxis };
}

/** 断轴条形图: split-grid bars with a broken-axis gap for outliers. */
export function buildSplitAxisOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const barRadius = config.barRadius ?? 3;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const values = dataSeries[0]?.data ?? [];
  const finite = values.filter(Number.isFinite);
  const sorted = [...finite].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const threshold = Math.max(median * 2.5, 1);

  // Split: outliers into the top (zoomed) grid, the rest into the bottom grid.
  const topData = values.map((value) => (Number.isFinite(value) && value > threshold ? value : null));
  const bottomData = values.map((value) => (Number.isFinite(value) && value > threshold ? null : value));
  const bottomMax = Math.max(threshold, ...bottomData.filter((v): v is number => v !== null && Number.isFinite(v)));

  const categoryAxisBottom = {
    ...buildCategoryAxis(ctx, theme.text, fontSize, compact),
    position: "bottom" as const,
  };
  const categoryAxisTop = {
    ...buildCategoryAxis(ctx, theme.text, fontSize, compact),
    show: false,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    position: "top" as const,
  };
  const valueAxisBottom = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    max: bottomMax,
    splitLine: { show: !compact && config.showGrid, lineStyle: { color: theme.grid, type: (config.gridLineType ?? "dashed") as "solid" | "dashed" | "dotted" } },
  };
  const valueAxisTop = {
    ...buildValueAxis(ctx, theme.text, fontSize, compact),
    min: bottomMax * 0.98,
    splitLine: { show: false },
  };

  const series: SeriesOption[] = [
    {
      name: dataSeries[0]?.name ?? "数值",
      type: "bar",
      data: bottomData,
      xAxisIndex: 0,
      yAxisIndex: 0,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color: colorFor(0, config), opacity: markOpacity, borderRadius: [barRadius, barRadius, 0, 0] },
      label: { show: compact ? false : config.showLabels, position: "top", ...dataLabelTextStyle(config), formatter: (p: unknown) => {
        const entry = p as { value: number | string };
        return entry.value === null ? "" : ctx.formatNumber(entry.value);
      } },
      emphasis: { focus: "series" },
    },
    {
      name: dataSeries[0]?.name ?? "数值",
      type: "bar",
      data: topData,
      xAxisIndex: 1,
      yAxisIndex: 1,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: { color: colorFor(1, config), opacity: markOpacity, borderRadius: [barRadius, barRadius, 0, 0] },
      label: { show: compact ? false : config.showLabels, position: "top", ...dataLabelTextStyle(config), formatter: (p: unknown) => {
        const entry = p as { value: number | string };
        return entry.value === null ? "" : ctx.formatNumber(entry.value);
      } },
      emphasis: { focus: "series" },
    },
  ];
  const grid: RendererResult["grid"] = compact
    ? [{ top: 6, left: 6, right: 6, bottom: 6, containLabel: false }]
    : [
        { top: config.margins.top + 74, left: config.margins.left, right: config.margins.right, height: "32%", containLabel: true },
        { left: config.margins.left, right: config.margins.right, bottom: config.margins.bottom + 26, height: "34%", containLabel: true },
      ];
  return {
    series,
    grid,
    xAxis: [categoryAxisTop, categoryAxisBottom],
    yAxis: [valueAxisTop, valueAxisBottom],
  };
}
