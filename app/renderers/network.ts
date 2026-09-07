/**
 * Network family renderer (Flourish parity batch 5).
 *
 * Covers: networkGraph (force layout), chord, adjacencyMatrix, alluvial.
 *
 * The first three read the sankey-style binding (source, target, value) and
 * build nodes/links from the unique endpoint names. alluvial reuses the
 * sankey renderer directly — the difference is the sample data shape
 * (multi-stage funnels), not the rendering path.
 */
import type { SeriesOption } from "echarts";
import { columnIndex, toNumber } from "../chart-model";
import type { RenderContext } from "../template-definition";
import {
  buildCategoryAxis,
  colorFor,
  dataLabelTextStyle,
  type RendererResult,
} from "./shared";
import { buildValueAxis } from "./shared";
import { buildSankeyOption } from "./advanced";

type Endpoint = { source: string; target: string; value: number };

/** Shared source/target/value resolution, mirroring the sankey renderer. */
function resolveEndpoints(ctx: RenderContext) {
  const { config } = ctx;
  const { parsed } = config;
  const sourceName = config.sourceColumn ?? config.categoryColumn;
  const targetName =
    config.targetColumn ??
    parsed.headers.find(
      (header) => header !== sourceName && !parsed.numericHeaders.includes(header),
    ) ??
    parsed.headers.find((header) => header !== sourceName) ??
    sourceName;
  const valueName =
    config.seriesColumns.find((header) => parsed.numericHeaders.includes(header)) ??
    parsed.numericHeaders[0] ??
    "";
  const sourceIndex = columnIndex(parsed.headers, sourceName);
  const targetIndex = columnIndex(parsed.headers, targetName);
  const valueIndex = columnIndex(parsed.headers, valueName);

  const nodeNames: string[] = [];
  const seen = new Set<string>();
  const endpoints: Endpoint[] = [];
  for (const row of parsed.rows) {
    const source = row[sourceIndex]?.trim();
    const target = row[targetIndex]?.trim();
    const value = toNumber(row[valueIndex] ?? "");
    if (!source || !target || !Number.isFinite(value)) continue;
    for (const name of [source, target]) {
      if (!seen.has(name)) {
        seen.add(name);
        nodeNames.push(name);
      }
    }
    endpoints.push({ source, target, value: Math.max(0, value) });
  }
  return { nodeNames, endpoints, valueName };
}

/** Total flow through each node — drives network node sizing. */
function nodeWeights(endpoints: Endpoint[]) {
  const weights: Record<string, number> = {};
  for (const { source, target, value } of endpoints) {
    weights[source] = (weights[source] ?? 0) + value;
    weights[target] = (weights[target] ?? 0) + value;
  }
  return weights;
}

/** 力导向网络图: force-layout graph, node size scaled by total flow. */
export function buildNetworkGraphOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { compact = false, theme } = config;
  const pointSize = config.pointSize ?? 7;
  const labelTextStyle = dataLabelTextStyle(config);
  const { nodeNames, endpoints, valueName } = resolveEndpoints(ctx);
  const weights = nodeWeights(endpoints);
  const maxWeight = Math.max(1, ...Object.values(weights));

  const series: SeriesOption[] = [
    {
      name: valueName || "关系",
      type: "graph",
      layout: "force",
      roam: false,
      draggable: false,
      force: {
        repulsion: compact ? 60 : 160,
        edgeLength: compact ? [24, 60] : [50, 120],
        layoutAnimation: false,
      },
      top: "6%",
      left: "8%",
      right: "8%",
      bottom: "6%",
      data: nodeNames.map((name, index) => ({
        name,
        symbolSize: compact ? 8 : Math.max(12, Math.sqrt((weights[name] ?? 1) / maxWeight) * (pointSize * 6)),
        itemStyle: { color: colorFor(index, config, name) },
      })),
      links: endpoints.map(({ source, target, value }) => ({
        source,
        target,
        lineStyle: { width: Math.max(1, (value / maxWeight) * (compact ? 2 : 6)) },
      })),
      label: {
        show: compact ? false : config.showLabels,
        position: "right",
        ...labelTextStyle,
      },
      lineStyle: { color: theme.grid, curveness: 0.1, opacity: 0.8 },
      emphasis: { focus: "adjacency" },
    },
  ];
  return { series, tooltipTrigger: "item" };
}

/** 弦图: circular chord layout over the same node/link data. */
export function buildChordOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { compact = false, theme } = config;
  const labelTextStyle = dataLabelTextStyle(config);
  const { nodeNames, endpoints, valueName } = resolveEndpoints(ctx);
  const weights = nodeWeights(endpoints);
  const maxWeight = Math.max(1, ...Object.values(weights));

  const series: SeriesOption[] = [
    {
      name: valueName || "关系",
      type: "chord",
      data: nodeNames.map((name, index) => ({
        name,
        itemStyle: { color: colorFor(index, config, name) },
      })),
      links: endpoints.map(({ source, target, value }) => ({
        source,
        target,
        value: Math.max(1, value),
      })),
      radius: compact ? ["18%", "66%"] : ["22%", "76%"],
      center: ["50%", "52%"],
      label: {
        show: compact ? false : config.showLabels,
        ...labelTextStyle,
      },
      itemStyle: { borderWidth: 1 },
      lineStyle: { color: theme.grid, opacity: Math.max(0.2, (config.markOpacity ?? 60) / 100) },
      emphasis: { focus: "adjacency" },
    },
  ];
  return { series, tooltipTrigger: "item" };
}

/** 邻接矩阵图: heatmap over the source×target grid of flows. */
export function buildAdjacencyMatrixOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { compact = false, theme, fontSize } = config;
  const { nodeNames, endpoints } = resolveEndpoints(ctx);
  const indexOf: Record<string, number> = {};
  nodeNames.forEach((name, index) => {
    indexOf[name] = index;
  });
  const maxValue = Math.max(1, ...endpoints.map((endpoint) => endpoint.value));
  const labelTextStyle = dataLabelTextStyle(config);

  const categoryAxisStyle = {
    axisLine: { show: !compact, lineStyle: { color: "#aeb6bf" } },
    axisTick: { show: false },
    axisLabel: {
      show: !compact,
      color: theme.text,
      fontSize,
      rotate: 45,
      formatter: undefined as undefined | ((value: string) => string),
    },
    splitLine: { show: false },
  };
  const xAxis = {
    ...buildCategoryAxis(ctx, theme.text, fontSize, compact),
    ...categoryAxisStyle,
    data: nodeNames,
  };
  const yAxis = {
    type: "category" as const,
    ...categoryAxisStyle,
    data: nodeNames,
    axisLabel: { ...categoryAxisStyle.axisLabel, rotate: 0 },
  };

  const series: SeriesOption[] = [
    {
      name: "流量",
      type: "heatmap",
      data: endpoints
        .filter(({ source, target }) => source in indexOf && target in indexOf)
        .map(({ source, target, value }) => [indexOf[target], indexOf[source], value]),
      label: {
        show: compact ? false : config.showLabels,
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: [number, number, number] };
          return ctx.formatNumber(entry.value[2]);
        },
      },
      itemStyle: {
        borderColor: config.transparent ? "rgba(255,255,255,0.6)" : config.backgroundColor,
        borderWidth: 1,
      },
      emphasis: { focus: "self" },
    },
  ];
  return {
    series,
    xAxis,
    yAxis,
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: false,
      show: !compact,
      orient: "horizontal" as const,
      left: "center",
      bottom: 0,
      inRange: {
        color: [config.backgroundColor === "#ffffff" ? "#f0f4fa" : config.backgroundColor, colorFor(0, config)],
      },
      textStyle: { color: theme.text, fontSize },
    },
    tooltipTrigger: "item",
  };
}

/** 冲积图: sankey rendering path with multi-stage sample data semantics. */
export function buildAlluvialOption(ctx: RenderContext): RendererResult {
  return buildSankeyOption(ctx);
}
