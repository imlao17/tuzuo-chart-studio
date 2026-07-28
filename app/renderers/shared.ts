/**
 * Shared rendering utilities for template-family renderers.
 *
 * This module is the single place where the post-renderer "assembler" lives:
 * given a renderer's output (series + axes) and the original ChartConfig, it
 * produces the full EChartsOption by reusing exactly the same title/legend/
 * tooltip/grid/textStyle logic that the legacy buildChartOption returned.
 *
 * Keeping this assembly centralized means each per-family renderer only needs
 * to compute its series and axes — the rest is shared, which is what makes
 * the refactor behavior-preserving.
 */
import type { EChartsOption, SeriesOption } from "echarts";
import {
  ChartConfig,
  columnIndex,
  colorFor,
  normalizeSeries,
  numberFormatter,
  numericBound,
  paletteFor,
  toNumber,
} from "../chart-model";
import {
  Capabilities,
  RenderContext,
  TemplateDefinition,
} from "../template-definition";

/**
 * What a family renderer returns. Axes are optional because non-cartesian
 * families (pie/donut) clear them. singleAxis is for streamgraph-style charts.
 */
export type RendererResult = {
  series: SeriesOption[];
  xAxis?: EChartsOption["xAxis"];
  yAxis?: EChartsOption["yAxis"];
  singleAxis?: EChartsOption["singleAxis"];
};

/**
 * Build the RenderContext that every family renderer receives. This is the
 * shared "precompute step" that the legacy buildChartOption did inline
 * (resolve category + data series + proportional flag + number formatter).
 *
 * Behavior is identical to legacy lines 369-389.
 */
export function buildRenderContext(config: ChartConfig): RenderContext {
  const { type, parsed, categoryColumn } = config;
  const categoryIndex = columnIndex(parsed.headers, categoryColumn);
  const categories = parsed.rows.map((row) => row[categoryIndex]);

  const validSeriesColumns = config.seriesColumns.filter((header) =>
    parsed.numericHeaders.includes(header),
  );
  const selectedColumns = validSeriesColumns.length
    ? validSeriesColumns
    : parsed.numericHeaders.slice(0, 1);
  let dataSeries = selectedColumns.map((name) => {
    const index = columnIndex(parsed.headers, name);
    return {
      name,
      data: parsed.rows.map((row) => toNumber(row[index])),
    };
  });

  const proportional =
    type === "proportionalArea" ||
    type === "proportionalBar" ||
    type === "proportionalColumn";
  if (proportional) dataSeries = normalizeSeries(dataSeries);

  // Optional category sort: reorder categories and every series' data array by
  // the values of a chosen series. The permutation is computed once and
  // applied consistently so categories and data stay aligned. No-op when the
  // sort config is absent or the referenced series is not present.
  const sortSpec = config.sortCategories;
  let sortedCategories = categories;
  let sortedDataSeries = dataSeries;
  if (sortSpec?.bySeries) {
    const bySeries = dataSeries.find((s) => s.name === sortSpec.bySeries);
    if (bySeries) {
      const indices = bySeries.data.map((_, i) => i);
      const dir = sortSpec.order === "desc" ? -1 : 1;
      indices.sort((a, b) => {
        const va = Number.isFinite(bySeries.data[a]) ? bySeries.data[a] : 0;
        const vb = Number.isFinite(bySeries.data[b]) ? bySeries.data[b] : 0;
        return (va - vb) * dir;
      });
      sortedCategories = indices.map((i) => categories[i]);
      sortedDataSeries = dataSeries.map((s) => ({
        name: s.name,
        data: indices.map((i) => s.data[i]),
      }));
    }
  }

  const formatNumber = numberFormatter(config, proportional);

  return {
    config,
    categories: sortedCategories,
    dataSeries: sortedDataSeries,
    proportional,
    formatNumber,
  };
}

/**
 * Apply the shared "axis patching" that the legacy buildChartOption did after
 * the branch dispatch (legacy lines 698-717): merge show/name/nameLocation/
 * nameGap/nameTextStyle into each non-array axis.
 *
 * This must run on the renderer's axis output before final assembly so that
 * renderer-produced axes behave identically to legacy-produced axes.
 */
function patchAxes(
  result: RendererResult,
  config: ChartConfig,
  textColor: string,
  fontSize: number,
  compact: boolean,
): RendererResult {
  const showXAxis = config.showXAxis ?? true;
  const showYAxis = config.showYAxis ?? true;
  let xAxis = result.xAxis;
  let yAxis = result.yAxis;

  if (xAxis && !Array.isArray(xAxis)) {
    xAxis = {
      ...xAxis,
      show: compact ? false : showXAxis,
      name: compact ? "" : config.xAxisTitle ?? "",
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: { color: textColor, fontSize },
    };
  }
  // yAxis may be a single axis or an array (combo dual-axis). Patch each:
  // the primary (index 0) uses yAxisTitle, the secondary (index 1) uses
  // y2AxisTitle. The non-array path is unchanged.
  const patchYAxis = (
    axis: NonNullable<typeof yAxis>,
    title: string | undefined,
  ) => ({
    ...axis,
    show: compact ? false : showYAxis,
    name: compact ? "" : title ?? "",
    nameLocation: "middle" as const,
    nameGap: 48,
    nameTextStyle: { color: textColor, fontSize },
  });
  if (Array.isArray(yAxis)) {
    yAxis = yAxis.map((axis, index) =>
      patchYAxis(axis, index === 0 ? config.yAxisTitle : config.y2AxisTitle),
    );
  } else if (yAxis) {
    yAxis = patchYAxis(yAxis, config.yAxisTitle);
  }
  return { ...result, xAxis, yAxis };
}

/**
 * Assemble the final EChartsOption from a renderer's output.
 *
 * This is a faithful port of legacy buildChartOption lines 402-406 (grid math),
 * 698-717 (axis patch), and 719-809 (final return), so that any renderer using
 * this assembler produces output structurally identical to the legacy path.
 *
 * The only difference from legacy is how "should grid/legend-trigger/tooltip-
 * trigger be cartesian" is decided: legacy keyed on `config.type` string
 * literals ("pie" | "donut" | "streamgraph"); we key on `def.capabilities.axes`
 * and `result.singleAxis`, which is the same set in the renderer path (only
 * pie/donut have capabilities.axes === false today; only streamgraph-style
 * returns singleAxis, but streamgraph still runs legacy in this task).
 */
function assembleOption(
  result: RendererResult,
  config: ChartConfig,
  capabilities: Capabilities,
  dataSeriesCount: number,
): EChartsOption {
  const {
    title,
    subtitle,
    margins,
    theme,
    backgroundColor,
    transparent,
    showLegend,
    fontSize,
    compact = false,
  } = config;

  const legendPosition = config.legendPosition ?? "top";
  const showTooltip = config.showTooltip ?? true;

  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const gridTop = compact ? 6 : margins.top + titleBlock;
  const gridBottom = compact ? 6 : margins.bottom;
  const gridLeft = compact ? 6 : margins.left;
  const gridRight = compact ? 6 : margins.right;
  const textColor = theme.text;

  const patched = patchAxes(result, config, textColor, fontSize, compact);

  // Legacy returned grid: undefined for pie/donut/streamgraph; otherwise the
  // grid box. In the renderer path, pie/donut are exactly the templates with
  // capabilities.axes === false, and singleAxis (streamgraph-family) is only
  // returned by templates that still run legacy today. Mirror the legacy
  // condition accordingly.
  const hasSingleAxis = Boolean(patched.singleAxis);
  const grid =
    !capabilities.axes || hasSingleAxis
      ? undefined
      : {
          top: gridTop,
          right: gridRight,
          bottom: gridBottom,
          left: gridLeft,
          containLabel: !compact,
        };

  // Legacy decided legend visibility with `dataSeries.length > 1 || pie || donut`,
  // where `dataSeries` was the PRE-slice series list. The bar renderer may
  // slice its visible series (e.g. `column` keeps only the first), so we must
  // pass the pre-slice count from the context, not derive it from the rendered
  // series length, or `column` would wrongly hide the legend.
  const isPieFamily = !capabilities.axes;

  return {
    animation: !compact,
    animationDuration: 480,
    animationEasing: "cubicOut",
    backgroundColor: transparent ? "transparent" : backgroundColor,
    color: paletteFor(config),
    textStyle: {
      fontFamily:
        '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      color: textColor,
    },
    title: {
      show: compact ? false : Boolean(title || subtitle),
      left:
        config.titleAlign === "center"
          ? "center"
          : config.titleAlign === "right"
            ? undefined
            : margins.left,
      right: config.titleAlign === "right" ? margins.right : undefined,
      top: margins.top,
      text: title,
      subtext: subtitle,
      itemGap: 7,
      textStyle: {
        color: textColor,
        fontSize: Math.max(22, fontSize + 10),
        fontWeight: 700,
      },
      subtextStyle: {
        color: "#68727d",
        fontSize: Math.max(12, fontSize - 1),
      },
    },
    legend: {
      show:
        !compact && showLegend && (dataSeriesCount > 1 || isPieFamily),
      top:
        legendPosition === "top"
          ? margins.top + 3
          : legendPosition === "left" || legendPosition === "right"
            ? "middle"
            : undefined,
      bottom: legendPosition === "bottom" ? margins.bottom : undefined,
      left:
        legendPosition === "left"
          ? margins.left
          : legendPosition === "bottom"
            ? "center"
            : undefined,
      right:
        legendPosition === "right" || legendPosition === "top"
          ? margins.right
          : undefined,
      orient:
        legendPosition === "left" || legendPosition === "right"
          ? "vertical"
          : "horizontal",
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: textColor, fontSize },
    },
    tooltip:
      compact || !showTooltip
        ? { show: false }
        : {
            trigger: isPieFamily ? "item" : "axis",
            backgroundColor: "rgba(24, 28, 33, 0.94)",
            borderWidth: 0,
            textStyle: { color: "#ffffff", fontSize },
            padding: [10, 12],
          },
    grid,
    singleAxis: patched.singleAxis,
    xAxis: patched.xAxis,
    yAxis: patched.yAxis,
    series: patched.series,
  };
}

/**
 * Entry point used by the new buildChartOption dispatcher: build the context,
 * call the family renderer, then assemble the full option. Used only for
 * templates whose TemplateDefinition.buildOption is defined.
 */
export function buildWithRenderer(
  config: ChartConfig,
  def: TemplateDefinition,
): EChartsOption {
  if (!def.buildOption) {
    // Defensive: dispatcher should have checked, but never silently fall
    // through to a wrong path.
    throw new Error(`Template ${def.id} has no renderer`);
  }
  const ctx = buildRenderContext(config);
  const result = def.buildOption(ctx);
  return assembleOption(result, config, def.capabilities, ctx.dataSeries.length);
}

// Re-export the helpers that family renderers need, so they import everything
// renderer-related from this one module. The underlying definitions stay in
// chart-model.ts (which also keeps the test-pinned `numberFormatter` token in
// its original file).
export { colorFor, numericBound };

// --- Axis primitives --------------------------------------------------------
// Faithful ports of legacy buildChartOption lines 407-450 (splitLine, axisLabel,
// valueAxis, categoryAxis). Family renderers call these so their axes are
// byte-identical to what legacy produced for the same template.

type AxisLabelSpec = {
  show: boolean;
  color: string;
  fontSize: number;
  hideOverlap: boolean;
  formatter?: (value: number | string) => string;
};

function buildAxisLabel(
  ctx: RenderContext,
  textColor: string,
  fontSize: number,
  compact: boolean,
): AxisLabelSpec {
  const { formatNumber } = ctx;
  return {
    show: !compact,
    color: textColor,
    fontSize,
    hideOverlap: true,
    formatter: compact ? undefined : formatNumber,
  };
}

function buildSplitLine(
  config: ChartConfig,
  compact: boolean,
) {
  const showGrid = config.showGrid;
  const gridLineType = config.gridLineType ?? "dashed";
  return {
    show: compact ? false : showGrid,
    lineStyle: { color: config.theme.grid, type: gridLineType },
  };
}

export function buildValueAxis(
  ctx: RenderContext,
  textColor: string,
  fontSize: number,
  compact: boolean,
) {
  const { config, proportional } = ctx;
  const axisLabel = buildAxisLabel(ctx, textColor, fontSize, compact);
  const splitLine = buildSplitLine(config, compact);
  return {
    type: "value" as const,
    show: !compact,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel,
    splitLine,
    max: proportional ? 100 : numericBound(config.yAxisMax),
    min: proportional ? 0 : numericBound(config.yAxisMin),
    name: compact ? "" : config.yAxisTitle ?? "",
    nameLocation: "middle" as const,
    nameGap: 45,
    nameTextStyle: { color: textColor, fontSize },
  };
}

export function buildCategoryAxis(
  ctx: RenderContext,
  textColor: string,
  fontSize: number,
  compact: boolean,
) {
  const { config, categories } = ctx;
  const axisLabel = buildAxisLabel(ctx, textColor, fontSize, compact);
  return {
    type: "category" as const,
    show: !compact,
    data: categories,
    axisLine: {
      show: !compact,
      lineStyle: { color: "#aeb6bf" },
    },
    axisTick: { show: false },
    axisLabel: {
      ...axisLabel,
      rotate: compact ? 0 : config.axisLabelRotation ?? 0,
    },
    name: compact ? "" : config.xAxisTitle ?? "",
    nameLocation: "middle" as const,
    nameGap: 30,
    nameTextStyle: { color: textColor, fontSize },
  };
}

