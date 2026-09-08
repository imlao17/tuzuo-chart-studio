/**
 * Card / table / text-family renderers (Flourish parity batch 9).
 *
 * Covers: kpiCard, kpiCardRow, sparklineCard, barTable, wordCloud.
 *
 * These templates are graphic-layer driven: no cartesian grid, no axes, and
 * no per-point labels (their settings groups expose only 配色 and 数字格式).
 * A placeholder empty scatter series keeps the option's series array
 * non-empty for the shared assembler and export paths.
 *
 * wordCloud is deliberately dependency-free: the community echarts-wordcloud
 * extension renders canvas-only and would break the SVG export path, so the
 * layout here is a deterministic Archimedean-spiral packing of graphic text
 * elements sized by weight.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import { colorFor, type RendererResult } from "./shared";

type GraphicBlock = NonNullable<RendererResult["graphic"]>;
type GraphicElement = GraphicBlock extends readonly (infer Item)[] ? Item : GraphicBlock;

/** Placeholder series so every option still yields a non-empty series array. */
const PLACEHOLDER_SERIES: SeriesOption[] = [
  {
    name: "图形",
    type: "scatter",
    // Graphic-driven templates carry no coordinate system at all; without
    // "none" ECharts assigns a default cartesian grid and throws
    // `xAxis "0" not found` at render time.
    coordinateSystem: "none",
    data: [],
    silent: true,
    label: { show: false },
    tooltip: { show: false },
    emphasis: { focus: "none" },
  } as SeriesOption,
];

/** Inner content box shared by the card templates (mirrors pie.ts layout). */
function innerBox(ctx: RenderContext) {
  const { config } = ctx;
  const {
    title,
    subtitle,
    width,
    height,
    margins,
    compact = false,
  } = config;
  const legendVisible = false;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;
  const innerTop = margins.top + titleBlock;
  const innerBottom = margins.bottom;
  const innerLeft = margins.left;
  const innerRight = margins.right;
  return {
    x: innerLeft,
    y: innerTop,
    width: Math.max(40, width - innerLeft - innerRight),
    height: Math.max(40, height - innerTop - innerBottom),
    legendVisible,
  };
}

function textElement(
  overrides: Record<string, unknown>,
): GraphicElement {
  return { type: "text", silent: true, ...overrides } as unknown as GraphicElement;
}

/** 大数字卡: one hero number with its label underneath. */
export function buildKpiCardOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const box = innerBox(ctx);
  const value = dataSeries[0]?.data[0] ?? 0;
  const label = categories[0] ?? dataSeries[0]?.name ?? "";
  const heroSize = Math.round((compact ? 22 : fontSize * 3.4) * Math.min(1, box.width / 320));
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height * 0.46;

  const graphic: GraphicBlock = [
    textElement({
      x: centerX,
      y: centerY,
      style: {
        text: ctx.formatNumber(value),
        textAlign: "center",
        textVerticalAlign: "middle",
        fill: colorFor(0, config),
        font: `bold ${heroSize}px "Inter", "PingFang SC", sans-serif`,
      },
    }),
    textElement({
      x: centerX,
      y: centerY + heroSize * 0.72,
      style: {
        text: label,
        textAlign: "center",
        fill: theme.text,
        font: `${Math.max(11, Math.round(fontSize * 1.05))}px "Inter", "PingFang SC", sans-serif`,
      },
    }),
  ];
  return { series: PLACEHOLDER_SERIES, graphic };
}

/** 指标卡组: one card per numeric column, separated by hairline rules. */
export function buildKpiCardRowOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const box = innerBox(ctx);
  const count = Math.max(1, dataSeries.length);
  const cardWidth = box.width / count;
  const valueSize = Math.round((compact ? 16 : fontSize * 2.1) * Math.min(1, cardWidth / 150));
  const labelSize = Math.max(10, Math.round(fontSize * 0.92));

  const graphic: GraphicBlock = [];
  dataSeries.forEach((series, index) => {
    const centerX = box.x + cardWidth * index + cardWidth / 2;
    const centerY = box.y + box.height * 0.5;
    graphic.push(
      textElement({
        x: centerX,
        y: centerY,
        style: {
          text: ctx.formatNumber(series.data[0] ?? 0),
          textAlign: "center",
          textVerticalAlign: "middle",
          fill: colorFor(index, config, series.name),
          font: `bold ${valueSize}px "Inter", "PingFang SC", sans-serif`,
        },
      }),
      textElement({
        x: centerX,
        y: centerY + valueSize * 0.62,
        style: {
          text: series.name,
          textAlign: "center",
          fill: theme.text,
          font: `${labelSize}px "Inter", "PingFang SC", sans-serif`,
        },
      }),
    );
    if (index > 0) {
      graphic.push({
        type: "rect",
        silent: true,
        shape: {
          x: box.x + cardWidth * index,
          y: box.y + box.height * 0.2,
          width: 1,
          height: box.height * 0.6,
        },
        style: { fill: theme.grid },
      } as unknown as GraphicElement);
    }
  });
  return { series: PLACEHOLDER_SERIES, graphic };
}

/** 趋势迷你卡: hero number plus sparkline polylines for the trend columns. */
export function buildSparklineCardOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { theme, fontSize, compact = false } = config;
  const box = innerBox(ctx);
  const value = dataSeries[0]?.data[0] ?? 0;
  const label = categories[0] ?? dataSeries[0]?.name ?? "";
  const heroSize = Math.round((compact ? 18 : fontSize * 2.6) * Math.min(1, box.width / 340));
  const centerX = box.x + box.width / 2;

  const graphic: GraphicBlock = [
    textElement({
      x: centerX,
      y: box.y + box.height * 0.3,
      style: {
        text: ctx.formatNumber(value),
        textAlign: "center",
        textVerticalAlign: "middle",
        fill: colorFor(0, config),
        font: `bold ${heroSize}px "Inter", "PingFang SC", sans-serif`,
      },
    }),
    textElement({
      x: centerX,
      y: box.y + box.height * 0.3 + heroSize * 0.68,
      style: {
        text: label,
        textAlign: "center",
        fill: theme.text,
        font: `${Math.max(10, Math.round(fontSize * 0.92))}px "Inter", "PingFang SC", sans-serif`,
      },
    }),
  ];

  // Sparkline lives in the lower 42% of the card: one polyline across the
  // trend columns (the trend runs along columns of the single sample row),
  // min-max normalized.
  const trendValues = dataSeries.slice(1).map((series) => series.data[0]).filter(Number.isFinite);
  if (trendValues.length >= 2) {
    const sparkTop = box.y + box.height * 0.52;
    const sparkHeight = box.height * 0.34;
    const sparkLeft = box.x + box.width * 0.16;
    const sparkWidth = box.width * 0.68;
    const min = Math.min(...trendValues);
    const max = Math.max(...trendValues);
    const span = max > min ? max - min : 1;
    const points = trendValues.map((value, pointIndex) => {
      const x = sparkLeft + (sparkWidth * pointIndex) / Math.max(1, trendValues.length - 1);
      const y = sparkTop + sparkHeight - ((value - min) / span) * sparkHeight;
      return [Math.round(x), Math.round(y)];
    });
    graphic.push({
      type: "polyline",
      silent: true,
      shape: { points },
      style: {
        fill: "none",
        stroke: colorFor(1, config),
        lineWidth: Math.max(1.5, config.fontSize / 8),
      },
    } as unknown as GraphicElement);
  }
  return { series: PLACEHOLDER_SERIES, graphic };
}

/** 条形表格图: each row renders as name | mini bar | value text. */
export function buildBarTableOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { theme, fontSize } = config;
  const box = innerBox(ctx);
  const values = dataSeries[0]?.data ?? [];
  const rows = categories.map((name, index) => ({
    name,
    value: Number.isFinite(values[index]) ? values[index] : 0,
  }));
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  const rowCount = Math.max(1, rows.length);
  const rowHeight = box.height / rowCount;
  const nameWidth = box.width * 0.3;
  const barAreaWidth = box.width * 0.48;
  const barLeft = box.x + nameWidth + box.width * 0.04;
  const nameSize = Math.max(9, Math.min(fontSize, rowHeight * 0.42));
  const labelTextStyle = colorFor(0, config);

  const graphic: GraphicBlock = [];
  rows.forEach((row, index) => {
    const rowTop = box.y + rowHeight * index;
    const centerY = rowTop + rowHeight / 2;
    graphic.push(
      textElement({
        x: box.x,
        y: centerY,
        style: {
          text: row.name,
          textAlign: "left",
          textVerticalAlign: "middle",
          fill: theme.text,
          font: `${Math.round(nameSize)}px "Inter", "PingFang SC", sans-serif`,
        },
      }),
      {
        type: "rect",
        silent: true,
        shape: {
          x: barLeft,
          y: rowTop + rowHeight * 0.28,
          width: Math.max(2, (Math.abs(row.value) / maxValue) * barAreaWidth),
          height: rowHeight * 0.44,
          r: 3,
        },
        style: { fill: labelTextStyle, opacity: config.transparent ? 0.9 : 0.92 },
      } as unknown as GraphicElement,
      textElement({
        // Right-align the value against the card edge so long numbers can
        // never spill past the canvas.
        x: box.x + box.width,
        y: centerY,
        style: {
          text: ctx.formatNumber(row.value),
          textAlign: "right",
          textVerticalAlign: "middle",
          fill: theme.text,
          font: `${Math.round(nameSize)}px "Inter", "PingFang SC", sans-serif`,
        },
      }),
    );
  });
  return { series: PLACEHOLDER_SERIES, graphic };
}

/** 词云: deterministic Archimedean-spiral packing of weighted text elements. */
export function buildWordCloudOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const { fontSize, compact = false } = config;
  const box = innerBox(ctx);
  const weights = dataSeries[0]?.data ?? [];
  const words = categories
    .map((name, index) => ({ name, weight: Number.isFinite(weights[index]) ? weights[index] : 0 }))
    .filter((word) => word.name)
    .sort((a, b) => b.weight - a.weight);
  const maxWeight = Math.max(1, ...words.map((word) => word.weight));
  const maxSize = Math.max(16, Math.round((compact ? 18 : fontSize * 3) * Math.min(1.4, box.width / 420)));
  const minSize = Math.max(9, Math.round(maxSize * 0.3));
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  const estimate = (word: { name: string; weight: number }) => {
    const size = minSize + Math.sqrt(word.weight / maxWeight) * (maxSize - minSize);
    return {
      size: Math.round(size),
      width: word.name.length * size * 0.62 + 6,
      height: size * 1.18 + 4,
    };
  };

  const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
  const collides = (candidate: { x: number; y: number; width: number; height: number }) =>
    placed.some(
      (existing) =>
        candidate.x < existing.x + existing.width + 3 &&
        candidate.x + candidate.width + 3 > existing.x &&
        candidate.y < existing.y + existing.height + 3 &&
        candidate.y + candidate.height + 3 > existing.y,
    );

  const graphic: GraphicBlock = [];
  words.forEach((word, index) => {
    const metrics = estimate(word);
    let chosen: { x: number; y: number } = { x: centerX - metrics.width / 2, y: centerY - metrics.height / 2 };
    let fallback = chosen;
    let placedOk = false;
    for (let step = 0; step < 480 && !placedOk; step += 1) {
      const angle = step * 0.42;
      const radius = 2.4 * Math.sqrt(step);
      const cx = centerX + radius * Math.cos(angle) * 1.25;
      const cy = centerY + radius * Math.sin(angle) * 0.72;
      const candidate = { x: cx - metrics.width / 2, y: cy - metrics.height / 2, ...metrics };
      if (step === 0) fallback = { x: candidate.x, y: candidate.y };
      if (
        candidate.x < box.x - 8 ||
        candidate.y < box.y - 8 ||
        candidate.x + candidate.width > box.x + box.width + 8 ||
        candidate.y + candidate.height > box.y + box.height + 8
      ) {
        continue;
      }
      if (!collides(candidate)) {
        chosen = { x: candidate.x, y: candidate.y };
        placedOk = true;
      }
    }
    if (!placedOk) chosen = fallback;
    const finalBox = { x: chosen.x, y: chosen.y, width: metrics.width, height: metrics.height };
    placed.push(finalBox);
    graphic.push(
      textElement({
        left: chosen.x,
        top: chosen.y,
        style: {
          text: word.name,
          textAlign: "left",
          textVerticalAlign: "top",
          fill: colorFor(index, config, word.name),
          font: `bold ${metrics.size}px "Inter", "PingFang SC", sans-serif`,
        },
      }),
    );
  });
  return { series: PLACEHOLDER_SERIES, graphic };
}
