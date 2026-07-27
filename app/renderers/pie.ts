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
import type { RendererResult } from "./shared";

export function buildPieOption(ctx: RenderContext): RendererResult {
  const { config, categories, dataSeries } = ctx;
  const {
    type,
    title,
    subtitle,
    width,
    height,
    margins,
    theme,
    backgroundColor,
    transparent,
    fontSize,
    compact = false,
  } = config;

  const textColor = theme.text;
  const titleBlock = compact ? 0 : title || subtitle ? 74 : 12;

  const innerTop = margins.top + titleBlock;
  const innerHeight = Math.max(80, height - innerTop - margins.bottom);
  const innerWidth = Math.max(80, width - margins.left - margins.right);
  const centerX = ((margins.left + innerWidth / 2) / width) * 100;
  const centerY = ((innerTop + innerHeight / 2) / height) * 100;
  const radius = Math.max(42, Math.min(innerWidth, innerHeight) * 0.38);

  const primary = dataSeries[0] ?? { name: "数值", data: [] };

  const series: SeriesOption[] = [
    {
      name: primary.name,
      type: "pie",
      radius: type === "donut" ? [radius * 0.56, radius] : [0, radius],
      center: [`${centerX}%`, `${centerY}%`],
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: transparent ? "rgba(255,255,255,0.82)" : backgroundColor,
        borderWidth: compact ? 1 : 2,
        borderRadius: compact ? 1 : 3,
      },
      label: {
        show: compact ? false : config.showLabels,
        color: textColor,
        fontSize,
        formatter: "{b}\n{d}%",
        lineHeight: fontSize + 5,
      },
      data: categories.map((name, index) => ({
        name,
        value: primary.data[index],
      })),
    },
  ];

  // No axes for pie/donut. The assembler reads capabilities.axes === false to
  // also omit `grid` and switch tooltip trigger to "item".
  return { series };
}
