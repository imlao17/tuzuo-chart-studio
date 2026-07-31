/**
 * Line / area family renderer.
 *
 * Covers the 6 cartesian line types:
 *   line, smoothLine, stepLine (line family)
 *   area, stackedArea, proportionalArea (area family)
 *
 * Line-for-line port of the line-producing path inside the legacy
 * buildChartOption's catch-all `else` branch (legacy lines 451-463, 465-466,
 * 635-705). Bar/combo/scatter/diverging/streamgraph are NOT handled here.
 *
 * Like bar.ts, this port keeps the same field assignments as the legacy map
 * body. With `isLine` true the line-specific branches (smooth/step/symbol/
 * lineStyle/areaStyle) evaluate exactly as legacy did for line/area types,
 * and the bar-only branches (barMaxWidth/borderRadius) land on their legacy
 * no-op values, producing identical output.
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

const STACKED_TYPES = new Set(["stackedArea", "proportionalArea"]);
const AREA_TYPES = new Set(["area", "stackedArea", "proportionalArea"]);
const SMOOTH_BY_DEFAULT = new Set(["smoothLine", "stackedArea", "proportionalArea"]);

export function buildLineAreaOption(ctx: RenderContext): RendererResult {
  const { config, dataSeries, formatNumber } = ctx;
  const { type, theme, fontSize, compact = false } = config;

  // Legacy style defaults (legacy lines 399-404).
  const lineWidth = config.lineWidth ?? 3;
  const pointSize = config.pointSize ?? 7;
  const barWidth = config.barWidth ?? 48;
  const markOpacity = (config.markOpacity ?? 100) / 100;
  const areaOpacity = (config.areaOpacity ?? 22) / 100;

  const stacked = STACKED_TYPES.has(type);
  const isArea = AREA_TYPES.has(type);

  // Legacy axes (legacy lines 465-466): line/area are vertical, so
  // xAxis=categoryAxis, yAxis=valueAxis.
  const textColor = theme.text;
  const labelTextStyle = dataLabelTextStyle(config);
  const xAxis = buildCategoryAxis(ctx, textColor, fontSize, compact);
  const yAxis = buildValueAxis(ctx, textColor, fontSize, compact);

  // Legacy line 643-644: `area` (and `column`, but column runs in bar.ts)
  // only render the first series; the other line/area types render all.
  const visibleDataSeries = type === "area" ? dataSeries.slice(0, 1) : dataSeries;

  // P1-2 marks: shaded vertical bands and horizontal reference lines. Both are
  // series-level in ECharts, so attach them to the first rendered series once.
  const markArea =
    config.referenceBands && config.referenceBands.length
      ? {
          silent: true,
          itemStyle: { color: "rgba(22, 99, 235, 0.08)" },
          data: config.referenceBands.map((band) => [
            { xAxis: band.start, label: band.label ? { show: true, formatter: band.label } : undefined },
            { xAxis: band.end },
          ]),
        }
      : undefined;
  const markLine =
    config.referenceLines && config.referenceLines.length
      ? {
          silent: true,
          symbol: ["none", "none"],
          lineStyle: { type: "dashed" as const },
          data: config.referenceLines.map((line) => ({
            yAxis: line.value,
            label: line.label ? { show: true, formatter: line.label } : undefined,
          })),
        }
      : undefined;

  // endLabel only applies to line series (ECharts ignores it on area). When
  // enabled, suppress the per-point label so only the end label shows.
  const endLabelEnabled = !compact && !isArea && config.endLabel;
  const showPerPointLabel = (compact ? false : config.showLabels) && !endLabelEnabled;

  const series: SeriesOption[] = visibleDataSeries.map((item, index) => {
    const color = colorFor(index, config, item.name);
    // In the legacy map `seriesType` was "line" when isLine/comboLine, else
    // "bar". This renderer only handles line/area types, so it is always
    // "line". The remaining field assignments mirror legacy lines 650-703
    // exactly; the bar-only conditions evaluate the same way they did for
    // line/area types.
    const seriesType = "line";
    return {
      name: item.name,
      type: seriesType,
      data: item.data,
      stack: stacked ? "total" : undefined,
      smooth:
        seriesType === "line" &&
        (SMOOTH_BY_DEFAULT.has(type) || config.smooth),
      step: type === "stepLine" ? "middle" : undefined,
      // P1-2: optionally bridge missing (NaN) values instead of leaving a gap.
      connectNulls: config.connectNulls || undefined,
      symbol: compact || pointSize === 0 ? "none" : "circle",
      symbolSize: compact ? 0 : pointSize,
      barMaxWidth: compact ? 20 : barWidth,
      itemStyle: {
        color,
        opacity: markOpacity,
        // seriesType is "line", so borderRadius lands on 0 as legacy did.
        borderRadius: 0,
      },
      lineStyle: { color, width: compact ? 1.5 : lineWidth },
      areaStyle: isArea
        ? {
            color,
            opacity: stacked ? Math.max(areaOpacity, 0.5) : areaOpacity,
          }
        : undefined,
      label: {
        show: showPerPointLabel,
        position: resolveDataLabelPosition(config, "top"),
        ...labelTextStyle,
        formatter: (params: unknown) => {
          const entry = params as { value: string | number };
          return formatNumber(entry.value);
        },
      },
      // P1-2: end-of-line label (series name) for line series.
      endLabel: endLabelEnabled
        ? {
            show: true,
            formatter: "{a}",
            color,
            fontSize: labelTextStyle.fontSize,
            fontWeight: labelTextStyle.fontWeight,
            fontStyle: labelTextStyle.fontStyle,
          }
        : undefined,
      // P1-2 marks attach to the first series only.
      markArea: index === 0 ? markArea : undefined,
      markLine: index === 0 ? markLine : undefined,
      emphasis: { focus: "series" },
    } as SeriesOption;
  });

  return { series, xAxis, yAxis };
}
