/**
 * Radial / polar family renderer (Flourish parity batch 3).
 *
 * Covers: rose, roseArea (pie roseType variants), radialBar,
 * radialStackedBar, polarLine, polarArea (polar-coordinate cartesian
 * hybrids), and progressRing (background + value arc pie).
 *
 * Polar templates declare capabilities.axes === false so the shared
 * assembler omits the cartesian grid; the polar/angleAxis/radiusAxis blocks
 * travel on the RendererResult's dedicated fields.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import {
  themeInk,
  colorFor,
  dataLabelTextStyle,
  inShapeLabelTextStyle,
  LEGEND_HORIZONTAL_SPACE,
  LEGEND_VERTICAL_SPACE,
  type RendererResult,
} from "./shared";

/** Shared polar layout math, mirroring pie.ts's inner-box computation. */
function polarLayout(ctx: RenderContext) {
  const { config } = ctx;
  const {
    title,
    subtitle,
    width,
    height,
    margins,
    compact = false,
  } = config;
  const legendVisible = !compact && config.showLegend;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const legendPosition = config.legendPosition ?? "top";
  const innerTop =
    margins.top +
    titleBlock +
    (legendVisible && legendPosition === "top" ? LEGEND_HORIZONTAL_SPACE : 0);
  const innerBottom =
    margins.bottom +
    (legendVisible && legendPosition === "bottom" ? LEGEND_HORIZONTAL_SPACE : 0);
  const innerLeft =
    margins.left +
    (legendVisible && legendPosition === "left" ? LEGEND_VERTICAL_SPACE : 0);
  const innerRight =
    margins.right +
    (legendVisible && legendPosition === "right" ? LEGEND_VERTICAL_SPACE : 0);
  const innerHeight = Math.max(80, height - innerTop - innerBottom);
  const innerWidth = Math.max(80, width - innerLeft - innerRight);
  const centerX = ((innerLeft + innerWidth / 2) / width) * 100;
  const centerY = ((innerTop + innerHeight / 2) / height) * 100;
  const radiusPx = Math.max(42, Math.min(innerWidth, innerHeight) * 0.42);
  return { centerX, centerY, radiusPx, titleBlock, legendVisible };
}

/** Category-on-angle + value-on-radius polar block shared by the hybrids. */
function buildPolarFrame(ctx: RenderContext, categories: string[]) {
  const { config } = ctx;
  const { theme, fontSize, compact = false } = config;
  const { centerX, centerY } = polarLayout(ctx);
  const labelColor = theme.text;
  return {
    polar: {
      center: [`${centerX}%`, `${centerY}%`],
      radius: compact ? ["12%", "58%"] : ["10%", "72%"],
    },
    angleAxis: {
      type: "category" as const,
      data: categories,
      startAngle: 90,
      axisLine: { show: !compact, lineStyle: { color: "#aeb6bf" } },
      axisTick: { show: false },
      axisLabel: {
        show: !compact,
        color: labelColor,
        fontSize,
      },
      splitLine: {
        show: config.showGrid && !compact,
        lineStyle: { color: config.theme.grid, type: (config.gridLineType ?? "dashed") as "solid" | "dashed" | "dotted" },
      },
    },
    radiusAxis: {
      type: "value" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: !compact, color: labelColor, fontSize },
      splitLine: {
        show: config.showGrid && !compact,
        lineStyle: { color: config.theme.grid, type: (config.gridLineType ?? "dashed") as "solid" | "dashed" | "dotted" },
      },
    },
  };
}

/** 玫瑰图 / 面积玫瑰图: pie with roseType "radius" / "area". */
export function buildRoseOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { backgroundColor, transparent, compact = false, type } = config;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const { radiusPx, centerX, centerY } = polarLayout(ctx);
  const primary = dataSeries[0] ?? { name: "数值", data: [] };
  const entries = categories.map((name, index) => ({
    name,
    value: primary.data[index],
  }));
  const labelTextStyle = dataLabelTextStyle(config);
  const series: SeriesOption[] = [
    {
      name: primary.name,
      type: "pie",
      roseType: type === "roseArea" ? "area" : "radius",
      radius: type === "roseArea" ? [radiusPx * 0.18, radiusPx] : [radiusPx * 0.08, radiusPx],
      center: [`${centerX}%`, `${centerY}%`],
      itemStyle: {
        borderColor: transparent ? "rgba(255,255,255,0.82)" : backgroundColor,
        borderWidth: compact ? 1 : 2,
        borderRadius: compact ? 1 : 3,
        opacity: markOpacity,
      },
      label: {
        show: compact ? false : config.showLabels,
        ...labelTextStyle,
        formatter: "{b}",
      },
      data: entries,
    },
  ];
  return { series };
}

/** 进度环形图: a full background ring plus a value arc, with the percentage
 *  as center text on the graphic layer. */
export function buildProgressRingOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, backgroundColor, transparent, fontSize, width, height, compact = false } = config;
  const { radiusPx, centerX, centerY } = polarLayout(ctx);
  const primary = dataSeries[0] ?? { name: "数值", data: [] };
  const raw = primary.data[0];
  const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const percent = value <= 100 ? value : (value / (Math.max(...primary.data.filter(Number.isFinite), 1))) * 100;

  const ringColor = transparent ? "rgba(150,158,166,0.35)" : theme.grid;
  const labelTextStyle = dataLabelTextStyle(config);
  const series: SeriesOption[] = [
    {
      name: "背景环",
      type: "pie",
      radius: [radiusPx * 0.72, radiusPx],
      center: [`${centerX}%`, `${centerY}%`],
      startAngle: 90,
      silent: true,
      label: { show: false },
      tooltip: { show: false },
      emphasis: { focus: "none" },
      itemStyle: { color: ringColor },
      data: [{ name: "", value: 100 }],
    },
    {
      name: primary.name,
      type: "pie",
      radius: [radiusPx * 0.72, radiusPx],
      center: [`${centerX}%`, `${centerY}%`],
      startAngle: 90,
      silent: false,
      label: {
        show: compact ? false : config.showLabels,
        position: "outside",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { percent?: number };
          return `${entry.percent ?? Math.round(percent)}%`;
        },
      },
      itemStyle: {
        color: colorFor(0, config),
        borderColor: transparent ? "rgba(255,255,255,0.82)" : backgroundColor,
        borderWidth: 1,
        borderRadius: compact ? 2 : 6,
      },
      data: [
        { name: primary.name, value: percent },
        { name: "剩余", value: Math.max(0, 100 - percent), itemStyle: { color: "transparent" } },
      ],
    },
  ];
  const graphic = [
    {
      type: "text",
      x: (centerX / 100) * width,
      y: (centerY / 100) * height,
      style: {
        text: `${Math.round(percent)}%`,
        textAlign: "center",
        textVerticalAlign: "middle",
        fill: themeInk(config),
        font: `${Math.round(fontSize * 2)}px "Inter", "PingFang SC", sans-serif`,
      },
    },
  ] as unknown as RendererResult["graphic"];
  return { series, graphic };
}

/** 径向条形图 / 径向堆叠条形图: polar bars with categories on the angle axis. */
export function buildRadialBarOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false } = config;
  const barWidth = config.barWidth ?? 48;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const stacked = config.type === "radialStackedBar";
  const frame = buildPolarFrame(ctx, categories);
  const series: SeriesOption[] = dataSeries.map((item, index) => ({
    name: item.name,
    type: "bar",
    coordinateSystem: "polar",
    data: item.data,
    stack: stacked ? "total" : undefined,
    barMaxWidth: compact ? 14 : Math.max(10, barWidth * 0.6),
    roundCap: true,
    itemStyle: {
      color: colorFor(index, config, item.name),
      opacity: markOpacity,
    },
    label: {
      show: compact ? false : config.showLabels,
      position: "middle",
      // Middle labels sit ON the colored bar; match the ink to it.
      ...inShapeLabelTextStyle(config, colorFor(index, config, item.name)),
      formatter: (params: unknown) => {
        const entry = params as { value: string | number };
        return ctx.formatNumber(entry.value);
      },
    },
    emphasis: { focus: "series" },
  } as SeriesOption));
  return { series, ...frame };
}

/** 极坐标折线图 / 极坐标面积图: polar line hybrids. */
export function buildPolarLineOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { compact = false } = config;
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const isArea = config.type === "polarArea";
  const areaOpacity = (config.areaOpacity ?? 22) / 100;
  const frame = buildPolarFrame(ctx, categories);
  const labelTextStyle = dataLabelTextStyle(config);
  const series: SeriesOption[] = dataSeries.map((item, index) => {
    const color = colorFor(index, config, item.name);
    return {
      name: item.name,
      type: "line",
      coordinateSystem: "polar",
      data: item.data,
      smooth: config.smooth,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      itemStyle: { color },
      lineStyle: { color, width: compact ? 1.5 : lineWidth },
      areaStyle: isArea ? { color, opacity: areaOpacity } : undefined,
      label: {
        show: compact ? false : config.showLabels,
        position: "top",
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return ctx.formatNumber(entry.value);
        },
      },
      emphasis: { focus: "series" },
    } as SeriesOption;
  });
  return { series, ...frame };
}
