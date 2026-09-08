/**
 * Hierarchy family renderer (Flourish parity batch 5).
 *
 * Covers: sunburst, dendrogram (LR tree), orgChart (TB tree), radialTree.
 *
 * All four derive the same two-level hierarchy from the table: categories are
 * the parents and each selected numeric column becomes a child carrying its
 * value. capabilities.axes === false keeps the cartesian grid out.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import {
  colorFor,
  dataLabelTextStyle,
  inShapeLabelTextStyle,
  type RendererResult,
} from "./shared";

type HierarchyNode = {
  name: string;
  value?: number;
  children?: HierarchyNode[];
  itemStyle?: { color?: string };
};

/** Categories as parents, numeric columns as value-bearing children. */
function buildHierarchy(ctx: RenderContext, rootName = "总览"): HierarchyNode {
  const { categories, dataSeries, config } = ctx;
  return {
    name: rootName,
    children: categories.map((category, rowIndex) => ({
      name: category,
      itemStyle: { color: colorFor(rowIndex, config, category) },
      children: dataSeries.map((series) => ({
        name: series.name,
        value: Number.isFinite(series.data[rowIndex]) ? series.data[rowIndex] : 0,
      })),
    })),
  };
}

/** 旭日图: two-ring sunburst (categories inner, series columns outer). */
export function buildSunburstOption(ctx: RenderContext): RendererResult {
  const { config } = ctx;
  const { compact = false } = config;
  const series: SeriesOption[] = [
    {
      name: "层级",
      type: "sunburst",
      radius: [compact ? "16%" : "12%", compact ? "72%" : "80%"],
      center: ["50%", "54%"],
      data: [buildHierarchy(ctx)],
      label: {
        show: compact ? false : config.showLabels,
        // Arcs use palette colors; the ink must contrast with them.
        ...inShapeLabelTextStyle(config, colorFor(0, config)),
        rotate: "radial" as const,
        minAngle: 8,
      },
      itemStyle: { borderRadius: compact ? 2 : 4, borderWidth: 1 },
      emphasis: { focus: "ancestor" },
    },
  ];
  return { series, tooltipTrigger: "item" };
}

/** Tree shared builder: one root, categories mid-level, series leaves. */
function buildTreeOption(
  ctx: RenderContext,
  opts: { orient: "LR" | "TB"; radial?: boolean },
): RendererResult {
  const { config } = ctx;
  const { compact = false, theme, fontSize } = config;
  const pointSize = config.pointSize ?? 7;
  const labelTextStyle = dataLabelTextStyle(config);
  const series: SeriesOption[] = [
    {
      name: "层级",
      type: "tree",
      data: [buildHierarchy(ctx)],
      layout: opts.radial ? "radial" : undefined,
      orient: opts.radial ? undefined : opts.orient,
      top: compact ? "4%" : "8%",
      left: compact ? "6%" : opts.radial ? "10%" : "12%",
      right: compact ? "6%" : "16%",
      bottom: compact ? "4%" : "8%",
      symbol: "circle",
      symbolSize: compact ? 5 : Math.max(6, pointSize),
      roam: false,
      expandAndCollapse: false,
      initialTreeDepth: 3,
      lineStyle: { color: theme.grid, width: 1.5 },
      label: {
        show: compact ? false : config.showLabels,
        ...labelTextStyle,
        position: opts.radial || opts.orient === "LR" ? ("right" as const) : ("top" as const),
        fontSize: Math.max(9, fontSize - 1),
        formatter: (params: unknown) => {
          const item = params as { name?: string; value?: unknown };
          // Leaves (with a numeric value) also show the value.
          return typeof item.value === "number"
            ? `${item.name} ${ctx.formatNumber(item.value)}`
            : item.name ?? "";
        },
      },
      leaves: {
        label: { show: compact ? false : config.showLabels },
      },
      emphasis: { focus: "descendant" },
    },
  ];
  return { series, tooltipTrigger: "item" };
}

/** 树状图: left-to-right dendrogram. */
export function buildDendrogramOption(ctx: RenderContext): RendererResult {
  return buildTreeOption(ctx, { orient: "LR" });
}

/** 径向树图: radially laid out tree. */
export function buildRadialTreeOption(ctx: RenderContext): RendererResult {
  return buildTreeOption(ctx, { orient: "LR", radial: true });
}

/** 组织架构图: top-to-bottom tree. */
export function buildOrgChartOption(ctx: RenderContext): RendererResult {
  return buildTreeOption(ctx, { orient: "TB" });
}
