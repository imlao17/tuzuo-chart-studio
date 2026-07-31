/**
 * Pie / donut family renderer.
 *
 * Line-for-line port of the legacy buildChartOption pie/donut branch (legacy
 * lines 469-503). The only structural change is that "clear the axes" is now
 * expressed by returning no axes on the RendererResult, and the assembler
 * (keyed off capabilities.axes === false) handles omitting `grid`. The series
 * payload itself is identical to legacy.
 */
import type { SeriesOption } from "echarts";
import type { RenderContext } from "../template-definition";
import {
  dataLabelTextStyle,
  LEGEND_HORIZONTAL_SPACE,
  LEGEND_VERTICAL_SPACE,
  resolvePieLabelPosition,
  type RendererResult,
} from "./shared";

export function buildPieOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries, formatNumber } = ctx;
  const {
    type,
    title,
    subtitle,
    width,
    height,
    margins,
    backgroundColor,
    transparent,
    compact = false,
  } = config;

  const labelTextStyle = dataLabelTextStyle(config);
  const legendPosition = config.legendPosition ?? "top";
  const legendVisible = !compact && config.showLegend;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;

  const innerTop =
    margins.top +
    titleBlock +
    (legendVisible && legendPosition === "top"
      ? LEGEND_HORIZONTAL_SPACE
      : 0);
  const innerBottom =
    margins.bottom +
    (legendVisible && legendPosition === "bottom"
      ? LEGEND_HORIZONTAL_SPACE
      : 0);
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
  const radius = Math.max(42, Math.min(innerWidth, innerHeight) * 0.38);

  const primary = dataSeries[0] ?? { name: "数值", data: [] };

  // Build slice entries from categories + the primary series. Apply optional
  // sort (by value) and optional "其他" merging for slices below a percent
  // threshold. Both are no-ops when their config field is absent.
  let entries = categories.map((name, index) => ({
    name,
    value: primary.data[index],
  }));
  if (config.pieSort) {
    const dir = config.pieSort === "desc" ? -1 : 1;
    entries = [...entries].sort((a, b) => (a.value - b.value) * dir);
  }
  if (config.pieOtherThreshold !== undefined) {
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    if (total > 0) {
      const [small, large] = entries.reduce(
        (acc, e) => {
          const pct = (e.value / total) * 100;
          acc[pct < config.pieOtherThreshold! ? 0 : 1].push(e);
          return acc;
        },
        [[] as typeof entries, [] as typeof entries],
      );
      if (small.length) {
        const otherValue = small.reduce((sum, e) => sum + e.value, 0);
        entries = [...large, { name: "其他", value: otherValue }];
      }
    }
  }

  // Label formatter: undefined keeps the legacy "{b}\n{d}%" string so default
  // output is byte-identical; otherwise compose name + value/percent.
  const labelFormatter =
    config.pieLabelContent === undefined
      ? "{b}\n{d}%"
      : (params: unknown) => {
          const item = params as { name: string; percent: number; value: number };
          const valueText = formatNumber(item.value);
          if (config.pieLabelContent === "value") return `${item.name}\n${valueText}`;
          if (config.pieLabelContent === "percent") return `${item.name}\n${item.percent}%`;
          return `${item.name}\n${valueText} (${item.percent}%)`;
        };

  const series: SeriesOption[] = [
    {
      name: primary.name,
      type: "pie",
      radius:
        type === "donut"
          ? [radius * (config.donutInnerRadius ?? 0.56), radius]
          : [0, radius],
      center: [`${centerX}%`, `${centerY}%`],
      avoidLabelOverlap: true,
      // startAngle is emitted ONLY when configured. Setting it to undefined on
      // the series object makes ECharts 6's pie renderer produce empty slice
      // paths, so the field must be absent (not undefined) by default.
      ...(config.startAngle !== undefined
        ? { startAngle: config.startAngle }
        : {}),
      itemStyle: {
        borderColor: transparent ? "rgba(255,255,255,0.82)" : backgroundColor,
        borderWidth: compact ? 1 : 2,
        borderRadius: compact ? 1 : 3,
      },
      label: {
        show: compact ? false : config.showLabels,
        position: resolvePieLabelPosition(config),
        ...labelTextStyle,
        formatter: labelFormatter,
        lineHeight: labelTextStyle.fontSize + 5,
      },
      data: entries,
    },
  ];

  // No axes for pie/donut. The assembler reads capabilities.axes === false to
  // also omit `grid` and switch tooltip trigger to "item".
  return { series };
}
